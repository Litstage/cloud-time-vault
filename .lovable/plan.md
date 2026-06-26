Jag återinför tidslistan vid sidan av det manuella textfältet.

För både Start och Slut:
- Behåll det manuellt skrivbara textfältet (`HH:MM`, accepterar `8:30`, `0830`, `8.30`).
- Lägg till en klock-ikonknapp bredvid som öppnar en popover med en scrollbar lista av tider i 15-minuters­intervall (00:00–23:45).
- Val i listan fyller i textfältet; manuell inmatning fortsätter fungera precis som nu.

Endast frontend-ändring i `ManualEntryDialog` i `src/routes/_authenticated/index.tsx`.