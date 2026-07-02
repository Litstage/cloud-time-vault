Add an optional “round to whole hours” mode for the PDF export in the admin summary page.

## What to build

1. **Rounding helper in `src/routes/_authenticated/admin-summary.tsx`**
   - `roundHours(ms: number): number` – converts ms to hours, then rounds to nearest whole hour using half-up rules (≥ 0.5 rounds up, < 0.5 rounds down).
   - Display helper `fmtRoundedHours(ms: number): string` that returns the rounded hour count as a plain integer string, e.g. "3 h".

2. **User-facing toggle**
   - Add a new state `roundPdfHours: boolean` (default `false`).
   - Add a checkbox in the existing “Visa kostnader” popover labelled “Avrunda timmar till heltimmar i PDF”.

3. **Apply rounding only in the PDF export**
   - When `roundPdfHours` is true, replace `fmtHours(...)` with `fmtRoundedHours(...)` for every time column and total in `exportPdf()`:
     - Totaler (Total tid, Normal/OB split)
     - Per kund, per projekt, per användare
     - Poster or “per användare och dag” specification table
   - A small note is appended under the filter block: “Tider är avrundade till närmaste heltimme.” when rounding is active.
   - CSV export and the on-screen summary figures remain unchanged.

## Files changed

- `src/routes/_authenticated/admin-summary.tsx`

## Not in scope

- Rounding the underlying cost calculations; displayed amounts continue to reflect exact hours.
- Changing the web UI table or CSV export.