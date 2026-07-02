## Mål

Admin ska kunna registrera tid åt vilken användare som helst direkt från huvudsidan (start/stopp-timer och "Ny tidspost"), inte bara via adminvyn.

## Ändringar

**`src/routes/_authenticated/index.tsx`**
- Hämta admin-status (`has_role`) och lista över godkända användare vid mount (endast om admin).
- Lägg till en användarväljare högst upp i huvudvyn synlig endast för admin, med "Mig själv" som standard.
- När en annan användare är vald:
  - Start/stopp-timer skapar/uppdaterar `time_entries` med den valda användarens `user_id` via server-funktion (`adminCreateTimeEntry` / motsvarande stop-variant) eftersom RLS blockerar direktinsert med annat `user_id`.
  - "Ny tidspost"-dialogen och redigering/borttagning av poster går via befintliga admin-serverfunktioner.
  - Listan (dag/vecka/månad) visar den valda användarens poster (ny admin-serverfunktion `adminListTimeEntries` som filtrerar på user + datumintervall).
- Visuell indikator (badge) när admin agerar åt annan användare.

**`src/lib/admin.functions.ts`**
- Lägg till `adminListTimeEntries({ userId, from, to })` som returnerar poster med projekt-join, och `adminStartTimer` / `adminStopTimer` (eller återanvänd `adminCreateTimeEntry` + `adminUpdateTimeEntry` för `end_time`).
- Alla nya funktioner använder `requireSupabaseAuth` + `has_role('admin')`-check och `supabaseAdmin` för skrivningar, samt loggar i `time_entry_audit`.

## Utanför scope
- Ingen bulk-registrering för flera användare samtidigt.
- Månadsöversikten (`overview.tsx`) ändras inte i denna omgång.
