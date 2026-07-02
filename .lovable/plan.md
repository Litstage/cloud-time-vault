## Problem

Fakturering (och OB-lön) delas i "hinkar" per minut med `Date.getHours()` och `Date.getDay()`. På serversidan körs koden i UTC, så natt (22–07) och helg (lör/sön) utvärderas i fel tidszon. Resultat:

- Pass 22:00–07:00 svensk tid = 20:00–05:00 UTC → OB1-timmarna hamnar fel.
- Ett pass som börjar t.ex. lördag 00:30 svensk tid ses som fredag 23:30 UTC → OB2 blir OB1 istället.
- Sommartid vs vintertid ger olika fel (offset 1h eller 2h).

Detta påverkar `totalBilling` och per-rad `billing` i sammanställningen — och samma bugg finns i OB-lönesplit (`splitEntryByOb`) som påverkar bruttolön / arbetsgivarkostnad / netto.

## Fix

Utvärdera veckodag och klockslag i tidszonen **Europe/Stockholm** istället för serverns lokala tid.

### `src/lib/admin.functions.ts` — `splitEntryByBilling`
- Lägg till hjälpare `getSwedishParts(date)` som via `Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Stockholm", weekday, hour, minute })` returnerar `{ weekday: 0-6, hour: 0-23 }`.
- Byt `d.getDay()` / `d.getHours()` mot dessa värden.
- Hantera DST automatiskt via Intl (ingen hårdkodad offset).

### `src/lib/ob.ts` — `levelAt`
- Samma fix: läs `weekday`/`hour`/`minute`/`second` i Europe/Stockholm istället för `date.getDay()` / `getHours()`.
- OB-reglerna i DB är angivna i svensk tid, så matchningen blir korrekt året runt.

### Vad som INTE ändras
- Databas / migrationer.
- UI, PDF, rapportstruktur.
- Formler för lön, arbetsgivaravgift, skatt.
- Klientkoden (tidszonberäkning där sker redan lokalt i webbläsaren).

## Verifiering

Efter fix testar jag två poster i preview: ett pass 22:00–07:00 vardagsnatt och ett pass lör 00:30–03:00, och kontrollerar att OB1/OB2-fördelningen och faktureringssumman stämmer i sammanställningen.
