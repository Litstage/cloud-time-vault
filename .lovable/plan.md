## Mål
Låt admin på förstasidan välja **vilka användares poster** som ska visas i listan (utöver de egna).

## Ändringar

### `src/routes/_authenticated/index.tsx`
- Nytt state (endast admin): `visibleUserIds: string[]`, default `[selfUserId]` när `selfUserId` finns.
- UI: En `Popover` bredvid datumväljaren i "Poster"-raden, visas endast när `userIsAdmin && !actingOnOther`.
  - Trigger-knapp med sammanfattning:
    - Bara jag själv → "Mina poster"
    - N valda (fler än 1) → "N användare"
    - Alla godkända valda → "Alla användare"
  - Innehåll: sökfält + checkbox-lista över godkända användare (hämtas från befintlig `usersQ`), samt knappar "Markera alla" / "Rensa" / "Bara jag".
- I `entriesQ`:
  - `actingOnOther` (registrerar för annan): oförändrat.
  - Vanlig användare: oförändrat (bara egna).
  - Admin: fortsätt använda `getAllTimeEntries` och filtrera klient-sida på `visibleUserIds` (endast rader vars `user_id` finns i listan).
  - Lägg `visibleUserIds` (sorterad + join) och `selfUserId` i `queryKey` så cachen inte blandas.
- Namn-badge per rad: oförändrat — visas när raden tillhör någon annan än inloggad användare.

### Övrigt
- Registrering, start/stopp, "Registrera för"-väljaren: orörda.
- Ingen ändring i admin-/översiktssidor, RLS eller CSV-export.
