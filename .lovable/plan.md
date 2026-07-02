## Ändring
I sammanställningen (`src/routes/_authenticated/admin-summary.tsx`) ersätter jag OB-timmar-visningen med OB-belopp i kronor per användare.

## Detaljer
- Toggle "OB-timmar" byter namn till "OB (kr)".
- Per användarrad: istället för att visa OB1/OB2/OB3-timmar visas OB-tilläggets kronbelopp (bruttolön OB-del) = `timlön × (ob_pct/100) × ob-timmar` per bucket, samt summa.
- Totalsummor uppe på sidan visar total OB-kostnad i kr istället för totala OB-timmar.
- Samma ändring speglas i PDF-exporten (kolumn/rad "OB kr" ersätter "OB h").
- Kund- och projekt-sektionerna påverkas inte (där är OB fortfarande fakturering mot kund).

Ingen ändring av beräkningsmotorn i `src/lib/ob.ts` – kronbeloppen finns redan via `computePay` (bruttolön-OB-delen), jag exponerar bara dem i UI/PDF.
