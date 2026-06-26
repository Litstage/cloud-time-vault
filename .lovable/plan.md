## Mål
Lägga till **startdatum** och **slutdatum** på projekt, och använda dem för att filtrera projektlistan vid tidsregistrering så att endast aktiva projekt visas.

## 1. Databas
Migration på `public.projects`:
- Ny kolumn `start_date date` (nullable).
- Ny kolumn `end_date date` (nullable).
- Båda valfria — saknat startdatum = alltid aktivt från start, saknat slutdatum = pågår tills vidare.

## 2. Admin – Projekt & kunder (`src/routes/_authenticated/admin-projects.tsx`)
- Lägg till två datumfält vid både **skapa** och **redigera** projekt:
  - Textinput (`YYYY-MM-DD`) som kan skrivas manuellt
  - Kalenderikon-knapp som öppnar shadcn-kalender (svensk lokal, mån-start) i en Popover
- Visa start–slut i projektlistan under projektnamnet (t.ex. "2026-01-01 → 2026-12-31", "→ 2026-06-30", "från 2026-03-01" eller "—" om inget angetts).
- Spara fälten via befintlig `supabase.from("projects").update/insert`.

## 3. Filtrering vid tidsregistrering
I projektdropdownen på två ställen:
- `src/routes/_authenticated/index.tsx` (timer + Lägg till tid-dialogen) – filtrera mot postens datum (timern = idag, manuell post = valt datum).
- `src/routes/_authenticated/admin.tsx` (admins EntryDialog) – filtrera mot valt datum för posten.

Regel för "aktivt projekt vid datum D":
- `start_date` saknas ELLER `start_date <= D`, OCH
- `end_date` saknas ELLER `end_date >= D`.

Befintliga tidsposter kopplade till numera inaktiva projekt visas fortfarande i listor; filtreringen gäller bara valbarheten vid nyregistrering/redigering.

## 4. Sammanställning
Ingen ändring av sammanställningen i detta steg – datumen styr bara val. (Kan utökas senare om du vill kunna filtrera rapporter på projektens period.)

## Tekniskt
- RLS oförändrad — admin har redan write på `projects`.
- TypeScript-typer för `projects` regenereras automatiskt efter migrationen, så de nya fälten är typsäkra i koden.
- Hantering av ogiltig manuell datumsträng: röd ram, sparning blockeras (samma mönster som tidsfälten).
