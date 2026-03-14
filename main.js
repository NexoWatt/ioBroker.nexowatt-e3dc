'use strict';

const utils = require('@iobroker/adapter-core');
const { RscpClient } = require('./lib/rscp-client');
const { renderTree, walkTree } = require('./lib/rscp-codec');
const { TAGS } = require('./lib/rscp-tags');

const MODE_STATES = Object.freeze({
    0: 'AUTO',
    1: 'IDLE',
    2: 'DISCHARGE',
    3: 'CHARGE',
    4: 'GRID_CHARGE',
});

const EMS_SIMPLE_FIELDS = Object.freeze([
    field('EMS.POWER_PV', 'PV power', 'TAG_EMS_REQ_POWER_PV', 'TAG_EMS_POWER_PV', 'number', 'value.power', 'W'),
    field('EMS.POWER_BAT', 'Battery power', 'TAG_EMS_REQ_POWER_BAT', 'TAG_EMS_POWER_BAT', 'number', 'value.power', 'W'),
    field('EMS.POWER_HOME', 'Home power', 'TAG_EMS_REQ_POWER_HOME', 'TAG_EMS_POWER_HOME', 'number', 'value.power', 'W'),
    field('EMS.POWER_GRID', 'Grid power', 'TAG_EMS_REQ_POWER_GRID', 'TAG_EMS_POWER_GRID', 'number', 'value.power', 'W'),
    field('EMS.POWER_ADD', 'Additional source power', 'TAG_EMS_REQ_POWER_ADD', 'TAG_EMS_POWER_ADD', 'number', 'value.power', 'W'),
    field('EMS.BAT_SOC', 'Battery state of charge', 'TAG_EMS_REQ_BAT_SOC', 'TAG_EMS_BAT_SOC', 'number', 'value.battery', '%'),
    field('EMS.AUTARKY', 'Autarky', 'TAG_EMS_REQ_AUTARKY', 'TAG_EMS_AUTARKY', 'number', 'value', '%'),
    field(
        'EMS.SELF_CONSUMPTION',
        'Self-consumption',
        'TAG_EMS_REQ_SELF_CONSUMPTION',
        'TAG_EMS_SELF_CONSUMPTION',
        'number',
        'value',
        '%',
    ),
    field('EMS.MODE', 'Actual EMS mode', 'TAG_EMS_REQ_MODE', 'TAG_EMS_MODE', 'number', 'value.mode', undefined, {
        states: MODE_STATES,
    }),
    field('EMS.STATUS', 'EMS status', 'TAG_EMS_REQ_STATUS', 'TAG_EMS_STATUS', 'number', 'value'),
    field(
        'EMS.REMAINING_BAT_CHARGE_POWER',
        'Remaining battery charge power',
        'TAG_EMS_REQ_REMAINING_BAT_CHARGE_POWER',
        'TAG_EMS_REMAINING_BAT_CHARGE_POWER',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.REMAINING_BAT_DISCHARGE_POWER',
        'Remaining battery discharge power',
        'TAG_EMS_REQ_REMAINING_BAT_DISCHARGE_POWER',
        'TAG_EMS_REMAINING_BAT_DISCHARGE_POWER',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.USED_CHARGE_LIMIT',
        'Used charge limit',
        'TAG_EMS_REQ_USED_CHARGE_LIMIT',
        'TAG_EMS_USED_CHARGE_LIMIT',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.BAT_CHARGE_LIMIT',
        'Battery charge limit',
        'TAG_EMS_REQ_BAT_CHARGE_LIMIT',
        'TAG_EMS_BAT_CHARGE_LIMIT',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.DCDC_CHARGE_LIMIT',
        'DCDC charge limit',
        'TAG_EMS_REQ_DCDC_CHARGE_LIMIT',
        'TAG_EMS_DCDC_CHARGE_LIMIT',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.USER_CHARGE_LIMIT',
        'User charge limit',
        'TAG_EMS_REQ_USER_CHARGE_LIMIT',
        'TAG_EMS_USER_CHARGE_LIMIT',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.USED_DISCHARGE_LIMIT',
        'Used discharge limit',
        'TAG_EMS_REQ_USED_DISCHARGE_LIMIT',
        'TAG_EMS_USED_DISCHARGE_LIMIT',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.BAT_DISCHARGE_LIMIT',
        'Battery discharge limit',
        'TAG_EMS_REQ_BAT_DISCHARGE_LIMIT',
        'TAG_EMS_BAT_DISCHARGE_LIMIT',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.DCDC_DISCHARGE_LIMIT',
        'DCDC discharge limit',
        'TAG_EMS_REQ_DCDC_DISCHARGE_LIMIT',
        'TAG_EMS_DCDC_DISCHARGE_LIMIT',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.USER_DISCHARGE_LIMIT',
        'User discharge limit',
        'TAG_EMS_REQ_USER_DISCHARGE_LIMIT',
        'TAG_EMS_USER_DISCHARGE_LIMIT',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.EMERGENCY_POWER_STATUS',
        'Emergency power status',
        'TAG_EMS_REQ_EMERGENCY_POWER_STATUS',
        'TAG_EMS_EMERGENCY_POWER_STATUS',
        'number',
        'value',
    ),
    field(
        'EMS.COUPLING_MODE',
        'Coupling mode',
        'TAG_EMS_REQ_COUPLING_MODE',
        'TAG_EMS_COUPLING_MODE',
        'number',
        'value',
    ),
    field(
        'EMS.BALANCED_PHASES',
        'Balanced phases',
        'TAG_EMS_REQ_BALANCED_PHASES',
        'TAG_EMS_BALANCED_PHASES',
        'number',
        'value',
    ),
    field(
        'EMS.INSTALLED_PEAK_POWER',
        'Installed peak power',
        'TAG_EMS_REQ_INSTALLED_PEAK_POWER',
        'TAG_EMS_INSTALLED_PEAK_POWER',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.DERATE_AT_PERCENT_VALUE',
        'Derate at percent value',
        'TAG_EMS_REQ_DERATE_AT_PERCENT_VALUE',
        'TAG_EMS_DERATE_AT_PERCENT_VALUE',
        'number',
        'value',
        '%',
    ),
    field(
        'EMS.DERATE_AT_POWER_VALUE',
        'Derate at power value',
        'TAG_EMS_REQ_DERATE_AT_POWER_VALUE',
        'TAG_EMS_DERATE_AT_POWER_VALUE',
        'number',
        'value.power',
        'W',
    ),
    field(
        'EMS.ERROR_BUZZER_ENABLED',
        'Error buzzer enabled',
        'TAG_EMS_REQ_ERROR_BUZZER_ENABLED',
        'TAG_EMS_ERROR_BUZZER_ENABLED',
        'boolean',
        'switch.enable',
    ),
    field(
        'EMS.EXT_SRC_AVAILABLE',
        'External source available',
        'TAG_EMS_REQ_EXT_SRC_AVAILABLE',
        'TAG_EMS_EXT_SRC_AVAILABLE',
        'number',
        'value',
    ),
]);

const EMS_RESPONSE_TO_FIELD = Object.freeze(
    Object.fromEntries(EMS_SIMPLE_FIELDS.map(def => [def.res, def])),
);

