## Problem

När en admin lägger in tiden `00:30–02:30` via huvudsidan (eller admin-vyn) ändras den till `02:30–04:30` efter sparning.

Orsaken: `adminCreateTimeEntry` / `adminUpdateTimeEntry` i `src/lib/admin.functions.ts` tar emot datum + `HH:MM` som separata strängar och bygger tiden på servern med:

```ts
new Date(`${dateIso}T${startHHMM}:00`)
```

Serverkoden kör i UTC. `"2026-07-02T00:30:00"` utan tidszon tolkas där som **UTC** → sparas som `00:30Z`. När webbläsaren sedan visar den med svensk tidszon (CEST, +2h) blir det `02:30`. Bugg = +2 timmar i sommartid.

Vanliga användarens klient-path (`supabase.from(...).insert(...)`) har inte problemet i webbläsaren, men samma bugg finns i alla anrop som går via de här server-funktionerna, dvs. admin-registrering på huvudsidan och `admin.tsx` EntryDialog.

## Fix

Låt klienten alltid räkna om lokal tid till fullständig ISO-sträng (`toISOString()`) och skicka den till servern, så att servern aldrig behöver tolka `HH:MM` utan tidszon.

### `src/lib/admin.functions.ts`
- Byt input-signaturen på `adminCreateTimeEntry` och `adminUpdateTimeEntry` från `{ date, start, end }` till `{ startIso, endIso }` (fullständiga ISO-strängar med tidszonsinfo).
- Ta bort/förenkla `computeIsoTimes` – validera bara att strängarna är giltiga `Date` och att `endIso > startIso` (nästa-dygn-logiken görs redan på klienten).
- Använd `startIso`/`endIso` direkt i insert/update och i audit-loggen.

### `src/routes/_authenticated/index.tsx` (ManualEntryDialog)
- I admin-path (både create och update) bygg samma `startIso`/`endIso` som redan görs i klient-path (rad 651–655 / 687–692) och skicka dem till server-funktionen istället för `date/start/end`.

### `src/routes/_authenticated/admin.tsx` (EntryDialog)
- Samma sak: bygg `startIso`/`endIso` med `new Date(y, m-1, d, h, mi).toISOString()` på klienten och skicka in.

## Utanför scope
- Ingen ändring av databasen, RLS eller audit-tabellens schema (bara innehållet i `before_data`/`after_data` blir korrekt ISO).
- Ingen förändring av visning eller övriga tidsberäkningar – de är redan korrekta så länge lagrad data har rätt tidszon.
