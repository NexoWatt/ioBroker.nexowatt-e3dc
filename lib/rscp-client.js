'use strict';

const net = require('net');
const { EventEmitter } = require('events');
const Rijndael = require('rijndael-js');
const { BLOCK_SIZE, toCodeHex } = require('./rscp-tags');
const { buildPasswordBuffer, buildFrame, parseFrame, normalizeItem, walkTree } = require('./rscp-codec');

class RscpClient extends EventEmitter {
    constructor(options, logger) {
        super();
        this.options = {
            host: '',
            port: 5033,
            portalUser: '',
            portalPassword: '',
            rscpPassword: '',
            requestTimeoutMs: 8000,
            ...options,
        };
        this.log = logger || console;

        this.socket = null;
        this.cipher = null;
        this.inBuffer = Buffer.alloc(0);
        this.queue = [];
        this.currentRequest = null;
        this.connected = false;
        this.authLevel = 0;
        this.authenticated = false;
        this.encryptionIV = null;
        this.decryptionIV = null;
        this.destroyed = false;
    }



    _getConfigDiagnostics() {
        const rscpPassword = String(this.options.rscpPassword || '');
        const portalUser = String(this.options.portalUser || '');
        const portalPassword = String(this.options.portalPassword || '');
        return {
            host: this.options.host,
            port: this.options.port,
            portalUserLength: portalUser.length,
            portalPasswordLength: portalPassword.length,
            rscpPasswordLength: rscpPassword.length,
            rscpPasswordUtf8Bytes: Buffer.byteLength(rscpPassword, 'utf8'),
            rscpPasswordAsciiOnly: /^[\x20-\x7E]*$/u.test(rscpPassword),
        };
    }

    _logConfigDiagnostics() {
        const d = this._getConfigDiagnostics();
        this.log.info(
            `RSCP connect diagnostics: host=${d.host}:${d.port}, portalUserLen=${d.portalUserLength}, portalPasswordLen=${d.portalPasswordLength}, rscpPasswordLen=${d.rscpPasswordLength}, rscpPasswordUtf8Bytes=${d.rscpPasswordUtf8Bytes}, rscpPasswordAsciiOnly=${d.rscpPasswordAsciiOnly}`,
        );
        if (!d.rscpPasswordLength) {
            this.log.warn('RSCP password is empty. The E3/DC will typically close the socket immediately.');
        } else if (!d.rscpPasswordAsciiOnly) {
            this.log.warn(
                'RSCP password contains non-ASCII characters. E3/DC RSCP authentication is often more reliable with a simple ASCII/alphanumeric key.',
            );
        }
    }

    async connect() {
        if (this.connected && this.socket) {
            return;
        }

        this.destroyed = false;
        this.inBuffer = Buffer.alloc(0);
        this.queue = [];
        this.currentRequest = null;
        this.authLevel = 0;
        this.authenticated = false;
        this.encryptionIV = Buffer.alloc(BLOCK_SIZE, 0xFF);
        this.decryptionIV = Buffer.alloc(BLOCK_SIZE, 0xFF);
        this._logConfigDiagnostics();
        this.cipher = new Rijndael(buildPasswordBuffer(this.options.rscpPassword), 'cbc');

        await new Promise((resolve, reject) => {
            const socket = new net.Socket();
            this.socket = socket;

            const onErrorBeforeConnect = err => {
                cleanup();
                reject(err);
            };

            const onConnect = () => {
                cleanup();
                this.connected = true;
                socket.setKeepAlive(true);
                socket.setNoDelay(true);
                this.emit('connected');
                this._enqueueAuthentication();
                resolve();
            };

            const cleanup = () => {
                socket.removeListener('error', onErrorBeforeConnect);
                socket.removeListener('connect', onConnect);
            };

            socket.once('error', onErrorBeforeConnect);
            socket.once('connect', onConnect);

            socket.on('data', data => this._onData(data));
            socket.on('close', hadError => {
                this.connected = false;
                this.authenticated = false;
                this.authLevel = 0;
                this.emit('disconnected', hadError);
                const message = this.authenticated
                    ? 'RSCP socket closed'
                    : 'RSCP socket closed before authentication (typically RSCP password/AES key mismatch or client not in same subnet)';
                this._rejectAllPending(new Error(message));
            });
            socket.on('end', () => {
                this.connected = false;
                this.authenticated = false;
                this.authLevel = 0;
                this.emit('disconnected', false);
                const message = this.authenticated
                    ? 'RSCP socket ended'
                    : 'RSCP socket ended before authentication (typically RSCP password/AES key mismatch or client not in same subnet)';
                this._rejectAllPending(new Error(message));
            });
            socket.on('timeout', () => {
                this.emit('error', new Error('RSCP socket timeout'));
                socket.destroy();
            });
            socket.on('error', err => {
                if (this.connected) {
                    this.emit('error', err);
                }
            });

            socket.connect(this.options.port, this.options.host);
        });
    }

    disconnect() {
        this.destroyed = true;
        this.connected = false;
        this.authenticated = false;
        this.authLevel = 0;

        if (this.currentRequest && this.currentRequest.timer) {
            clearTimeout(this.currentRequest.timer);
        }
        this._rejectAllPending(new Error('RSCP client disconnected'));

        if (this.socket) {
            this.socket.removeAllListeners();
            try {
                this.socket.destroy();
            } catch {
                // ignore
            }
            this.socket = null;
        }
    }

