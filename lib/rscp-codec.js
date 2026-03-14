'use strict';

const CRC32 = require('crc-32');
const { TYPE_CODES, TYPE_NAMES, getTagDefinition, toCodeHex } = require('./rscp-tags');

function buildPasswordBuffer(value) {
    const buffer = Buffer.alloc(32, 0xFF);
    if (value) {
        buffer.write(String(value), 0, 32, 'utf8');
    }
    return buffer;
}

function buildFrame(items) {
    const data = Buffer.concat(items.map(item => encodeItem(normalizeItem(item))));
    const frame = Buffer.alloc(18 + data.length);
    frame[0] = 0xE3;
    frame[1] = 0xDC;
    frame[2] = 0x00;
    frame[3] = 0x11; // checksum enabled, protocol version 1

    const nowMs = Date.now();
    const seconds = BigInt(Math.floor(nowMs / 1000));
    const nanos = Math.floor((nowMs % 1000) * 1000000);
    frame.writeBigUInt64LE(seconds, 4);
    frame.writeUInt32LE(nanos, 12);
    frame.writeUInt16LE(data.length, 16);

    data.copy(frame, 18);

    const checksum = Buffer.alloc(4);
    checksum.writeInt32LE(CRC32.buf(frame), 0);

    return Buffer.concat([frame, checksum]);
}

function parseFrame(frameBuffer) {
    if (!Buffer.isBuffer(frameBuffer) || frameBuffer.length < 22) {
        throw new Error('RSCP frame too short');
    }
    if (frameBuffer[0] !== 0xE3 || frameBuffer[1] !== 0xDC) {
        throw new Error(`Invalid RSCP magic: ${frameBuffer.subarray(0, 2).toString('hex')}`);
    }

    const payloadLength = frameBuffer.readUInt16LE(16);
    const plainLength = 18 + payloadLength + 4;
    if (frameBuffer.length < plainLength) {
        throw new Error(`Incomplete RSCP frame: expected ${plainLength} bytes, got ${frameBuffer.length}`);
    }

    const expectedCrc = frameBuffer.readInt32LE(18 + payloadLength);
    const actualCrc = CRC32.buf(frameBuffer.subarray(0, 18 + payloadLength));
    if (expectedCrc !== actualCrc) {
        throw new Error(`CRC mismatch: expected ${expectedCrc}, got ${actualCrc}`);
    }

    const seconds = frameBuffer.readBigUInt64LE(4);
    const nanoseconds = frameBuffer.readUInt32LE(12);
    const tree = parseTlv(frameBuffer, 18, 18 + payloadLength);

    return {
        seconds: seconds.toString(),
        nanoseconds,
        tree,
        payloadLength,
    };
}

function parseTlv(buffer, start, end) {
    const result = [];
    let offset = start;

    while (offset < end) {
        if (offset + 7 > end) {
            throw new Error(`Truncated TLV header at offset ${offset}`);
        }

        const tagCode = buffer.readUInt32LE(offset);
        const typeCode = buffer.readUInt8(offset + 4);
        const len = buffer.readUInt16LE(offset + 5);
        const valueStart = offset + 7;
        const valueEnd = valueStart + len;
        if (valueEnd > end) {
            throw new Error(`TLV length ${len} exceeds frame boundary at offset ${offset}`);
        }

        const typeName = TYPE_NAMES[typeCode] || `Unknown(${typeCode})`;
        const node = {
            tagCode,
            tagHex: toCodeHex(tagCode),
            tagName: getKnownTagName(tagCode),
            typeCode,
            type: typeName,
        };

        if (typeName === 'Container') {
            node.children = parseTlv(buffer, valueStart, valueEnd);
        } else {
            node.value = decodeValue(buffer.subarray(valueStart, valueEnd), typeName);
        }

        result.push(node);
        offset = valueEnd;
    }

    return result;
}

function normalizeItem(item) {
    if (!item || typeof item !== 'object') {
        throw new Error('RSCP item must be an object');
    }

    const tagDef = getTagDefinition(item.tag);
    const type = item.children ? 'Container' : item.type || tagDef.type;
    if (!type) {
        throw new Error(`Missing type for tag ${tagDef.name}`);
    }

    const normalized = {
        tag: tagDef.name,
        tagCode: tagDef.code,
        type,
    };

    if (type === 'Container') {
        const children = Array.isArray(item.children) ? item.children : [];
        normalized.children = children.map(child => normalizeItem(child));
    } else {
        normalized.value = item.value;
    }

    return normalized;
}

function encodeItem(item) {
    const tagBuffer = Buffer.alloc(4);
    tagBuffer.writeUInt32LE(item.tagCode, 0);

    const typeCode = TYPE_CODES[item.type];
    if (typeCode === undefined) {
        throw new Error(`Unsupported RSCP type: ${item.type}`);
    }

    const payload =
        item.type === 'Container'
            ? Buffer.concat((item.children || []).map(child => encodeItem(child)))
            : encodeValue(item.type, item.value);

    const header = Buffer.alloc(3);
    header.writeUInt8(typeCode, 0);
    header.writeUInt16LE(payload.length, 1);

    return Buffer.concat([tagBuffer, header, payload]);
}

