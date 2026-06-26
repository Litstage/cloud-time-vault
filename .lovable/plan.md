# Gemensamma projekt via delad arbetsyta

En enda arbetsyta som alla inloggade användare automatiskt tillhör. **Projekt blir gemensamma** – vem som helst kan skapa, redigera och ta bort projekt, och alla ser samma lista. **Tidsposter förblir privata** – varje användare ser bara sina egna (admin ser fortfarande allt via Admin-sidan).

## Databasändringar (migration)

1. Ta bort `user_id`-kolumnen från `projects` (eller behåll som "skapad av"-info – se nedan).
2. Ersätt RLS-policyn `Own projects` på `projects` med:
   - `SELECT` för alla inloggade (`authenticated`).
   - `INSERT/UPDATE/DELETE` för alla inloggade.
3. `time_entries` är oförändrad – RLS fortsätter låsa per `auth.uid()`.
4. `time_entries.project_id` får referera till valfritt projekt (alla kan välja vilket projekt som helst i listan).

Vi behåller `projects.user_id` (nullable) som "skapad av" för spårbarhet men den används inte längre för åtkomstkontroll.

## Kodändringar

- `src/routes/_authenticated/index.tsx`
  - `ProjectsDialog`: ändra ta-bort-knappen så den fungerar mot delade projekt (ingen `user_id`-koll behövs – RLS hanterar det). Visa ev. liten varning vid borttagning eftersom det påverkar alla.
  - Inget annat behöver ändras – projektlistan hämtas redan utan filter.
- `src/routes/_authenticated/overview.tsx`: oförändrad (visar bara egna tider, fortsätter funka).
- `src/routes/_authenticated/admin.tsx`: oförändrad.

## Vad användaren märker

- Logga in på två olika konton → båda ser samma projektlista.
- Skapa "Kund X" på konto A → konto B ser den direkt och kan logga tid mot den.
- Var och en ser fortfarande bara sina egna tidsposter i översikten.
- Tar någon bort ett projekt försvinner det för alla (kopplade tidsposter behåller historiken, projektfältet blir tomt).

## Migrationsplan

Eftersom befintliga projekt redan ligger med olika `user_id` blir de automatiskt synliga för alla efter att RLS uppdaterats – inga data flyttas eller dubbletteras.
