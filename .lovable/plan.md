Ändra sammanställningen så att förnamn används istället för e-post, och gör innehållet i PDF-specifikationen valbart mellan alla tidsposter eller summering per användare och dag.

## Ändringar

**`src/lib/admin.functions.ts`**
- I `getSummary`: bygg en `firstNames`-map (fallback: e-post-prefix, sen userId) och använd den som `label` för `perUser`-raderna istället för e-post.
- I `getSummaryEntries`: sätt `user_label` till enbart förnamn (fallback: e-post-prefix före `@`, sen userId). Inga efternamn, inga e-postadresser.

**`src/routes/_authenticated/admin-summary.tsx`**
- Användarfiltret (Select): visa förnamn istället för e-post. Lägg till en hjälpare som hämtar förnamn från `usersQ.data` (fallback e-post-prefix).
- Lägg till ny state `pdfDetail: "entries" | "daily"` (default `"entries"`, sparas inte mellan sessioner).
- Popover-menyn "Visa kostnader" byggs ut med en radiogrupp "Specifikation i PDF":
  - "Alla tidsposter" (nuvarande beteende)
  - "Summering per användare och dag"
- I `exportPdf`:
  - Byt "Användare"-raden i filterhuvudet till förnamn.
  - Om `pdfDetail === "entries"`: behåll nuvarande tabell "Poster" men ersätt `Användare`-kolumnen med enbart förnamn (redan gjort via `user_label`).
  - Om `pdfDetail === "daily"`: aggregera `entries` per (`user_id`, datum i sv-SE) → kolumner: Datum, Användare (förnamn), Antal poster, Timmar. Sortera på datum, sedan förnamn.

**PDF-filnamn**: oförändrat.

## Tekniska detaljer

- Förnamnshjälpare i admin-summary.tsx: `(u) => (u.first_name?.trim() || u.email?.split("@")[0] || u.user_id)`.
- I `getSummaryEntries`: bygg `firstLabels` från `auth.admin.listUsers` på samma sätt som idag, men mappa till förnamn/e-post-prefix istället för "förnamn efternamn / email".
- Aggregeringen för "per användare och dag" görs klientsidan i `exportPdf` på det redan hämtade `entries`-arrayet (ingen ny server-fn behövs).
- Ingen persistens av valet mellan sessioner (state i komponenten).