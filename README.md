# ioBroker.nexowatt-e3dc

Ein **ioBroker-Adapter für E3/DC Speichersysteme über RSCP** mit Fokus auf:

- **Lesen + Schreiben** der relevanten **EMS-Steuerpunkte**
- zusätzlichem Polling für **BAT**, **PVI** und optional **WB**
- **Idle Periods** als JSON lesen und schreiben
- **Raw RSCP JSON** für eigene Requests
- **offiziellem RSCP-Tag-Mapping** aus der E3/DC-Tabelle, damit Tag-Namen direkt nutzbar sind

## Funktionsumfang

### EMS lesen

Der Adapter pollt u. a.:

- `EMS.POWER_PV`
- `EMS.POWER_BAT`
- `EMS.POWER_HOME`
- `EMS.POWER_GRID`
- `EMS.POWER_ADD`
- `EMS.BAT_SOC`
- `EMS.AUTARKY`
- `EMS.SELF_CONSUMPTION`
- `EMS.MODE`
- `EMS.STATUS`
- `EMS.REMAINING_BAT_CHARGE_POWER`
- `EMS.REMAINING_BAT_DISCHARGE_POWER`
- `EMS.USED_CHARGE_LIMIT`
- `EMS.BAT_CHARGE_LIMIT`
- `EMS.DCDC_CHARGE_LIMIT`
- `EMS.USER_CHARGE_LIMIT`
- `EMS.USED_DISCHARGE_LIMIT`
- `EMS.BAT_DISCHARGE_LIMIT`
- `EMS.DCDC_DISCHARGE_LIMIT`
- `EMS.USER_DISCHARGE_LIMIT`
- `EMS.EMERGENCY_POWER_STATUS`
- `EMS.COUPLING_MODE`
- `EMS.BALANCED_PHASES`
- `EMS.INSTALLED_PEAK_POWER`
- `EMS.DERATE_AT_PERCENT_VALUE`
- `EMS.DERATE_AT_POWER_VALUE`
- `EMS.ERROR_BUZZER_ENABLED`
- `EMS.EXT_SRC_AVAILABLE`

### EMS schreiben

- `EMS.SET_POWER_MODE`
- `EMS.SET_POWER_VALUE`
- `EMS.POWER_LIMITS_USED`
- `EMS.MAX_CHARGE_POWER`
- `EMS.MAX_DISCHARGE_POWER`
- `EMS.DISCHARGE_START_POWER`
- `EMS.POWERSAVE_ENABLED`
- `EMS.WEATHER_REGULATED_CHARGE_ENABLED`
- `EMS.IDLE_PERIODS_JSON`

### Kuratierte EMS-Punkte unter `objekte`

Zusätzlich legt der Adapter die wichtigsten Punkte für ein **übergeordnetes EMS** kompakt unter folgendem Pfad an:

- `objekte.ems.system.*`
- `objekte.ems.messwerte.*`
- `objekte.ems.steuerung.*`

Wichtige Beispiele:

- `objekte.ems.messwerte.pvLeistung`
- `objekte.ems.messwerte.batterieLeistung`
- `objekte.ems.messwerte.hausLeistung`
- `objekte.ems.messwerte.netzLeistung`
- `objekte.ems.messwerte.batterieSoc`
- `objekte.ems.steuerung.modusSoll`
- `objekte.ems.steuerung.leistungSoll`
- `objekte.ems.steuerung.maxLadeLeistung`
- `objekte.ems.steuerung.maxEntladeLeistung`
- `objekte.ems.steuerung.idlePeriodsJson`

Diese Punkte sind **gespiegelt**: Schreibbare States unter `objekte.ems.steuerung.*` werden intern auf die eigentlichen EMS-States weitergeleitet, während gelesene Werte automatisch synchron gehalten werden.

### Zusätzliche Namespaces

#### BAT

Für konfigurierbare Batterie-Indizes, standardmäßig `0`:

- `BAT.<index>.RSOC`
- `BAT.<index>.MODULE_VOLTAGE`
- `BAT.<index>.CURRENT`
- `BAT.<index>.MAX_BAT_VOLTAGE`
- `BAT.<index>.MAX_CHARGE_CURRENT`
- `BAT.<index>.MAX_DISCHARGE_CURRENT`
- `BAT.<index>.CHARGE_CYCLES`
- `BAT.<index>.TERMINAL_VOLTAGE`
- `BAT.<index>.STATUS_CODE`
- `BAT.<index>.ERROR_CODE`
- `BAT.<index>.DEVICE_NAME`
- `BAT.<index>.DCB_COUNT`
- `BAT.<index>.MAX_DCB_CELL_TEMPERATURE`
- `BAT.<index>.MIN_DCB_CELL_TEMPERATURE`
- `BAT.<index>.READY_FOR_SHUTDOWN`
- `BAT.<index>.TRAINING_MODE`

#### PVI

Für konfigurierbare PVI-Indizes, standardmäßig `0`:

