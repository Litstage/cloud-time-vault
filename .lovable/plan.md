## Mål
Behåll att admin ser allas poster på förstasidan, men visa **namn (förnamn efternamn, fallback e‑post)** på varje rad så det tydligt syns vems tid det gäller.

## Ändringar

### `src/routes/_authenticated/index.tsx`
- När `userIsAdmin` är sant och admin **inte** agerar för en specifik annan användare (`targetUserId` är eget id eller null), hämta listan via befintlig server-fn `getAllTimeEntries` (returnerar `user_id`, `user_email`, `user_first_name`, `user_last_name` + projektinfo) istället för den nuvarande `supabase.from("time_entries")`-queryn. Behåll dagens ordning (senaste först) och rimlig gräns (~200).
- När admin agerar för en enskild annan användare: oförändrat (nuvarande `adminListEntriesForUser`).
- Vanliga användare: oförändrat.
- Utöka lokala `Entry`-typen med valfria `user_id`, `user_first_name`, `user_last_name`, `user_email`.
- I varje rad i listan: när fälten finns, visa en liten namn‑badge (förnamn efternamn → fallback e‑post → "Namn saknas") ovanför projekt/beskrivning. Egna rader visas utan badge, eller med badge "Du" — kort och neutralt.
- Ta med `userIsAdmin` och `selfUserId` i `queryKey` så cachen inte blandas mellan konton/roller.

### Registrering
- "Registrera för"‑väljaren och start/stopp/manuell‑logiken lämnas orörd. När admin registrerar tid gäller fortfarande vald användare i väljaren (default = dig själv).

## Utanför scope
- Inga RLS‑ändringar.
- Ingen ändring av admin‑ eller översiktssidorna.
- Inga ändringar av CSV‑export.