function encodeValue(type, value) {
    switch (type) {
        case 'None':
            return Buffer.alloc(0);
        case 'Bool':
            return Buffer.from([value ? 1 : 0]);
        case 'Char8': {
            const buffer = Buffer.alloc(1);
            buffer.writeInt8(Number(value || 0), 0);
            return buffer;
        }
        case 'UChar8': {
            const buffer = Buffer.alloc(1);
            buffer.writeUInt8(Number(value || 0), 0);
            return buffer;
        }
        case 'Int16': {
            const buffer = Buffer.alloc(2);
            buffer.writeInt16LE(Number(value || 0), 0);
            return buffer;
        }
        case 'UInt16': {
            const buffer = Buffer.alloc(2);
            buffer.writeUInt16LE(Number(value || 0), 0);
            return buffer;
        }
        case 'Int32': {
            const buffer = Buffer.alloc(4);
            buffer.writeInt32LE(Number(value || 0), 0);
            return buffer;
        }
        case 'UInt32': {
            const buffer = Buffer.alloc(4);
            buffer.writeUInt32LE(Number(value || 0), 0);
            return buffer;
        }
        case 'Int64': {
            const buffer = Buffer.alloc(8);
            buffer.writeBigInt64LE(BigInt(value || 0), 0);
            return buffer;
        }
        case 'UInt64': {
            const buffer = Buffer.alloc(8);
            buffer.writeBigUInt64LE(BigInt(value || 0), 0);
            return buffer;
        }
        case 'Float32': {
            const buffer = Buffer.alloc(4);
            buffer.writeFloatLE(Number(value || 0), 0);
            return buffer;
        }
        case 'Double64': {
            const buffer = Buffer.alloc(8);
            buffer.writeDoubleLE(Number(value || 0), 0);
            return buffer;
        }
        case 'CString':
            return Buffer.from(String(value || ''), 'utf8');
        case 'Bitfield':
        case 'ByteArray':
            return normalizeByteArray(value);
        case 'Timestamp': {
            let seconds = 0;
            let nanos = 0;
            if (value instanceof Date) {
                const ms = value.getTime();
                seconds = Math.floor(ms / 1000);
                nanos = (ms % 1000) * 1000000;
            } else if (typeof value === 'number') {
                seconds = Math.floor(value);
                nanos = Math.round((value - seconds) * 1000000000);
            } else if (value && typeof value === 'object') {
                seconds = Number(value.seconds || 0);
                nanos = Number(value.nanoseconds || value.nanos || 0);
            }
            const buffer = Buffer.alloc(12);
            buffer.writeBigUInt64LE(BigInt(seconds), 0);
            buffer.writeUInt32LE(nanos, 8);
            return buffer;
        }
        default:
            throw new Error(`Cannot encode unsupported RSCP type ${type}`);
    }
}

function decodeValue(payload, typeName) {
    switch (typeName) {
        case 'None':
            return null;
        case 'Bool':
            return payload.length > 0 ? payload.readUInt8(0) !== 0 : false;
        case 'Char8':
            return payload.readInt8(0);
        case 'UChar8':
            return payload.readUInt8(0);
        case 'Int16':
            return payload.readInt16LE(0);
        case 'UInt16':
            return payload.readUInt16LE(0);
        case 'Int32':
            return payload.readInt32LE(0);
        case 'UInt32':
            return payload.readUInt32LE(0);
        case 'Int64':
            return payload.readBigInt64LE(0).toString();
        case 'UInt64':
            return payload.readBigUInt64LE(0).toString();
        case 'Float32':
            return payload.readFloatLE(0);
        case 'Double64':
            return payload.readDoubleLE(0);
        case 'CString':
            return payload.toString('utf8');
        case 'Bitfield':
        case 'ByteArray':
            return payload.toString('hex').toUpperCase().replace(/(..)(?=.)/g, '$1 ');
        case 'Timestamp':
            return {
                seconds: payload.readBigUInt64LE(0).toString(),
                nanoseconds: payload.readUInt32LE(8),
            };
        case 'Error':
            if (payload.length >= 4) {
                return payload.readUInt32LE(0);
            }
            return payload.toString('hex').toUpperCase();
        default:
            return payload.toString('hex').toUpperCase();
    }
}

function normalizeByteArray(value) {
    if (Buffer.isBuffer(value)) {
        return value;
    }
    if (Array.isArray(value)) {
        return Buffer.from(value);
    }
    if (typeof value === 'string') {
        const cleaned = value.trim();
        if (!cleaned) {
            return Buffer.alloc(0);
        }
        if (/^[0-9a-f ]+$/iu.test(cleaned)) {
            return Buffer.from(cleaned.split(/\s+/u).map(part => Number.parseInt(part, 16)));
        }
        return Buffer.from(cleaned, 'utf8');
    }
    return Buffer.alloc(0);
}

function renderTree(tree) {
    return tree.map(node => {
        const rendered = {
            tag: node.tagName || node.tagHex,
            tagCode: node.tagHex,
            type: node.type,
        };
        if (node.children) {
            rendered.children = renderTree(node.children);
        } else {
            rendered.value = node.value;
        }
        return rendered;
    });
}

function walkTree(tree, callback) {
    for (const node of tree) {
        callback(node);
        if (node.children) {
            walkTree(node.children, callback);
        }
    }
}

function getKnownTagName(tagCode) {
    try {
        return getTagDefinition(tagCode).name;
    } catch {
        return undefined;
    }
}

module.exports = {
    buildPasswordBuffer,
    buildFrame,
    parseFrame,
    normalizeItem,
    renderTree,
    walkTree,
};