- `PVI.<index>.ON_GRID`
- `PVI.<index>.STATE`
- `PVI.<index>.LAST_ERROR`
- `PVI.<index>.TYPE`
- `PVI.<index>.SYSTEM_MODE`
- `PVI.<index>.POWER_MODE`
- `PVI.<index>.SERIAL_NUMBER`
- `PVI.<index>.VERSION_MAIN`
- `PVI.<index>.VERSION_PIC`
- `PVI.<index>.VERSION_JSON`
- `PVI.<index>.AC_MAX_PHASE_COUNT`
- `PVI.<index>.DC_MAX_STRING_COUNT`

Zusätzlich pro konfiguriertem AC-Phasenindex:

- `PVI.<index>.AC_PHASE_<phase>.POWER`
- `PVI.<index>.AC_PHASE_<phase>.VOLTAGE`
- `PVI.<index>.AC_PHASE_<phase>.CURRENT`
- `PVI.<index>.AC_PHASE_<phase>.ENERGY_DAY`

Zusätzlich pro konfiguriertem DC-Stringindex:

- `PVI.<index>.DC_STRING_<string>.POWER`
- `PVI.<index>.DC_STRING_<string>.VOLTAGE`
- `PVI.<index>.DC_STRING_<string>.CURRENT`
- `PVI.<index>.DC_STRING_<string>.ENERGY_ALL`

> Wichtig: Die konfigurierten Phasen-/Stringindizes sind **exakte RSCP-Indizes**. Je nach Gerät können diese 0-basiert oder anders nummeriert sein.

#### WB

Optional für konfigurierbare Wallbox-Indizes:

- `WB.<index>.ENERGY_ALL`
- `WB.<index>.ENERGY_SOLAR`
- `WB.<index>.SOC`
- `WB.<index>.STATUS`
- `WB.<index>.ERROR_CODE`
- `WB.<index>.MODE`
- `WB.<index>.PM_POWER_L1`
- `WB.<index>.PM_POWER_L2`
- `WB.<index>.PM_POWER_L3`
- `WB.<index>.PM_ACTIVE_PHASES`
- `WB.<index>.PM_MODE`
- `WB.<index>.PM_ENERGY_L1`
- `WB.<index>.PM_ENERGY_L2`
- `WB.<index>.PM_ENERGY_L3`

## Idle Periods

`EMS.IDLE_PERIODS_JSON` ist ein JSON-State. Der Adapter liest die Idle-Periods aus und schreibt sie im gleichen Format zurück.

Beispiel:

```json
[
  {
    "type": 0,
    "day": 1,
    "active": true,
    "start": { "hour": 22, "minute": 0 },
    "end": { "hour": 6, "minute": 0 }
  }
]
```

Das zuletzt gelesene Änderungskennzeichen landet in:

- `EMS.IDLE_PERIOD_CHANGE_MARKER`

## Raw RSCP JSON

Für Spezialfälle gibt es:

- `RAW.REQUEST_JSON`
- `RAW.LAST_RESPONSE_JSON`
- `RAW.LAST_ERROR`

Du kannst im Request **offizielle RSCP-Tag-Namen** direkt verwenden.

Beispiel:

```json
{
  "items": [
    { "tag": "TAG_EMS_REQ_POWER_PV" },
    {
      "tag": "TAG_EMS_REQ_SET_POWER",
      "children": [
        { "tag": "TAG_EMS_REQ_SET_POWER_MODE", "value": 3 },
        { "tag": "TAG_EMS_REQ_SET_POWER_VALUE", "value": 1800 }
      ]
    }
  ]
}
```

## SET_POWER Modi

- `0` = AUTO
- `1` = IDLE
- `2` = DISCHARGE
- `3` = CHARGE
- `4` = GRID_CHARGE

## Installation

### Variante A – direkt aus GitHub / eigener URL

- Repository nach GitHub pushen
- in ioBroker Admin im Expertenmodus **aus eigener URL** installieren
- alternativ per CLI mit `iobroker url <repo-url>`

### Variante B – lokales Repo / Arbeitsverzeichnis

```bash
cd /opt/iobroker
npm i /pfad/zum/repo
iobroker add nexowatt-e3dc
```

### Variante C – Release-Tarball

```bash
cd /opt/iobroker
iobroker add /pfad/zu/iobroker.nexowatt-e3dc-0.3.0.tgz
```

## Konfiguration

### Verbindung

- `host`: lokale IP des E3/DC
- `port`: normalerweise `5033`
- `portalUser`
- `portalPassword`
- `rscpPassword`

### Polling

- `pollIntervalSec`
- `requestTimeoutMs`
- `reconnectDelaySec`
- `setPowerResendSec`

### Namespaces

- `enableBat`, `batIndices`
- `enablePvi`, `pviIndices`
- `pviPhaseIndices`
- `pviStringIndices`
- `enableWb`, `wbIndices`
- `enableIdlePeriods`

## Beispiele

Siehe:

- `examples/raw/get-bat0-rsoc.json`
- `examples/raw/set-power-charge-1800w.json`
- `examples/idle-periods/idle-periods.example.json`

## Hinweise

- Die RSCP-Tag-Namen in `lib/rscp-tags.js` wurden aus der offiziellen E3/DC-Tag-Tabelle übernommen.
- Nicht jedes E3/DC-System liefert jeden Namespace oder jeden Index zurück.
- Die Antwortform einzelner Tags kann je nach Firmware abweichen.
- Der Adapter ist syntaktisch geprüft, aber ohne Live-System nicht vollständig hardwarevalidiert.