const EMS_POWER_SETTING_FIELDS = Object.freeze({
    'EMS.POWER_LIMITS_USED': {
        writeTag: 'TAG_EMS_POWER_LIMITS_USED',
        responseTag: 'TAG_EMS_POWER_LIMITS_USED',
        common: {
            name: 'Power limits enabled',
            type: 'boolean',
            role: 'switch.enable',
            read: true,
            write: true,
        },
    },
    'EMS.MAX_CHARGE_POWER': {
        writeTag: 'TAG_EMS_MAX_CHARGE_POWER',
        responseTag: 'TAG_EMS_MAX_CHARGE_POWER',
        common: {
            name: 'Max charge power',
            type: 'number',
            role: 'level.power',
            read: true,
            write: true,
            unit: 'W',
        },
    },
    'EMS.MAX_DISCHARGE_POWER': {
        writeTag: 'TAG_EMS_MAX_DISCHARGE_POWER',
        responseTag: 'TAG_EMS_MAX_DISCHARGE_POWER',
        common: {
            name: 'Max discharge power',
            type: 'number',
            role: 'level.power',
            read: true,
            write: true,
            unit: 'W',
        },
    },
    'EMS.DISCHARGE_START_POWER': {
        writeTag: 'TAG_EMS_DISCHARGE_START_POWER',
        responseTag: 'TAG_EMS_DISCHARGE_START_POWER',
        common: {
            name: 'Discharge start power',
            type: 'number',
            role: 'level.power',
            read: true,
            write: true,
            unit: 'W',
        },
    },
    'EMS.POWERSAVE_ENABLED': {
        writeTag: 'TAG_EMS_POWERSAVE_ENABLED',
        responseTag: 'TAG_EMS_POWERSAVE_ENABLED',
        common: {
            name: 'Powersave enabled',
            type: 'boolean',
            role: 'switch.enable',
            read: true,
            write: true,
        },
    },
    'EMS.WEATHER_REGULATED_CHARGE_ENABLED': {
        writeTag: 'TAG_EMS_WEATHER_REGULATED_CHARGE_ENABLED',
        responseTag: 'TAG_EMS_WEATHER_REGULATED_CHARGE_ENABLED',
        common: {
            name: 'Weather-regulated charging enabled',
            type: 'boolean',
            role: 'switch.enable',
            read: true,
            write: true,
        },
    },
});

const EMS_POWER_SETTING_RESPONSE_TO_STATE = Object.freeze(
    Object.fromEntries(Object.entries(EMS_POWER_SETTING_FIELDS).map(([stateId, def]) => [def.responseTag, stateId])),
);

const CURATED_EMS_CHANNELS = Object.freeze([
    { id: 'objekte', type: 'channel', common: { name: 'Kuratiertes Objektverzeichnis' } },
    { id: 'objekte.ems', type: 'channel', common: { name: 'EMS Leitwarte' } },
    { id: 'objekte.ems.system', type: 'channel', common: { name: 'System' } },
    { id: 'objekte.ems.messwerte', type: 'channel', common: { name: 'Messwerte' } },
    { id: 'objekte.ems.steuerung', type: 'channel', common: { name: 'Steuerung' } },
]);

const CURATED_EMS_OBJECTS = Object.freeze([
    curatedState(
        'objekte.ems.system.verbunden',
        'info.connection',
        'Verbindung',
        'boolean',
        'indicator.connected',
        false,
        { def: false },
    ),
    curatedState(
        'objekte.ems.system.authentifizierung',
        'RSCP.AUTHENTICATION',
        'Authentifizierungslevel',
        'number',
        'value',
        false,
        { def: 0 },
    ),
    curatedState('objekte.ems.system.letzterFehler', 'info.lastError', 'Letzter Fehler', 'string', 'text', false, { def: '' }),

    curatedState('objekte.ems.messwerte.pvLeistung', 'EMS.POWER_PV', 'PV-Leistung', 'number', 'value.power', false, { unit: 'W' }),
    curatedState('objekte.ems.messwerte.batterieLeistung', 'EMS.POWER_BAT', 'Batterie-Leistung', 'number', 'value.power', false, { unit: 'W' }),
    curatedState('objekte.ems.messwerte.hausLeistung', 'EMS.POWER_HOME', 'Haus-Leistung', 'number', 'value.power', false, { unit: 'W' }),
    curatedState('objekte.ems.messwerte.netzLeistung', 'EMS.POWER_GRID', 'Netz-Leistung', 'number', 'value.power', false, { unit: 'W' }),
    curatedState('objekte.ems.messwerte.zusatzLeistung', 'EMS.POWER_ADD', 'Zusatz-Leistung', 'number', 'value.power', false, { unit: 'W' }),
    curatedState('objekte.ems.messwerte.batterieSoc', 'EMS.BAT_SOC', 'Batterie-SoC', 'number', 'value.battery', false, { unit: '%' }),
    curatedState('objekte.ems.messwerte.autarkie', 'EMS.AUTARKY', 'Autarkie', 'number', 'value', false, { unit: '%' }),
    curatedState('objekte.ems.messwerte.eigenverbrauch', 'EMS.SELF_CONSUMPTION', 'Eigenverbrauch', 'number', 'value', false, { unit: '%' }),
    curatedState('objekte.ems.messwerte.modusIst', 'EMS.MODE', 'Aktueller EMS-Modus', 'number', 'value.mode', false, { states: MODE_STATES }),
    curatedState(
        'objekte.ems.messwerte.restLadeLeistung',
        'EMS.REMAINING_BAT_CHARGE_POWER',
        'Rest-Ladeleistung',
        'number',
        'value.power',
        false,
        { unit: 'W' },
    ),
    curatedState(
        'objekte.ems.messwerte.restEntladeLeistung',
        'EMS.REMAINING_BAT_DISCHARGE_POWER',
        'Rest-Entladeleistung',
        'number',
        'value.power',
        false,
        { unit: 'W' },
    ),
    curatedState(
        'objekte.ems.messwerte.setPowerRueckmeldung',
        'EMS.SET_POWER',
        'SET_POWER Rückmeldung',
        'number',
        'value.power',
        false,
        { unit: 'W' },
    ),

    curatedState(
        'objekte.ems.steuerung.modusSoll',
        'EMS.SET_POWER_MODE',
        'Soll-Modus',
        'number',
        'level.mode',
        true,
        { def: 0, states: MODE_STATES },
    ),
    curatedState(
        'objekte.ems.steuerung.leistungSoll',
        'EMS.SET_POWER_VALUE',
        'Soll-Leistung',
        'number',
        'level.power',
        true,
        { def: 0, unit: 'W' },
    ),
    curatedState(
        'objekte.ems.steuerung.powerLimitsAktiv',
        'EMS.POWER_LIMITS_USED',
        'Power-Limits aktiv',
        'boolean',
        'switch.enable',
        true,
    ),
    curatedState(
        'objekte.ems.steuerung.maxLadeLeistung',
        'EMS.MAX_CHARGE_POWER',
        'Maximale Ladeleistung',
        'number',
        'level.power',
        true,
        { unit: 'W' },
    ),
    curatedState(
        'objekte.ems.steuerung.maxEntladeLeistung',
        'EMS.MAX_DISCHARGE_POWER',
        'Maximale Entladeleistung',
        'number',
        'level.power',
        true,
        { unit: 'W' },
    ),
    curatedState(
        'objekte.ems.steuerung.entladeStartLeistung',
        'EMS.DISCHARGE_START_POWER',
        'Entlade-Startleistung',
        'number',
        'level.power',
        true,
        { unit: 'W' },
    ),
    curatedState(
        'objekte.ems.steuerung.powersaveAktiv',
        'EMS.POWERSAVE_ENABLED',
        'Powersave aktiv',
        'boolean',
        'switch.enable',
        true,
    ),
    curatedState(
        'objekte.ems.steuerung.wettergeregeltesLadenAktiv',
        'EMS.WEATHER_REGULATED_CHARGE_ENABLED',
        'Wettergeregeltes Laden aktiv',
        'boolean',
        'switch.enable',
        true,
    ),
    curatedState(
        'objekte.ems.steuerung.idlePeriodsJson',
        'EMS.IDLE_PERIODS_JSON',
        'Idle Periods JSON',
        'string',
        'json',
        true,
        { def: '[]' },
    ),
]);

