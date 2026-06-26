## Mål
Ge admin en dedikerad projekt- och kundhantering samt sammanställning av tid per projekt/kund.

## 1. Projekt- och kundredigering (admin)
- Utöka `ProjectsDialog` i `src/routes/_authenticated/index.tsx` med en redigera-knapp (penna) per projekt som admin – öppnar inline-fält för att ändra **namn**, **kund** och **färg**, sparas via `supabase.from("projects").update(...)`.
- Lägg till färgväljare (enkel input `type="color"`) även vid skapande.
- Befintlig RLS tillåter redan admin att uppdatera – inga DB-ändringar krävs.

## 2. Egen kundlista (smidigare hantering)
Kunder finns idag bara som fri text på projekt. För att kunna sammanställa per kund konsekvent:
- Migration: ny tabell `public.clients` (namn, ev. anteckning) med GRANT + RLS (alla auth läser, endast admin skriver). Lägg till `client_id uuid` i `projects` (nullable, FK till `clients`). Behåll gamla `projects.client`-textfältet för bakåtkompatibilitet men markera som legacy.
- Engångs-backfill i samma migration: skapa `clients`-rader från distinkta `projects.client`-värden och fyll `projects.client_id`.

## 3. Admin-sida: projekt & kunder
Ny route `src/routes/_authenticated/admin.projects.tsx` (länk från admin-sidan):
- Sektion **Kunder**: lista + skapa/ändra/ta bort.
- Sektion **Projekt**: lista alla projekt, koppling till kund via dropdown, namn, färg – skapa/ändra/ta bort.
- Skydd: kontrollerar `isAdmin` (befintlig serverfunktion); annars "Forbidden"-meddelande.

## 4. Sammanställning per projekt/kund
Ny route `src/routes/_authenticated/admin.summary.tsx`:
- Datumintervall (från/till med kalender, default innevarande månad).
- Filter: användare (alla / specifik), kund, projekt.
- Två tabeller:
  - **Per kund**: total tid, antal poster, andel %.
  - **Per projekt**: total tid, kund, antal poster, andel %.
- Detaljerad rad per användare inom valt projekt/kund (expanderbart).
- CSV-export av sammanställningen.
- Datat hämtas via ny serverfunktion `adminGetSummary({from, to, userId?, clientId?, projectId?})` i `src/lib/admin.functions.ts` som aggregerar `time_entries` joinat med `projects` (+ `clients`).

## 5. Navigation
På `src/routes/_authenticated/admin.tsx`: lägg till två knappar/länkar högst upp – "Projekt & kunder" och "Sammanställning".

## Tekniskt
- Inga ändringar av tidsregistreringens UI för vanliga användare; de väljer fortsatt projekt som idag (visningsetiketten kan utökas till `Projekt – Kund`).
- Allt skrivande mot `projects`/`clients` sker via vanlig supabase-klient (RLS säkrar admin-only).
- Sammanställningen körs serverside för att kunna aggregera över alla användares tider (RLS-bypass via `requireSupabaseAuth` + admin-check, samma mönster som befintliga admin-functions).
