## Mål
Visa vems tid en post gäller (för admin) och lägg till för-/efternamn på användare.

## Databas
Nya kolumner på `user_approvals` (befintlig tabell där vi redan lagrar phone m.m. per användare — bekräftas vid implementation, annars läggs de på lämplig plats):
- `first_name text`
- `last_name text`

Ingen ny tabell behövs.

## Backend (`src/lib/admin.functions.ts`)
- `listManagedUsers` returnerar redan användare — utöka med `first_name`, `last_name`.
- `createManagedUser` / `updateManagedUser`: acceptera valfria `firstName`/`lastName` och spara.
- `getAllTimeEntries` (admin-listan): joina in namn så varje post har `user_first_name`, `user_last_name`, `user_email`.
- Sammanställningar (`getSummary`, audit-listor) fortsätter fungera; visa namn där e-post visas idag när namn finns.

## UI

### Auth / registrering (`src/routes/auth.tsx`)
- Lägg till frivilliga fält **Förnamn** och **Efternamn** i signup-formuläret. Skickas till `supabase.auth.signUp` som `options.data` och plockas upp av trigger/serverfunktion vid godkännande — eller sparas direkt via ny serverfn.

### Admin – användarhantering (`src/routes/_authenticated/admin.tsx`)
- Skapa-användare-dialog och redigera-dialog: nya frivilliga fält Förnamn/Efternamn.
- Användarlistan: visa "Förnamn Efternamn" som primär text, e-post som sekundär.
- Rader som saknar namn markeras tydligt (badge "Namn saknas") tills admin fyllt i.

### Admin – "Alla poster" (`admin.tsx`)
- Varje rad visar namnet på användaren (fallback: e-post + badge "Namn saknas").

### Startsidan (`src/routes/_authenticated/index.tsx`)
- Vanliga användare: oförändrat (inget namn behövs på egna poster).
- Admin: varje post i listan visar en liten etikett med namnet på ägaren (så det syns när admin registrerat tid åt någon annan). Detekteras via befintlig `userIsAdmin`.

## Utanför scope
- Inga ändringar av behörigheter eller RLS.
- Ingen migrering av befintliga namn från e-post.
- Ingen ändring av export/CSV-format (kan läggas till senare vid behov).
