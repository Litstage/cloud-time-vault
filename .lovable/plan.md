Plan: Lägg till en sammanfattningsrad längst ner på förstasidan (src/routes/_authenticated/index.tsx) som visar totala antalet timmar för den aktuellt valda perioden (dag/vecka/månad) och antalet poster.

Detaljer:
- Fil: src/routes/_authenticated/index.tsx
- Beräkna total tid för synliga poster: summera värdena i den befintliga `totals`-Map (ms) och räkna antalet poster i de filtrerade grupperna.
- Lägg till en liten hjälpfunktion `formatHours(ms)` som returnerar decimala timmar (t.ex. "12.50 h") om den inte redan finns i filen.
- Lägg till en sticky bottom-bar / kort direkt under poster-listan som visar:
  - "Total tid" med decimala timmar
  - "Antal poster" 
- Dölj summeringen när det inte finns några tidsposter i vald period.
- Anpassa utseendet efter befintlig design (Card, font-mono, tabular-nums, muted-foreground-etiketter).