const CURATED_TARGET_TO_SOURCE = Object.freeze(
    Object.fromEntries(CURATED_EMS_OBJECTS.map(def => [def.id, def.sourceId])),
);

const CURATED_SOURCE_TO_TARGETS = Object.freeze(
    CURATED_EMS_OBJECTS.reduce((acc, def) => {
        (acc[def.sourceId] ||= []).push(def.id);
        return acc;
    }, {}),
);

const CURATED_WRITABLE_TARGETS = new Set(CURATED_EMS_OBJECTS.filter(def => def.common.write).map(def => def.id));

const BAT_FIELDS = Object.freeze({
    TAG_BAT_RSOC: dynField('RSOC', 'Relative state of charge', 'number', 'value.battery', '%', 'TAG_BAT_REQ_RSOC'),
    TAG_BAT_MODULE_VOLTAGE: dynField(
        'MODULE_VOLTAGE',
        'Module voltage',
        'number',
        'value.voltage',
        'V',
        'TAG_BAT_REQ_MODULE_VOLTAGE',
    ),
    TAG_BAT_CURRENT: dynField('CURRENT', 'Current', 'number', 'value.current', 'A', 'TAG_BAT_REQ_CURRENT'),
    TAG_BAT_MAX_BAT_VOLTAGE: dynField(
        'MAX_BAT_VOLTAGE',
        'Max battery voltage',
        'number',
        'value.voltage',
        'V',
        'TAG_BAT_REQ_MAX_BAT_VOLTAGE',
    ),
    TAG_BAT_MAX_CHARGE_CURRENT: dynField(
        'MAX_CHARGE_CURRENT',
        'Max charge current',
        'number',
        'value.current',
        'A',
        'TAG_BAT_REQ_MAX_CHARGE_CURRENT',
    ),
    TAG_BAT_MAX_DISCHARGE_CURRENT: dynField(
        'MAX_DISCHARGE_CURRENT',
        'Max discharge current',
        'number',
        'value.current',
        'A',
        'TAG_BAT_REQ_MAX_DISCHARGE_CURRENT',
    ),
    TAG_BAT_CHARGE_CYCLES: dynField(
        'CHARGE_CYCLES',
        'Charge cycles',
        'number',
        'value',
        undefined,
        'TAG_BAT_REQ_CHARGE_CYCLES',
    ),
    TAG_BAT_TERMINAL_VOLTAGE: dynField(
        'TERMINAL_VOLTAGE',
        'Terminal voltage',
        'number',
        'value.voltage',
        'V',
        'TAG_BAT_REQ_TERMINAL_VOLTAGE',
    ),
    TAG_BAT_STATUS_CODE: dynField(
        'STATUS_CODE',
        'Status code',
        'string',
        'text',
        undefined,
        'TAG_BAT_REQ_STATUS_CODE',
    ),
    TAG_BAT_ERROR_CODE: dynField(
        'ERROR_CODE',
        'Error code',
        'string',
        'text',
        undefined,
        'TAG_BAT_REQ_ERROR_CODE',
    ),
    TAG_BAT_DEVICE_NAME: dynField(
        'DEVICE_NAME',
        'Device name',
        'string',
        'text',
        undefined,
        'TAG_BAT_REQ_DEVICE_NAME',
    ),
    TAG_BAT_DCB_COUNT: dynField('DCB_COUNT', 'DCB count', 'number', 'value', undefined, 'TAG_BAT_REQ_DCB_COUNT'),
    TAG_BAT_MAX_DCB_CELL_TEMPERATURE: dynField(
        'MAX_DCB_CELL_TEMPERATURE',
        'Max DCB cell temperature',
        'number',
        'value.temperature',
        '°C',
        'TAG_BAT_REQ_MAX_DCB_CELL_TEMPERATURE',
    ),
    TAG_BAT_MIN_DCB_CELL_TEMPERATURE: dynField(
        'MIN_DCB_CELL_TEMPERATURE',
        'Min DCB cell temperature',
        'number',
        'value.temperature',
        '°C',
        'TAG_BAT_REQ_MIN_DCB_CELL_TEMPERATURE',
    ),
    TAG_BAT_READY_FOR_SHUTDOWN: dynField(
        'READY_FOR_SHUTDOWN',
        'Ready for shutdown',
        'boolean',
        'indicator',
        undefined,
        'TAG_BAT_REQ_READY_FOR_SHUTDOWN',
    ),
    TAG_BAT_TRAINING_MODE: dynField(
        'TRAINING_MODE',
        'Training mode',
        'number',
        'value.mode',
        undefined,
        'TAG_BAT_REQ_TRAINING_MODE',
    ),
});

const PVI_SIMPLE_FIELDS = Object.freeze({
    TAG_PVI_ON_GRID: dynField('ON_GRID', 'On grid', 'boolean', 'indicator', undefined, 'TAG_PVI_REQ_ON_GRID'),
    TAG_PVI_STATE: dynField('STATE', 'State', 'string', 'text', undefined, 'TAG_PVI_REQ_STATE'),
    TAG_PVI_LAST_ERROR: dynField('LAST_ERROR', 'Last error', 'string', 'text', undefined, 'TAG_PVI_REQ_LAST_ERROR'),
    TAG_PVI_TYPE: dynField('TYPE', 'Type', 'number', 'value', undefined, 'TAG_PVI_REQ_TYPE'),
    TAG_PVI_SYSTEM_MODE: dynField(
        'SYSTEM_MODE',
        'System mode',
        'number',
        'value.mode',
        undefined,
        'TAG_PVI_REQ_SYSTEM_MODE',
    ),
    TAG_PVI_POWER_MODE: dynField(
        'POWER_MODE',
        'Power mode',
        'number',
        'value.mode',
        undefined,
        'TAG_PVI_REQ_POWER_MODE',
    ),
    TAG_PVI_SERIAL_NUMBER: dynField(
        'SERIAL_NUMBER',
        'Serial number',
        'string',
        'text',
        undefined,
        'TAG_PVI_REQ_SERIAL_NUMBER',
    ),
    TAG_PVI_AC_MAX_PHASE_COUNT: dynField(
        'AC_MAX_PHASE_COUNT',
        'AC max phase count',
        'number',
        'value',
        undefined,
        'TAG_PVI_REQ_AC_MAX_PHASE_COUNT',
    ),
    TAG_PVI_DC_MAX_STRING_COUNT: dynField(
        'DC_MAX_STRING_COUNT',
        'DC max string count',
        'number',
        'value',
        undefined,
        'TAG_PVI_REQ_DC_MAX_STRING_COUNT',
    ),
});

const PVI_CONTAINER_FIELDS = Object.freeze({
    TAG_PVI_AC_POWER: dynContainerField('AC_PHASE', 'POWER', 'AC phase power', 'number', 'value.power', 'W', 'TAG_PVI_REQ_AC_POWER'),
    TAG_PVI_AC_VOLTAGE: dynContainerField(
        'AC_PHASE',
        'VOLTAGE',
        'AC phase voltage',
        'number',
        'value.voltage',
        'V',
        'TAG_PVI_REQ_AC_VOLTAGE',
    ),
    TAG_PVI_AC_CURRENT: dynContainerField(
        'AC_PHASE',
        'CURRENT',
        'AC phase current',
        'number',
        'value.current',
        'A',
        'TAG_PVI_REQ_AC_CURRENT',
    ),
    TAG_PVI_AC_ENERGY_DAY: dynContainerField(
        'AC_PHASE',
        'ENERGY_DAY',
        'AC phase energy day',
        'number',
        'value.energy',
        'Wh',
        'TAG_PVI_REQ_AC_ENERGY_DAY',
    ),
    TAG_PVI_DC_POWER: dynContainerField(
        'DC_STRING',
        'POWER',
        'DC string power',
        'number',
        'value.power',
        'W',
        'TAG_PVI_REQ_DC_POWER',
    ),
    TAG_PVI_DC_VOLTAGE: dynContainerField(
        'DC_STRING',
        'VOLTAGE',
        'DC string voltage',
        'number',
        'value.voltage',
        'V',
        'TAG_PVI_REQ_DC_VOLTAGE',
    ),
    TAG_PVI_DC_CURRENT: dynContainerField(
        'DC_STRING',
        'CURRENT',
        'DC string current',
        'number',
        'value.current',
        'A',
        'TAG_PVI_REQ_DC_CURRENT',
    ),
    TAG_PVI_DC_STRING_ENERGY_ALL: dynContainerField(
        'DC_STRING',
        'ENERGY_ALL',
        'DC string energy total',
        'number',
        'value.energy',
        'Wh',
        'TAG_PVI_REQ_DC_STRING_ENERGY_ALL',
    ),
});

