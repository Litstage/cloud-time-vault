Jag fixar manuellt skrivbar tid i dialogen för att lägga till tid.

Ändringar:
1. Byt start- och sluttidsfälten från `type="time"` till vanliga textfält, så de alltid går att skriva i manuellt på både mobil och dator.
2. Tillåt svensk tidsinmatning som `08:30`, `8:30`, `0830`, `8.30` och normalisera till `HH:mm`.
3. Lägg till tydlig validering om tiden inte kan tolkas.
4. Behåll befintlig logik: om sluttid är före starttid räknas det som nästa dygn.
5. Kontrollera att rutorna inte överlappar efter ändringen.

Detta är en liten frontend-fix i befintlig tidregistreringsdialog och kräver ingen databasmigrering.