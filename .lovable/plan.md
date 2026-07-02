# Plan: Filtrera sammanställningen på klockslag

Lägger till möjlighet att välja **från kl** och **till kl** i sammanställningen så man kan avgränsa på tid på dygnet (t.ex. 08:00–17:00) utöver datumintervallet.

## UI (`src/routes/_authenticated/admin-summary.tsx`)
- Två nya `Input type="time"`-fält bredvid Från/Till-datum: **Från kl** (default `00:00`) och **Till kl** (default `00:00`, tolkas som slutet av dygnet när båda är `00:00`).
- Fälten hamnar i samma rutnätsrad som datumen, så filterkortet blir 4 kolumner på desktop och staplas på mobil.
- Nya state-variabler `fromTime` / `toTime` inkluderas i `queryKey` och skickas med i `fetchSummary`-anropet.
- CSV-exportens filnamn får med tiderna när de skiljer sig från default.

## Serverfunktion (`src/lib/admin.functions.ts`)
- Utöka `SummaryFilters` med valfria `fromTime?: string` och `toTime?: string` (`"HH:MM"`).
- I `getSummary`:
  - Bygg `fromIso` från `data.from` + `fromTime ?? "00:00"`.
  - Bygg `toIso` från `data.to` + `toTime`; om `toTime` saknas eller är `"00:00"` används nästa dags 00:00 (nuvarande beteende).
  - `.gte("start_time", fromIso)` och `.lt("start_time", toIso)` fungerar oförändrat.
- Ingen förändring i databas, RLS eller andra sidor.

## Verifiering
- `bunx tsc --noEmit` efter ändringen.
- Manuell smoke: välj ett datumintervall med tider 08:00–12:00 och kontrollera att bara poster som startar inom fönstret räknas.

## Öppen fråga (bekräftas i implementation)
Filtret matchar på `start_time` (poster som **startar** inom fönstret) — samma logik som idag. Säg till om du hellre vill klippa varje post i skarven mellan valda klockslag.