const WB_FIELDS = Object.freeze({
    TAG_WB_ENERGY_ALL: dynField('ENERGY_ALL', 'Energy total', 'number', 'value.energy', 'Wh', 'TAG_WB_REQ_ENERGY_ALL'),
    TAG_WB_ENERGY_SOLAR: dynField(
        'ENERGY_SOLAR',
        'Solar energy',
        'number',
        'value.energy',
        'Wh',
        'TAG_WB_REQ_ENERGY_SOLAR',
    ),
    TAG_WB_SOC: dynField('SOC', 'Car state of charge', 'number', 'value.battery', '%', 'TAG_WB_REQ_SOC'),
    TAG_WB_STATUS: dynField('STATUS', 'Status', 'number', 'value', undefined, 'TAG_WB_REQ_STATUS'),
    TAG_WB_ERROR_CODE: dynField(
        'ERROR_CODE',
        'Error code',
        'number',
        'value',
        undefined,
        'TAG_WB_REQ_ERROR_CODE',
    ),
    TAG_WB_MODE: dynField('MODE', 'Mode', 'number', 'value.mode', undefined, 'TAG_WB_REQ_MODE'),
    TAG_WB_PM_POWER_L1: dynField('PM_POWER_L1', 'PM power L1', 'number', 'value.power', 'W', 'TAG_WB_REQ_PM_POWER_L1'),
    TAG_WB_PM_POWER_L2: dynField('PM_POWER_L2', 'PM power L2', 'number', 'value.power', 'W', 'TAG_WB_REQ_PM_POWER_L2'),
    TAG_WB_PM_POWER_L3: dynField('PM_POWER_L3', 'PM power L3', 'number', 'value.power', 'W', 'TAG_WB_REQ_PM_POWER_L3'),
    TAG_WB_PM_ACTIVE_PHASES: dynField(
        'PM_ACTIVE_PHASES',
        'PM active phases',
        'number',
        'value',
        undefined,
        'TAG_WB_REQ_PM_ACTIVE_PHASES',
    ),
    TAG_WB_PM_MODE: dynField('PM_MODE', 'PM mode', 'number', 'value.mode', undefined, 'TAG_WB_REQ_PM_MODE'),
    TAG_WB_PM_ENERGY_L1: dynField(
        'PM_ENERGY_L1',
        'PM energy L1',
        'number',
        'value.energy',
        'Wh',
        'TAG_WB_REQ_PM_ENERGY_L1',
    ),
    TAG_WB_PM_ENERGY_L2: dynField(
        'PM_ENERGY_L2',
        'PM energy L2',
        'number',
        'value.energy',
        'Wh',
        'TAG_WB_REQ_PM_ENERGY_L2',
    ),
    TAG_WB_PM_ENERGY_L3: dynField(
        'PM_ENERGY_L3',
        'PM energy L3',
        'number',
        'value.energy',
        'Wh',
        'TAG_WB_REQ_PM_ENERGY_L3',
    ),
});

function field(stateId, name, req, res, type, role, unit, extra) {
    return {
        stateId,
        req,
        res,
        common: {
            name,
            type,
            role,
            read: true,
            write: false,
            ...(unit ? { unit } : {}),
            ...(extra || {}),
        },
    };
}

function dynField(suffix, name, type, role, unit, req) {
    return { suffix, name, type, role, unit, req };
}

function dynContainerField(groupPrefix, suffix, name, type, role, unit, req) {
    return { groupPrefix, suffix, name, type, role, unit, req };
}

function parseNumberList(value, fallback) {
    const list = String(value === undefined || value === null ? '' : value)
        .split(',')
        .map(part => Number(part.trim()))
        .filter(num => Number.isInteger(num) && num >= 0);
    const unique = [...new Set(list)];
    return unique.length ? unique : [...fallback];
}

function boolValue(value, fallback) {
    if (value === undefined || value === null || value === '') {
        return fallback;
    }
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'number') {
        return value !== 0;
    }
    const normalized = String(value).trim().toLowerCase();
    return !['0', 'false', 'off', 'no', 'nein'].includes(normalized);
}

function normalizeByType(type, value) {
    if (type === 'boolean') {
        return Boolean(value);
    }
    if (type === 'number') {
        return value === null || value === undefined || value === '' ? null : Number(value);
    }
    return value === null || value === undefined ? '' : String(value);
}

function buildStateCommon(name, type, role, read, write, extra) {
    return {
        name,
        type,
        role,
        read,
        write,
        ...(extra || {}),
    };
}

function curatedState(id, sourceId, name, type, role, write, extra) {
    return {
        id,
        sourceId,
        common: buildStateCommon(name, type, role, true, write, extra),
    };
}

function prettyJson(value) {
    return JSON.stringify(value, null, 2);
}

function getChild(node, tagName) {
    return node && Array.isArray(node.children) ? node.children.find(child => child.tagName === tagName) : undefined;
}

function getChildren(node, tagName) {
    return node && Array.isArray(node.children) ? node.children.filter(child => child.tagName === tagName) : [];
}

function getChildValue(node, tagName, fallback) {
    const child = getChild(node, tagName);
    if (!child || child.children) {
        return fallback;
    }
    return child.value;
}

function buildIdlePeriodPayload(period) {
    const start = period && typeof period === 'object' ? period.start || {} : {};
    const end = period && typeof period === 'object' ? period.end || {} : {};
    return {
        tag: 'TAG_EMS_IDLE_PERIOD',
        children: [
            { tag: 'TAG_EMS_IDLE_PERIOD_TYPE', value: Number(period && period.type !== undefined ? period.type : 0) },
            { tag: 'TAG_EMS_IDLE_PERIOD_DAY', value: Number(period && period.day !== undefined ? period.day : 0) },
            { tag: 'TAG_EMS_IDLE_PERIOD_ACTIVE', value: !!(period && period.active) },
            {
                tag: 'TAG_EMS_IDLE_PERIOD_START',
                children: [
                    { tag: 'TAG_EMS_IDLE_PERIOD_HOUR', value: Number(start.hour || 0) },
                    { tag: 'TAG_EMS_IDLE_PERIOD_MINUTE', value: Number(start.minute || 0) },
                ],
            },
            {
                tag: 'TAG_EMS_IDLE_PERIOD_END',
                children: [
                    { tag: 'TAG_EMS_IDLE_PERIOD_HOUR', value: Number(end.hour || 0) },
                    { tag: 'TAG_EMS_IDLE_PERIOD_MINUTE', value: Number(end.minute || 0) },
                ],
            },
        ],
    };
}

