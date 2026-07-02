## Lägg till OB-toggle i sammanställningen

Lägg till en ny kryssruta **"OB-timmar"** bredvid Bruttolön / Netto / Arbetsgivarkostnad / Debitering i sammanställningen (`src/routes/_authenticated/admin-summary.tsx`).

### Beteende
- **Ny state**: `showOb` (default `true`).
- **Ny CostToggle**: "OB-timmar" placeras direkt efter "Debitering kund".
- **På skärmen (totalt)**: OB1/OB2/OB3-Stat-korten visas endast när `showOb` är på (samma villkor som övriga cost-stats).
- **På skärmen (per rad i SummarySection)**: raderna `OB1 x h` / `OB2 y h` göms när `showOb` är av — ny prop `showOb` skickas till `SummarySection`.
- **PDF-export**: OB-raden `"Normal / OB1 / OB2 / OB3"` i totals och OB1/OB2-kolumnerna i detaljtabellen inkluderas endast när `showOb` är på.

Ingen ändring i beräkningslogik eller layout i övrigt.
