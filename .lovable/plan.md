## Ändring
Sätt svensk locale som default i `src/components/ui/calendar.tsx`:

- Importera `sv` från `date-fns/locale`.
- Lägg till `locale = sv` som default-prop och vidarebefordra till `<DayPicker>`.
- Ta bort den hårdkodade `toLocaleString("default", { month: "short" })` i `formatMonthDropdown` så att react-day-picker själv formaterar månadsnamn enligt locale.

Påverkar alla kalendrar i appen – veckodagar visas som må/ti/on/to/fr/lö/sö och månadsnamn på svenska. `date-fns` finns redan i projektet (används av shadcn-komponenterna).
