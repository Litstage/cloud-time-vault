Plan:

1. Behåll nuvarande affärsregel: OB för användarnas lön är procentpåslag på timlönen.
   - Formel: `bruttolön = timlön × normala timmar + timlön × (1 + OB% / 100) × OB-timmar`.
   - Exempel: timlön 200 kr, OB1 50, 2 OB-timmar = 200 × 1,5 × 2 = 600 kr.

2. Förtydliga admin-UI:t så att det inte går att tolka OB som kronor.
   - Behåll etiketter som `OB1 (% påslag)`, `OB2 (% påslag)`, `OB3 (% påslag)`.
   - Lägg till kort hjälptext vid lönefälten: `50 betyder +50% på timlönen, inte 50 kr/timme`.

3. Förtydliga sammanställningen.
   - Lägg till en liten förklaring nära bruttolön i admin-sammanställningen att bruttolön inkluderar procentbaserad OB.
   - Ingen ändring av själva beräkningen.

4. Verifiera att beräkningskedjan fortfarande är oförändrad.
   - Kontrollera att rapporten fortsatt använder `computePay` med procent-OB.
   - Kontrollera att UI-texten visas utan att påverka PDF/export eller fakturering.