class NexowattE3dc extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'nexowatt-e3dc',
        });

        this.client = null;
        this.runtime = null;
        this.pollTimer = null;
        this.reconnectTimer = null;
        this.setPowerTimer = null;
        this.setPowerRepeatTimer = null;
        this.powerSettingsTimer = null;
        this.idlePeriodsTimer = null;
        this.pendingPowerSettingStates = new Set();
        this.pendingIdlePeriodsWrite = null;
        this.pollInProgress = false;

        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    buildRuntimeConfig() {
        return {
            pollEms: boolValue(this.config.pollEms, true),
            enableBat: boolValue(this.config.enableBat, true),
            enablePvi: boolValue(this.config.enablePvi, true),
            enableWb: boolValue(this.config.enableWb, false),
            enableIdlePeriods: boolValue(this.config.enableIdlePeriods, true),
            batIndices: parseNumberList(this.config.batIndices, [0]),
            pviIndices: parseNumberList(this.config.pviIndices, [0]),
            pviPhaseIndices: parseNumberList(this.config.pviPhaseIndices, [0, 1, 2]),
            pviStringIndices: parseNumberList(this.config.pviStringIndices, [0, 1]),
            wbIndices: parseNumberList(this.config.wbIndices, [0]),
        };
    }

    setStateMirrored(id, value, ack) {
        super.setState(id, value, ack);
        if (!ack) {
            return;
        }

        const mirrorIds = CURATED_SOURCE_TO_TARGETS[id];
        if (!mirrorIds) {
            return;
        }

        for (const mirrorId of mirrorIds) {
            super.setState(mirrorId, value, true);
        }
    }

    async onReady() {
        this.runtime = this.buildRuntimeConfig();
        await this.ensureObjects();

        this.subscribeStates('EMS.SET_POWER_MODE');
        this.subscribeStates('EMS.SET_POWER_VALUE');
        this.subscribeStates('EMS.IDLE_PERIODS_JSON');
        for (const stateId of Object.keys(EMS_POWER_SETTING_FIELDS)) {
            this.subscribeStates(stateId);
        }
        for (const def of CURATED_EMS_OBJECTS.filter(entry => entry.common.write)) {
            this.subscribeStates(def.id);
        }
        this.subscribeStates('RAW.REQUEST_JSON');

        this.setStateMirrored('info.connection', false, true);
        this.setStateMirrored('info.lastError', '', true);
        this.setStateMirrored('RSCP.AUTHENTICATION', 0, true);
        this.setStateMirrored('RSCP.TAGS_LOADED', Object.keys(TAGS).length, true);

        await this.connectClient();
    }

    buildStaticStateDefinitions() {
        return [
            {
                id: 'info.connection',
                common: buildStateCommon('Connection', 'boolean', 'indicator.connected', true, false, { def: false }),
            },
            {
                id: 'info.lastError',
                common: buildStateCommon('Last error', 'string', 'text', true, false, { def: '' }),
            },
            {
                id: 'RSCP.AUTHENTICATION',
                common: buildStateCommon('Authentication level', 'number', 'value', true, false, { def: 0 }),
            },
            {
                id: 'RSCP.TAGS_LOADED',
                common: buildStateCommon('Loaded official RSCP tags', 'number', 'value', true, false, {
                    def: Object.keys(TAGS).length,
                }),
            },
            ...EMS_SIMPLE_FIELDS.map(def => ({ id: def.stateId, common: def.common })),
            {
                id: 'EMS.SET_POWER',
                common: buildStateCommon('Last SET_POWER response value', 'number', 'value.power', true, false, {
                    unit: 'W',
                }),
            },
            {
                id: 'EMS.SET_POWER_MODE',
                common: buildStateCommon('Desired manual power mode', 'number', 'level.mode', true, true, {
                    def: 0,
                    states: MODE_STATES,
                }),
            },
            {
                id: 'EMS.SET_POWER_VALUE',
                common: buildStateCommon('Desired manual power value', 'number', 'level.power', true, true, {
                    def: 0,
                    unit: 'W',
                }),
            },
            ...Object.entries(EMS_POWER_SETTING_FIELDS).map(([id, def]) => ({ id, common: def.common })),
            {
                id: 'EMS.IDLE_PERIODS_JSON',
                common: buildStateCommon('Idle periods as JSON', 'string', 'json', true, true, { def: '[]' }),
            },
            {
                id: 'EMS.IDLE_PERIOD_CHANGE_MARKER',
                common: buildStateCommon('Idle period change marker', 'number', 'value', true, false, { def: 0 }),
            },
            {
                id: 'RAW.REQUEST_JSON',
                common: buildStateCommon('Custom RSCP request as JSON', 'string', 'json', true, true, { def: '' }),
            },
            {
                id: 'RAW.LAST_RESPONSE_JSON',
                common: buildStateCommon('Last custom RSCP response as JSON', 'string', 'json', true, false, {
                    def: '',
                }),
            },
            {
                id: 'RAW.LAST_ERROR',
                common: buildStateCommon('Last custom RSCP error', 'string', 'text', true, false, { def: '' }),
            },
        ];
    }

    buildCuratedStateDefinitions() {
        return [
            ...CURATED_EMS_CHANNELS,
            ...CURATED_EMS_OBJECTS.map(def => ({ id: def.id, common: def.common })),
        ];
    }

    buildDynamicStateDefinitions() {
        const defs = [
            {
                id: 'EMS',
                type: 'channel',
                common: { name: 'Energy Management System' },
            },
        ];
        if (this.runtime.enableBat) {
            defs.push({ id: 'BAT', type: 'channel', common: { name: 'Battery' } });
            for (const index of this.runtime.batIndices) {
                defs.push({ id: `BAT.${index}`, type: 'channel', common: { name: `Battery ${index}` } });
                for (const def of Object.values(BAT_FIELDS)) {
                    defs.push({
                        id: `BAT.${index}.${def.suffix}`,
                        common: buildStateCommon(def.name, def.type, def.role, true, false, def.unit ? { unit: def.unit } : {}),
                    });
                }
            }
        }

        if (this.runtime.enablePvi) {
            defs.push({ id: 'PVI', type: 'channel', common: { name: 'PV inverter' } });
            for (const pviIndex of this.runtime.pviIndices) {
                defs.push({ id: `PVI.${pviIndex}`, type: 'channel', common: { name: `PVI ${pviIndex}` } });
                for (const def of Object.values(PVI_SIMPLE_FIELDS)) {
                    defs.push({
                        id: `PVI.${pviIndex}.${def.suffix}`,
                        common: buildStateCommon(def.name, def.type, def.role, true, false, def.unit ? { unit: def.unit } : {}),
                    });
                }
                defs.push({
                    id: `PVI.${pviIndex}.VERSION_MAIN`,
                    common: buildStateCommon('Version main', 'string', 'text', true, false),
                });
                defs.push({
                    id: `PVI.${pviIndex}.VERSION_PIC`,
                    common: buildStateCommon('Version PIC', 'string', 'text', true, false),
                });
                defs.push({
                    id: `PVI.${pviIndex}.VERSION_JSON`,
                    common: buildStateCommon('Version JSON', 'string', 'json', true, false, { def: '{}' }),
                });

                for (const phaseIndex of this.runtime.pviPhaseIndices) {
                    defs.push({
                        id: `PVI.${pviIndex}.AC_PHASE_${phaseIndex}`,
                        type: 'channel',
                        common: { name: `PVI ${pviIndex} AC phase ${phaseIndex}` },
                    });
                    for (const def of Object.values(PVI_CONTAINER_FIELDS).filter(entry => entry.groupPrefix === 'AC_PHASE')) {
                        defs.push({
                            id: `PVI.${pviIndex}.AC_PHASE_${phaseIndex}.${def.suffix}`,
                            common: buildStateCommon(def.name, def.type, def.role, true, false, def.unit ? { unit: def.unit } : {}),
                        });
                    }
                }

                for (const stringIndex of this.runtime.pviStringIndices) {
                    defs.push({
                        id: `PVI.${pviIndex}.DC_STRING_${stringIndex}`,
                        type: 'channel',
                        common: { name: `PVI ${pviIndex} DC string ${stringIndex}` },
                    });
                    for (const def of Object.values(PVI_CONTAINER_FIELDS).filter(entry => entry.groupPrefix === 'DC_STRING')) {
                        defs.push({
                            id: `PVI.${pviIndex}.DC_STRING_${stringIndex}.${def.suffix}`,
                            common: buildStateCommon(def.name, def.type, def.role, true, false, def.unit ? { unit: def.unit } : {}),
                        });
                    }
                }
            }
        }

        if (this.runtime.enableWb) {
            defs.push({ id: 'WB', type: 'channel', common: { name: 'Wallbox' } });
            for (const index of this.runtime.wbIndices) {
                defs.push({ id: `WB.${index}`, type: 'channel', common: { name: `Wallbox ${index}` } });
                for (const def of Object.values(WB_FIELDS)) {
                    defs.push({
                        id: `WB.${index}.${def.suffix}`,
                        common: buildStateCommon(def.name, def.type, def.role, true, false, def.unit ? { unit: def.unit } : {}),
                    });
                }
            }
        }

        return defs;
    }

    async ensureObjects() {
        const topChannels = [
            { id: 'info', type: 'channel', common: { name: 'Information' } },
            { id: 'RSCP', type: 'channel', common: { name: 'RSCP' } },
            { id: 'RAW', type: 'channel', common: { name: 'Raw RSCP access' } },
        ];
        for (const obj of topChannels) {
            await this.setObjectNotExistsAsync(obj.id, { type: obj.type, common: obj.common, native: {} });
        }

        const defs = [...this.buildStaticStateDefinitions(), ...this.buildDynamicStateDefinitions(), ...this.buildCuratedStateDefinitions()];
        for (const def of defs) {
            await this.setObjectNotExistsAsync(def.id, {
                type: def.type || 'state',
                common: def.common,
                native: {},
            });
        }
    }

    async connectClient() {
        this.clearReconnectTimer();
        this.clearPolling();
        this.clearSetPowerRepeat();

        if (this.client) {
            this.client.disconnect();
            this.client = null;
        }

        if (!this.config.host || !this.config.port) {
            const message = 'Missing E3/DC host or port in adapter configuration';
            this.log.error(message);
            this.setStateMirrored('info.lastError', message, true);
            return;
        }

        this.client = new RscpClient(
            {
                host: this.config.host,
                port: Number(this.config.port) || 5033,
                portalUser: this.config.portalUser || '',
                portalPassword: this.config.portalPassword || '',
                rscpPassword: this.config.rscpPassword || '',
                requestTimeoutMs: Number(this.config.requestTimeoutMs) || 8000,
            },
            this.log,
        );

        this.client.on('connected', () => {
            this.log.info(`Connected to E3/DC at ${this.config.host}:${this.config.port}`);
            this.setStateMirrored('info.connection', true, true);
            this.setStateMirrored('info.lastError', '', true);
        });

        this.client.on('disconnected', () => {
            this.setStateMirrored('info.connection', false, true);
            this.setStateMirrored('RSCP.AUTHENTICATION', 0, true);
            this.clearPolling();
            this.clearSetPowerRepeat();
            this.scheduleReconnect();
        });

        this.client.on('authenticated', level => {
            this.setStateMirrored('RSCP.AUTHENTICATION', level, true);
            if (level >= 10) {
                this.log.info(`RSCP authentication successful (level ${level})`);
                this.setStateMirrored('info.lastError', '', true);
                this.startPolling();
            } else {
                const message = `RSCP authentication failed (level ${level})`;
                this.log.error(message);
                this.setStateMirrored('info.lastError', message, true);
                this.clearPolling();
                this.clearSetPowerRepeat();
            }
        });

        this.client.on('frame', frame => {
            this.processFrame(frame);
        });

        this.client.on('error', error => {
            this.log.warn(`RSCP error: ${error.message}`);
            this.setStateMirrored('info.lastError', error.message, true);
        });

        try {
            await this.client.connect();
        } catch (error) {
            this.log.error(`Could not connect to E3/DC: ${error.message}`);
            this.setStateMirrored('info.connection', false, true);
            this.setStateMirrored('info.lastError', error.message, true);
            this.scheduleReconnect();
        }
    }

    startPolling() {
        this.clearPolling();
        this.pollOnce().catch(error => {
            this.log.warn(`Initial polling failed: ${error.message}`);
        });

        const intervalMs = Math.max(5000, Number(this.config.pollIntervalSec || 15) * 1000);
        this.pollTimer = this.setInterval(() => {
            this.pollOnce().catch(error => {
                this.log.warn(`Polling failed: ${error.message}`);
            });
        }, intervalMs);
    }

    async pollOnce() {
        if (!this.client || !this.client.authenticated || this.pollInProgress) {
            return;
        }

        this.pollInProgress = true;
        try {
            if (this.runtime.pollEms) {
                const emsItems = EMS_SIMPLE_FIELDS.map(def => ({ tag: def.req })).concat([{ tag: 'TAG_EMS_REQ_GET_POWER_SETTINGS' }]);
                await this.client.sendItems(emsItems);
            }

            if (this.runtime.enableIdlePeriods) {
                await this.client.sendItems([{ tag: 'TAG_EMS_REQ_GET_IDLE_PERIODS' }]);
            }

            if (this.runtime.enableBat) {
                for (const index of this.runtime.batIndices) {
                    const children = [{ tag: 'TAG_BAT_INDEX', value: index }];
                    for (const def of Object.values(BAT_FIELDS)) {
                        children.push({ tag: def.req });
                    }
                    await this.client.sendItems([{ tag: 'TAG_BAT_REQ_DATA', children }]);
                }
            }

            if (this.runtime.enablePvi) {
                for (const pviIndex of this.runtime.pviIndices) {
                    const children = [{ tag: 'TAG_PVI_INDEX', value: pviIndex }];
                    for (const def of Object.values(PVI_SIMPLE_FIELDS)) {
                        children.push({ tag: def.req });
                    }
                    children.push({ tag: 'TAG_PVI_REQ_VERSION' });

                    for (const phaseIndex of this.runtime.pviPhaseIndices) {
                        for (const def of Object.values(PVI_CONTAINER_FIELDS).filter(entry => entry.groupPrefix === 'AC_PHASE')) {
                            children.push({ tag: def.req, value: phaseIndex });
                        }
                    }
                    for (const stringIndex of this.runtime.pviStringIndices) {
                        for (const def of Object.values(PVI_CONTAINER_FIELDS).filter(entry => entry.groupPrefix === 'DC_STRING')) {
                            children.push({ tag: def.req, value: stringIndex });
                        }
                    }

                    await this.client.sendItems([{ tag: 'TAG_PVI_REQ_DATA', children }]);
                }
            }

            if (this.runtime.enableWb) {
                for (const index of this.runtime.wbIndices) {
                    const children = [{ tag: 'TAG_WB_INDEX', value: index }];
                    for (const def of Object.values(WB_FIELDS)) {
                        children.push({ tag: def.req });
                    }
                    await this.client.sendItems([{ tag: 'TAG_WB_REQ_DATA', children }]);
                }
            }
        } finally {
            this.pollInProgress = false;
        }
    }

    processFrame(frame) {
        walkTree(frame.tree, node => {
            if (node.type === 'Error') {
                const message = `RSCP error on ${node.tagName || node.tagHex}: ${node.value}`;
                this.log.warn(message);
                this.setStateMirrored('info.lastError', message, true);
                return;
            }

            if (node.tagName === 'TAG_BAT_DATA' && node.children) {
                this.processBatData(node);
                return;
            }
            if (node.tagName === 'TAG_PVI_DATA' && node.children) {
                this.processPviData(node);
                return;
            }
            if (node.tagName === 'TAG_WB_DATA' && node.children) {
                this.processWbData(node);
                return;
            }
            if (node.tagName === 'TAG_EMS_GET_IDLE_PERIODS' && node.children) {
                this.processIdlePeriods(node);
                return;
            }

            if (node.tagName && EMS_RESPONSE_TO_FIELD[node.tagName] && !node.children) {
                const def = EMS_RESPONSE_TO_FIELD[node.tagName];
                this.setStateMirrored(def.stateId, normalizeByType(def.common.type, node.value), true);
            }

            if (node.tagName && EMS_POWER_SETTING_RESPONSE_TO_STATE[node.tagName] && !node.children) {
                const stateId = EMS_POWER_SETTING_RESPONSE_TO_STATE[node.tagName];
                const type = EMS_POWER_SETTING_FIELDS[stateId].common.type;
                this.setStateMirrored(stateId, normalizeByType(type, node.value), true);
            }

            if (node.tagName === 'TAG_EMS_SET_POWER' && !node.children) {
                this.setStateMirrored('EMS.SET_POWER', normalizeByType('number', node.value), true);
            }

            if (node.tagName && node.tagName.startsWith('TAG_EMS_RES_') && !node.children) {
                const result = Number(node.value);
                if (result < 0) {
                    const message = `Write result ${node.tagName}: ${result}`;
                    this.log.warn(message);
                    this.setStateMirrored('info.lastError', message, true);
                }
            }
        });
    }

    processBatData(container) {
        const index = Number(getChildValue(container, 'TAG_BAT_INDEX', 0));
        for (const child of container.children) {
            const def = BAT_FIELDS[child.tagName];
            if (!def || child.children) {
                continue;
            }
            this.setStateMirrored(`BAT.${index}.${def.suffix}`, normalizeByType(def.type, child.value), true);
        }
    }

    processPviData(container) {
        const pviIndex = Number(getChildValue(container, 'TAG_PVI_INDEX', 0));

        for (const child of container.children) {
            const def = PVI_SIMPLE_FIELDS[child.tagName];
            if (def && !child.children) {
                this.setStateMirrored(`PVI.${pviIndex}.${def.suffix}`, normalizeByType(def.type, child.value), true);
                continue;
            }

            if (child.tagName === 'TAG_PVI_VERSION' && child.children) {
                const version = {};
                for (const part of child.children) {
                    if (part.tagName === 'TAG_PVI_VERSION_MAIN' && !part.children) {
                        version.main = String(part.value || '');
                        this.setStateMirrored(`PVI.${pviIndex}.VERSION_MAIN`, version.main, true);
                    } else if (part.tagName === 'TAG_PVI_VERSION_PIC' && !part.children) {
                        version.pic = String(part.value || '');
                        this.setStateMirrored(`PVI.${pviIndex}.VERSION_PIC`, version.pic, true);
                    }
                }
                this.setStateMirrored(`PVI.${pviIndex}.VERSION_JSON`, prettyJson(version), true);
                continue;
            }

            const cDef = PVI_CONTAINER_FIELDS[child.tagName];
            if (cDef && child.children) {
                const entryIndex = Number(getChildValue(child, 'TAG_PVI_INDEX', 0));
                const valueNode = getChild(child, 'TAG_PVI_VALUE');
                const value = valueNode && !valueNode.children ? valueNode.value : null;
                this.setStateMirrored(
                    `PVI.${pviIndex}.${cDef.groupPrefix}_${entryIndex}.${cDef.suffix}`,
                    normalizeByType(cDef.type, value),
                    true,
                );
            }
        }
    }

    processWbData(container) {
        const index = Number(getChildValue(container, 'TAG_WB_INDEX', 0));
        for (const child of container.children) {
            const def = WB_FIELDS[child.tagName];
            if (!def || child.children) {
                continue;
            }
            this.setStateMirrored(`WB.${index}.${def.suffix}`, normalizeByType(def.type, child.value), true);
        }
    }

    processIdlePeriods(container) {
        const periods = [];
        let changeMarker = null;

        for (const child of container.children) {
            if (child.tagName === 'TAG_EMS_IDLE_PERIOD' && child.children) {
                const startNode = getChild(child, 'TAG_EMS_IDLE_PERIOD_START');
                const endNode = getChild(child, 'TAG_EMS_IDLE_PERIOD_END');
                periods.push({
                    type: Number(getChildValue(child, 'TAG_EMS_IDLE_PERIOD_TYPE', 0)),
                    day: Number(getChildValue(child, 'TAG_EMS_IDLE_PERIOD_DAY', 0)),
                    active: Boolean(getChildValue(child, 'TAG_EMS_IDLE_PERIOD_ACTIVE', false)),
                    start: {
                        hour: Number(getChildValue(startNode, 'TAG_EMS_IDLE_PERIOD_HOUR', 0)),
                        minute: Number(getChildValue(startNode, 'TAG_EMS_IDLE_PERIOD_MINUTE', 0)),
                    },
                    end: {
                        hour: Number(getChildValue(endNode, 'TAG_EMS_IDLE_PERIOD_HOUR', 0)),
                        minute: Number(getChildValue(endNode, 'TAG_EMS_IDLE_PERIOD_MINUTE', 0)),
                    },
                });
            } else if (child.tagName === 'TAG_EMS_IDLE_PERIOD_CHANGE_MARKER' && !child.children) {
                changeMarker = Number(child.value || 0);
            }
        }

        if (changeMarker !== null) {
            this.setStateMirrored('EMS.IDLE_PERIOD_CHANGE_MARKER', changeMarker, true);
        }
        this.setStateMirrored('EMS.IDLE_PERIODS_JSON', prettyJson(periods), true);
    }

    async onStateChange(id, state) {
        if (!state || state.ack) {
            return;
        }

        try {
            const localId = id.replace(`${this.namespace}.`, '');
            const curatedSourceId = CURATED_TARGET_TO_SOURCE[localId];

            if (curatedSourceId) {
                if (!CURATED_WRITABLE_TARGETS.has(localId)) {
                    this.log.debug(`Ignoring write to read-only curated state ${localId}`);
                    return;
                }

                super.setState(curatedSourceId, state.val, false);

                if (curatedSourceId === 'EMS.IDLE_PERIODS_JSON') {
                    this.pendingIdlePeriodsWrite = String(state.val || '[]');
                    this.scheduleIdlePeriodsWrite();
                    return;
                }

                if (curatedSourceId === 'EMS.SET_POWER_MODE' || curatedSourceId === 'EMS.SET_POWER_VALUE') {
                    this.scheduleSetPower();
                    return;
                }

                if (EMS_POWER_SETTING_FIELDS[curatedSourceId]) {
                    this.pendingPowerSettingStates.add(curatedSourceId);
                    this.schedulePowerSettings();
                }
                return;
            }

            if (localId === 'RAW.REQUEST_JSON') {
                await this.handleRawRequest(state.val);
                return;
            }

            if (localId === 'EMS.IDLE_PERIODS_JSON') {
                this.pendingIdlePeriodsWrite = String(state.val || '[]');
                this.scheduleIdlePeriodsWrite();
                return;
            }

            if (localId === 'EMS.SET_POWER_MODE' || localId === 'EMS.SET_POWER_VALUE') {
                this.scheduleSetPower();
                return;
            }

            if (EMS_POWER_SETTING_FIELDS[localId]) {
                this.pendingPowerSettingStates.add(localId);
                this.schedulePowerSettings();
            }
        } catch (error) {
            this.log.error(`Failed to process state change ${id}: ${error.message}`);
            this.setStateMirrored('info.lastError', error.message, true);
            if (id.endsWith('RAW.REQUEST_JSON')) {
                this.setStateMirrored('RAW.LAST_ERROR', error.message, true);
            }
        }
    }

    scheduleSetPower() {
        if (this.setPowerTimer) {
            this.clearTimeout(this.setPowerTimer);
        }

        this.setPowerTimer = this.setTimeout(() => {
            this.sendSetPower(false).catch(error => {
                this.log.warn(`SET_POWER failed: ${error.message}`);
                this.setStateMirrored('info.lastError', error.message, true);
            });
        }, 250);
    }

    async sendSetPower(fromRepeat) {
        if (!this.client || !this.client.authenticated) {
            return;
        }

        const modeState = await this.getStateAsync('EMS.SET_POWER_MODE');
        const valueState = await this.getStateAsync('EMS.SET_POWER_VALUE');

        const mode = Number(modeState && modeState.val !== null ? modeState.val : 0);
        const value = Number(valueState && valueState.val !== null ? valueState.val : 0);

        await this.client.sendItems([
            {
                tag: 'TAG_EMS_REQ_SET_POWER',
                children: [
                    { tag: 'TAG_EMS_REQ_SET_POWER_MODE', value: mode },
                    { tag: 'TAG_EMS_REQ_SET_POWER_VALUE', value },
                ],
            },
        ]);

        this.setStateMirrored('EMS.SET_POWER_MODE', mode, true);
        this.setStateMirrored('EMS.SET_POWER_VALUE', value, true);

        const resendSec = Number(this.config.setPowerResendSec || 0);
        if (!fromRepeat) {
            if (mode !== 0 && resendSec > 0) {
                this.clearSetPowerRepeat();
                this.setPowerRepeatTimer = this.setInterval(() => {
                    this.sendSetPower(true).catch(error => {
                        this.log.warn(`Repeated SET_POWER failed: ${error.message}`);
                        this.setStateMirrored('info.lastError', error.message, true);
                    });
                }, resendSec * 1000);
            } else {
                this.clearSetPowerRepeat();
            }
        }
    }

    schedulePowerSettings() {
        if (this.powerSettingsTimer) {
            this.clearTimeout(this.powerSettingsTimer);
        }

        this.powerSettingsTimer = this.setTimeout(() => {
            this.sendPendingPowerSettings().catch(error => {
                this.log.warn(`SET_POWER_SETTINGS failed: ${error.message}`);
                this.setStateMirrored('info.lastError', error.message, true);
            });
        }, 250);
    }

    async sendPendingPowerSettings() {
        if (!this.client || !this.client.authenticated || !this.pendingPowerSettingStates.size) {
            return;
        }

        const statesToSend = Array.from(this.pendingPowerSettingStates);
        this.pendingPowerSettingStates.clear();

        const children = [];
        for (const stateId of statesToSend) {
            const obj = await this.getStateAsync(stateId);
            const value = obj ? obj.val : null;
            children.push({
                tag: EMS_POWER_SETTING_FIELDS[stateId].writeTag,
                value: this.toWireValue(stateId, value),
            });
        }

        await this.client.sendItems([{ tag: 'TAG_EMS_REQ_SET_POWER_SETTINGS', children }]);

        for (const stateId of statesToSend) {
            const obj = await this.getStateAsync(stateId);
            if (obj) {
                this.setStateMirrored(stateId, obj.val, true);
            }
        }

        await this.pollOnce();
    }

    toWireValue(stateId, value) {
        if (
            ['EMS.POWERSAVE_ENABLED', 'EMS.WEATHER_REGULATED_CHARGE_ENABLED'].includes(stateId)
        ) {
            return value ? 1 : 0;
        }
        if (stateId === 'EMS.POWER_LIMITS_USED') {
            return Boolean(value);
        }
        return Number(value || 0);
    }

    scheduleIdlePeriodsWrite() {
        if (this.idlePeriodsTimer) {
            this.clearTimeout(this.idlePeriodsTimer);
        }

        this.idlePeriodsTimer = this.setTimeout(() => {
            this.sendIdlePeriodsJson().catch(error => {
                this.log.warn(`SET_IDLE_PERIODS failed: ${error.message}`);
                this.setStateMirrored('info.lastError', error.message, true);
            });
        }, 250);
    }

    async sendIdlePeriodsJson() {
        if (!this.client || !this.client.authenticated) {
            return;
        }

        const raw = String(this.pendingIdlePeriodsWrite || '[]').trim();
        if (!raw) {
            return;
        }

        let payload = JSON.parse(raw);
        if (!Array.isArray(payload)) {
            if (payload && Array.isArray(payload.periods)) {
                payload = payload.periods;
            } else {
                throw new Error('EMS.IDLE_PERIODS_JSON must be an array or an object with a periods array');
            }
        }

        const children = payload.map(period => buildIdlePeriodPayload(period));
        await this.client.sendItems([{ tag: 'TAG_EMS_REQ_SET_IDLE_PERIODS', children }]);
        this.setStateMirrored('EMS.IDLE_PERIODS_JSON', prettyJson(payload), true);
        await this.client.sendItems([{ tag: 'TAG_EMS_REQ_GET_IDLE_PERIODS' }]);
    }

    async handleRawRequest(rawJson) {
        if (!this.client || !this.client.authenticated) {
            throw new Error('RSCP client is not authenticated');
        }

        const text = String(rawJson || '').trim();
        if (!text) {
            return;
        }

        let payload = JSON.parse(text);
        if (Array.isArray(payload)) {
            payload = { items: payload };
        }
        if (!payload || !Array.isArray(payload.items)) {
            throw new Error('RAW.REQUEST_JSON must be a JSON object with an items array');
        }

        const response = await this.client.sendItems(payload.items);
        this.setStateMirrored('RAW.REQUEST_JSON', text, true);
        this.setStateMirrored('RAW.LAST_ERROR', '', true);
        this.setStateMirrored('RAW.LAST_RESPONSE_JSON', prettyJson(renderTree(response.tree)), true);
    }

    scheduleReconnect() {
        if (this.reconnectTimer) {
            return;
        }

        const delayMs = Math.max(5000, Number(this.config.reconnectDelaySec || 30) * 1000);
        this.reconnectTimer = this.setTimeout(() => {
            this.reconnectTimer = null;
            this.connectClient().catch(error => {
                this.log.error(`Reconnect failed: ${error.message}`);
            });
        }, delayMs);
    }

    clearPolling() {
        if (this.pollTimer) {
            this.clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
    }

    clearSetPowerRepeat() {
        if (this.setPowerRepeatTimer) {
            this.clearInterval(this.setPowerRepeatTimer);
            this.setPowerRepeatTimer = null;
        }
    }

    clearReconnectTimer() {
        if (this.reconnectTimer) {
            this.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
    }

    onUnload(callback) {
        try {
            this.clearPolling();
            this.clearReconnectTimer();
            this.clearSetPowerRepeat();

            if (this.setPowerTimer) {
                this.clearTimeout(this.setPowerTimer);
                this.setPowerTimer = null;
            }
            if (this.powerSettingsTimer) {
                this.clearTimeout(this.powerSettingsTimer);
                this.powerSettingsTimer = null;
            }
            if (this.idlePeriodsTimer) {
                this.clearTimeout(this.idlePeriodsTimer);
                this.idlePeriodsTimer = null;
            }

            if (this.client) {
                this.client.disconnect();
                this.client = null;
            }
            callback();
        } catch {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = options => new NexowattE3dc(options);
} else {
    (() => new NexowattE3dc())();
}
