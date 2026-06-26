## Mål
Admin ska kunna lägga till, redigera och ta bort tidsposter för vilken användare som helst – inte bara sina egna.

## Databas (migration)
Utvidga RLS-policies på `public.time_entries` så admin får full åtkomst:
- Ny SELECT-policy: `has_role(auth.uid(), 'admin')` (utöver befintlig "egna poster").
- Ny INSERT-policy: admin får sätta valfritt `user_id`.
- Ny UPDATE-policy: admin får uppdatera alla poster.
- Ny DELETE-policy: admin får ta bort alla poster.

Befintliga policies för vanliga användare lämnas orörda.

## Server-funktioner (`src/lib/admin.functions.ts`)
Nya funktioner, alla skyddade med `requireSupabaseAuth` + `assertAdmin`, kör via `supabaseAdmin`:
- `adminCreateTimeEntry({ userId, projectId, description, start, end })`
- `adminUpdateTimeEntry({ id, projectId, description, start, end })`
- `adminDeleteTimeEntry({ id })`

Logik: om sluttid ≤ starttid → lägg till 24h (samma regel som i klientens manuella inmatning).

## UI (`src/routes/_authenticated/admin.tsx`)
I tabellen med alla poster:
- Lägg till kolumn med **Ändra**- och **Ta bort**-knappar per rad.
- Ovanför tabellen: knapp **"Lägg till tid för användare"**.
- Dialog (återanvänder samma fältlayout som `ManualEntryDialog`: användarväljare, projektväljare, datum med kalender, start/slut med TimeField, beskrivning).
  - Vid skapande: dropdown med alla användare (från `listManagedUsers`).
  - Vid redigering: användare är låst (visas som etikett), övriga fält förifyllda.
- Efter spara/ta bort: invalidera `getAllTimeEntries`-query så listan uppdateras.

## Filer som ändras
- Ny migration (RLS-policies)
- `src/lib/admin.functions.ts` – tre nya server-fn
- `src/routes/_authenticated/admin.tsx` – dialog, knappar, mutationer

Inga ändringar i vanliga användarens flöde.