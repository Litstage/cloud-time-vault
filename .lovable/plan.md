## Anpassningsbara kostnadskolumner + PDF-export i Sammanställning

### 1. Kolumnväljare i UI (`src/routes/_authenticated/admin-summary.tsx`)
- Ny popover-knapp "Visa kostnader" i filter-kortet med fyra checkboxar:
  - Bruttolön
  - Netto efter skatt
  - Arbetsgivarkostnad
  - Debitering kund
- State `visibleCosts` (default: alla fyra på). Återställs vid sidladdning (ingen persistens).
- Skickas som props ner till `SummarySection` och styr både:
  - Totaler-boxen ("Bruttolön / Netto / Arb.giv. / Debitering") – dolda kort tas bort så griden krymper.
  - Per-rad-visningen (`showAmount / showNet / showEmployerCost / showBilling` blir dynamiska).

### 2. PDF-export – "Detaljerad med posterna"
- Ny knapp "PDF" bredvid CSV-knappen.
- Använder `jspdf` + `jspdf-autotable` (lätt, funkar i browsern; installeras via `bun add jspdf jspdf-autotable`).
- Innehåll i PDF:en, i ordning:
  1. Rubrik "Sammanställning" + valt datum/tid-intervall + valda filter (användare/kund/projekt).
  2. Totaler (endast valda kostnadsfält) + timmar (Normal/OB1/OB2/OB3/Total).
  3. Tabell "Per kund" – kolumner: Kund, Timmar, (valda kostnader).
  4. Tabell "Per projekt" – Projekt, Kund, Timmar, (valda kostnader).
  5. Tabell "Per användare" – Namn, Timmar, (valda kostnader).
  6. Tabell "Poster" – Datum, Start, Slut, Användare, Projekt, Beskrivning, Timmar. Hämtas via ny/utökad server-funktion.

### 3. Server-funktion: hämta detaljerade poster till PDF
- I `src/lib/admin.functions.ts`: utöka `getSummary` att även returnera `entries: DetailedEntry[]` (redan finns intern lista – exponeras med namn/projekt/kund upplösta) **eller** ny `getDetailedEntries` med samma filter (from/to/fromTime/toTime/userId/clientId/projectId).
- Väljer alternativ B (ny funktion) för att inte tynga sammanställningen när PDF inte används; anropas bara vid PDF-klick via `useServerFn` + on-demand `queryClient.fetchQuery`.

### Tekniska detaljer
- Filnamn: `sammanstallning-<from>_<to>.pdf`.
- Svenska rubriker och `toLocaleString("sv-SE")`-formattering, samma `fmtHours` / `fmtKr` som idag.
- Autotable med `theme: "striped"`, sidbrytning automatiskt, sidfot med sidnummer.
- CSV-exporten lämnas oförändrad.

### Utanför scope
- Sparade kolumnval mellan besök (användaren valde nej).
- Ändring av vilka timkolumner (Normal/OB) som visas – endast kostnader är valbara.
- Ändringar i övriga sidor (index, admin) – endast `admin-summary.tsx` + ny/utökad server-funktion.
