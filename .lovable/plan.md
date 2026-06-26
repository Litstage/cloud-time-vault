## Ändring
Sätt `weekStartsOn={1}` (måndag) som default i `src/components/ui/calendar.tsx` så att alla kalendrar i appen visar måndag som första veckodag. Detta påverkar både datumväljaren i "Lägg till tid" och dagfiltret på startsidan.

Detta är minsta möjliga ändring och täcker alla nuvarande och framtida `<Calendar />`-användningar.
