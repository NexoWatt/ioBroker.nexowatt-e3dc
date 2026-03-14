# Objekte für ein übergeordnetes EMS

Dieser Ordner dokumentiert die **kuratierten EMS-Punkte** des Adapters.

Im laufenden Adapter werden diese States zusätzlich unter folgendem Pfad angelegt:

- `nexowatt-e3dc.<instanz>.objekte.ems.*`

Ziel ist, die für eine EMS-Leitwarte wichtigsten Soll-/Ist-Werte schnell an einer Stelle zu finden, statt mehrere Namespaces (`EMS`, `info`, `RSCP`) durchsuchen zu müssen.

## Gruppen

- `objekte.ems.system`
- `objekte.ems.messwerte`
- `objekte.ems.steuerung`

## Mapping-Datei

Siehe:

- `objekte/ems-supervisor-aliase.json`
