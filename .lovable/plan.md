# Plan: Skatteberäkning via Skatteverkets skattetabeller

Ersätter dagens schablon på 30 % med uppslag i Skatteverkets månadsskattetabeller. Admin väljer tabell + kolumn per anställd; tabellerna ligger i databasen så de kan uppdateras varje år utan kodrelease.

## Datamodell

Två nya tabeller i Lovable Cloud:

```text
tax_tables
  id           uuid pk
  year         int         -- t.ex. 2026
  table_number int         -- 29..40 (kommunal skattesats i procent)
  period       text        -- 'month' (framtidssäkert för 'week' senare)
  source_url   text        -- referens till Skatteverket
  imported_at  timestamptz

tax_table_rows
  id                uuid pk
  tax_table_id      uuid fk -> tax_tables
  income_from       int     -- kr, inklusive
  income_to         int     -- kr, inklusive
  col1..col6        int     -- skatt i kr per kolumn
  UNIQUE(tax_table_id, income_from)
```

RLS: läs för `authenticated`, skriv endast för admin (via `has_role`). GRANT enligt Lovable-standard.

Utökar `user_wages`:
- `tax_table_number int` (default `32`)
- `tax_table_column smallint` (default `1`, 1–6)

Behåller `tax_pct` som fallback när ingen matchande tabellrad finns.

## Import av tabelldata

Skatteverket publicerar skattetabellerna som CSV/textfiler per år. Vi:
1. Lägger till en ny admin-sida **Skattetabeller** (`/_authenticated/admin-tax-tables`) med:
   - Lista över importerade år/tabeller.
   - Formulär för att ladda upp en CSV-fil för ett år.
   - Knapp "Hämta från Skatteverket" som anropar en serverfunktion — den försöker ladda ner filen från Skatteverkets öppna URL, parsar och lagrar. Om nedladdning misslyckas (Skatteverket blockar/ändrar format) faller den tillbaka på CSV-uppladdning.
2. En serverfunktion `importTaxTable` som tar `{ year, tableNumber, csvText }`, parsar (från–till, kol 1–6) och sparar via `supabaseAdmin`.

## Beräkning i sammanställningen

I `getSummary`:
1. Ladda relevanta `tax_tables`-rader för året (välj tabell utifrån största datumet i intervallet).
2. Per användare, gruppera tidsposter **per kalendermånad** och räkna brutto (inkl. OB).
3. Slå upp i användarens `tax_table_number` + `tax_table_column`; hitta rad där brutto ligger i `[income_from, income_to]`. Netto = brutto − skattekr.
4. Faller tillbaka till `tax_pct` när tabellrad saknas (t.ex. lön över tabellens takrader eller ingen tabell för året).
5. `perUser`-raderna, totalen och Netto-fältet använder den nya beräkningen. Arbetsgivarkostnad påverkas inte.

## UI

- **Löneredigering (admin.tsx):** ersätt fältet "Skatt (%)" med två fält "Skattetabell (nr)" och "Kolumn (1–6)"; behåll skattefältet som "Fallback-skatt (%)" i mindre stil.
- **Sammanställning:** oförändrad layout — bara beräkningen bakom Netto ändras. Lägg till en liten notering "Netto beräknad enligt Skatteverkets tabell X kolumn Y" per användarrad när tabell använts, annars "schablon".
- **Ny sida `/admin-tax-tables`** nås via knapp i admin-headern bredvid "Sammanställning".

## Serverfunktioner (`src/lib/tax.functions.ts`)

- `listTaxTables()` — admin-endast.
- `importTaxTable({ year, tableNumber, csvText })` — parsar och upsertar rader.
- `fetchTaxTableFromSkatteverket({ year, tableNumber })` — försöker `fetch` mot Skatteverkets öppna filer; returnerar råtext till klient som sedan skickar in via `importTaxTable`. Fallback: användaren laddar upp CSV manuellt.

## CSV-format som accepteras

En rad per inkomstintervall, semikolon eller komma-separerad:

```text
income_from;income_to;col1;col2;col3;col4;col5;col6
```

Rader med fel format hoppas över med räknare i UI ("142 rader importerade, 0 fel").

## Verifiering

- Migration körs, GRANT + RLS enligt standard.
- `bunx tsgo --noEmit` efter kodändringar.
- Manuell smoke: ladda upp en testtabell för 2026 med några rader, sätt tabell 32 kolumn 1 på en användare, kör sammanställning för en månad och kontrollera att netto matchar tabellen.

## Öppna antaganden

- Antar Skatteverkets **månadstabell** enligt ditt val.
- Antar att en anställd bara har en tabell/kolumn under hela perioden (om admin ändrar mitt i månad används det nuvarande värdet, historiska ändringar spåras inte).
- Skatten räknas per hel kalendermånad — poster i period 12–25 mars ger skatt beräknad på hela marsintjänandet i sammanställningen (om alla marsposter faller inom filtret).