    sendItems(items, options = {}) {
        const normalizedItems = Array.isArray(items) ? items.map(item => normalizeItem(item)) : [];
        return new Promise((resolve, reject) => {
            this.queue.push({
                items: normalizedItems,
                resolve,
                reject,
                allowBeforeAuth: !!options.allowBeforeAuth,
                timeoutMs: Number(options.timeoutMs || this.options.requestTimeoutMs || 8000),
            });
            this._pump();
        });
    }

    _enqueueAuthentication() {
        this.sendItems(
            [
                {
                    tag: 'TAG_RSCP_REQ_AUTHENTICATION',
                    children: [
                        { tag: 'TAG_RSCP_AUTHENTICATION_USER', value: this.options.portalUser || '' },
                        { tag: 'TAG_RSCP_AUTHENTICATION_PASSWORD', value: this.options.portalPassword || '' },
                    ],
                },
            ],
            { allowBeforeAuth: true, timeoutMs: this.options.requestTimeoutMs },
        ).catch(err => {
            this.emit('error', err);
        });
    }

    _pump() {
        if (this.destroyed || !this.connected || !this.socket || this.currentRequest) {
            return;
        }
        if (!this.queue.length) {
            return;
        }

        const next = this.queue[0];
        if (!this.authenticated && !next.allowBeforeAuth) {
            return;
        }

        this.queue.shift();
        const frame = buildFrame(next.items);
        const encrypted = Buffer.from(this.cipher.encrypt(frame, 256, this.encryptionIV));
        encrypted.copy(this.encryptionIV, 0, encrypted.length - BLOCK_SIZE, encrypted.length);

        next.timer = setTimeout(() => {
            if (this.currentRequest === next) {
                this.currentRequest = null;
                next.reject(new Error('RSCP request timeout'));
                this.emit('error', new Error('RSCP request timeout'));
                try {
                    this.socket.destroy();
                } catch {
                    // ignore
                }
            }
        }, next.timeoutMs);

        this.currentRequest = next;
        this.socket.write(encrypted);
    }

    _onData(chunk) {
        if (!chunk || !chunk.length) {
            return;
        }
        this.inBuffer = Buffer.concat([this.inBuffer, chunk]);
        try {
            this._processEncryptedFrames();
        } catch (error) {
            this.emit('error', error);
            if (this.socket) {
                this.socket.destroy();
            }
        }
    }

    _processEncryptedFrames() {
        while (this.inBuffer.length >= BLOCK_SIZE) {
            const probe = Buffer.from(
                this.cipher.decrypt(this.inBuffer.subarray(0, BLOCK_SIZE), 256, Buffer.from(this.decryptionIV)),
            );

            if (probe.length < 18) {
                return;
            }
            if (probe[0] !== 0xE3 || probe[1] !== 0xDC) {
                throw new Error(`Invalid RSCP magic in decrypted stream: ${probe.subarray(0, 2).toString('hex')}`);
            }

            const payloadLength = probe.readUInt16LE(16);
            const plainLength = 18 + payloadLength + 4;
            const encryptedLength = Math.ceil(plainLength / BLOCK_SIZE) * BLOCK_SIZE;

            if (this.inBuffer.length < encryptedLength) {
                return;
            }

            const encryptedFrame = this.inBuffer.subarray(0, encryptedLength);
            const plainPadded = Buffer.from(this.cipher.decrypt(encryptedFrame, 256, this.decryptionIV));
            encryptedFrame.copy(this.decryptionIV, 0, encryptedLength - BLOCK_SIZE, encryptedLength);

            const frame = plainPadded.subarray(0, plainLength);
            this.inBuffer = this.inBuffer.subarray(encryptedLength);

            let parsed;
            try {
                parsed = parseFrame(frame);
            } catch (error) {
                if (this.currentRequest) {
                    clearTimeout(this.currentRequest.timer);
                    const failed = this.currentRequest;
                    this.currentRequest = null;
                    failed.reject(error);
                }
                this.emit('error', error);
                continue;
            }

            const authLevel = this._extractAuthenticationLevel(parsed.tree);
            if (authLevel !== null) {
                this.authLevel = authLevel;
                this.authenticated = authLevel >= 10;
                this.emit('authenticated', authLevel);
            }

            if (this.currentRequest) {
                clearTimeout(this.currentRequest.timer);
                const finished = this.currentRequest;
                this.currentRequest = null;
                finished.resolve(parsed);
            }

            this.emit('frame', parsed);
            this._pump();
        }
    }

    _extractAuthenticationLevel(tree) {
        let level = null;
        walkTree(tree, node => {
            if (node.tagName === 'TAG_RSCP_AUTHENTICATION' && typeof node.value === 'number') {
                level = node.value;
            }
        });
        return level;
    }

    _rejectAllPending(error) {
        if (this.currentRequest) {
            clearTimeout(this.currentRequest.timer);
            this.currentRequest.reject(error);
            this.currentRequest = null;
        }
        while (this.queue.length) {
            const pending = this.queue.shift();
            pending.reject(error);
        }
    }
}

module.exports = {
    RscpClient,
};
