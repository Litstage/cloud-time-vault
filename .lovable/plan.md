# Kopiera tider mellan användare (admin)

## Omfattning
- Endast admin. Funktionen läggs till i admin-vyn (`src/routes/_authenticated/admin.tsx`).
- Två sätt att välja källposter: markera enskilda rader **eller** välja intervall (dag/vecka/månad) för en användare.
- Admin väljer om posterna ska **kopieras** (original kvar) eller **flyttas** (byter ägare).
- Mottagare: en eller flera användare samtidigt (checklista). Vid flera mottagare tvingas läget till "kopiera".

## UI-ändringar (`admin.tsx`)
- Checkboxar per rad i tidslistan + "Markera alla i vyn".
- Ny knapp **"Kopiera/Flytta tider…"** som öppnar en dialog:
  - Källa: visar antal markerade poster, alternativt intervall-läge (välj användare + dag/vecka/månad + datum).
  - Läge: radioknappar "Kopiera" / "Flytta" (Flytta inaktiveras om >1 mottagare).
  - Mottagare: multi-select med checkboxar över godkända användare (källanvändaren döljs).
  - Bekräftelse-summering: "Kopierar N poster till M användare".
- Efter körning: toast med resultat + query-invalidation för tidslistan och audit-loggen.

## Server-funktioner (`src/lib/admin.functions.ts`)
Ny funktion `adminCopyTimeEntries` med `requireSupabaseAuth` + admin-check (samma mönster som befintliga admin-fn):
- Input: `{ entryIds: string[]; targetUserIds: string[]; mode: 'copy' | 'move' }`.
- Validering: minst 1 entry + 1 target; `mode='move'` kräver exakt 1 target; mottagare måste vara godkända.
- Hämtar källposterna via `supabaseAdmin` (bypass RLS).
- **Copy**: insert av nya rader per target med samma `project_id`, `start_time`, `end_time`, `description`; ny `id`/`created_at`. Audit-logga varje ny rad som `action='admin_copy'` med `before_data=null`, `after_data=<ny rad>` och referens till källans `id` i `after_data.copied_from`.
- **Move**: update av `user_id` på befintliga rader till target. Audit-logga som `action='admin_move'` med före/efter-snapshot.
- Returnerar `{ created: number; moved: number }`.

Ingen ny funktion för intervall-läget: klienten expanderar valt intervall till `entryIds` innan anropet (samma query som listan redan använder).

## Databas / RLS
- Ingen schemaändring. `time_entries` tillåter redan admin-insert/-update via befintliga admin-policies, och `time_entry_audit` skrivs redan av admin-fn.
- `action`-kolumnen i `time_entry_audit` är fri text → nya värden `admin_copy` / `admin_move` fungerar utan migration.

## Utanför scope
- Ingen ändring av vanliga användares behörigheter.
- Ingen sammanslagning/dedup av överlappande tider hos mottagaren – posterna läggs till som de är.
- Ingen ändring av projekt-kopplingen (samma `project_id` behålls även om målet inte "äger" projektet; projekt är delade).
