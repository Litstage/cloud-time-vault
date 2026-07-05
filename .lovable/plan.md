## Mål
Skapa en fil `database-schema.sql` i projektets rot som innehåller all SQL som krävs för att återskapa hela din databasstruktur i en tom Postgres/Supabase-databas.

## Vad filen kommer innehålla

1. **Enum-typer**
   - `app_role` (admin, moderator, user)
   - Ev. andra enums som finns i schemat

2. **Tabeller** (med kolumner, defaults, primary keys, foreign keys):
   - `clients`
   - `ob_rules`
   - `projects`
   - `tax_tables`
   - `tax_table_rows`
   - `time_entries`
   - `time_entry_audit`
   - `user_approvals`
   - `user_roles`
   - `user_wages`

3. **GRANT-satser** för `authenticated`/`service_role`/`anon` per tabell (matchar nuvarande policies).

4. **Row Level Security aktivering** + alla **RLS-policies** som finns idag (hämtas från `pg_policies`).

5. **Database-funktioner**:
   - `has_role(uuid, app_role)`
   - `is_approved(uuid)`
   - `claim_first_admin()`
   - `handle_new_user_approval()`
   - `update_updated_at_column()`

6. **Triggers** kopplade till funktionerna (t.ex. `updated_at`-triggers, `on_auth_user_created` för approvals).

7. **Index** som finns definierade i schemat.

## Vad som INTE ingår
- Ingen data (bara struktur). Om du vill ha datan också: säg till så lägger jag till `INSERT`-satser eller en separat `database-data.sql`.
- Inga ändringar i `auth`-, `storage`- eller andra Supabase-managed scheman.
- Inga secrets/API-nycklar.

## Så här gör jag det
Kör läsningar mot `information_schema`, `pg_policies`, `pg_proc`, `pg_trigger` och `pg_indexes` för att generera exakt SQL som speglar nuläget, och skriver resultatet till `database-schema.sql`.

## Frågor innan jag börjar
- Vill du också ha med **datan** (INSERT-satser) i en separat fil?
- Vill du ha SQL:en som **en enda fil** eller uppdelad per migrations-stil (en fil per tabell/feature)?