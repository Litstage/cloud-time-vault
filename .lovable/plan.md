## Mål

1. Låt vanliga användare **redigera** sina egna tidsposter (inte bara skapa/ta bort).
2. Låt användare **byta sitt eget lösenord** från appen.

## Ändringar

**`src/routes/_authenticated/index.tsx`**
- Gör varje rad i postlistan klickbar → öppnar samma `ManualEntryDialog` i redigeringsläge, förifyllt med postens datum/start/slut/projekt/beskrivning.
- Utöka `ManualEntryDialog` med prop `editEntry?: Entry | null`:
  - Titel: "Redigera tid" när `editEntry` finns, annars "Lägg till tid".
  - `save()` gör `update` mot `time_entries` när `editEntry` finns (via `supabase` när det är egen post, via `adminUpdateTimeEntry` när admin agerar åt annan).
  - RLS tillåter redan användare att uppdatera egna poster.
- Lägg till menyalternativ **"Byt lösenord"** i dropdown-menyn som öppnar en enkel dialog.

**Ny `ChangePasswordDialog` i `src/routes/_authenticated/index.tsx`**
- Fält: nytt lösenord + bekräfta.
- Validering: minst 6 tecken, matchande.
- Anropar `supabase.auth.updateUser({ password })`.
- Visar toast vid framgång/fel.

## Utanför scope
- Inget krav på nuvarande lösenord (Supabase kräver bara aktiv session).
- Ingen ändring av admin-vyn `admin.tsx` (redigering finns där redan).
