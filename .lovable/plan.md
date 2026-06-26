Fixa två saker i "Lägg till tid"-dialogen i `src/routes/_authenticated/index.tsx`.

## 1. Start/Slut överlappar
Orsak: `Input type="time"` renderar en native spinner/ikon till höger som sticker ut över nästa fält när vi tvingat upp höjden till `h-12` + `text-base`. Båda fälten ligger dessutom i ett `grid grid-cols-2 gap-3` utan tydlig separation.

Åtgärd:
- Öka gapet till `gap-4`.
- Lägg `min-w-0 w-full` på time-inputs så de inte växer förbi sin grid-cell.
- Lägg `[&::-webkit-calendar-picker-indicator]:opacity-60 [&::-webkit-calendar-picker-indicator]:cursor-pointer` så indikatorn håller sig inom fältet och slutar visuellt överlappa.

## 2. Manuell inmatning av datum
Idag är Datum bara en knapp som öppnar kalendern. Ändra till ett textfält där användaren kan skriva `ÅÅÅÅ-MM-DD` direkt, med en liten kalender-ikon-knapp bredvid som fortfarande öppnar popover-kalendern.

- Lägg till lokal state `dateText` synkad med `date`.
- Skriv in → parsa med `new Date(value)`; om giltigt sätts `date`, annars visa fältet som ogiltigt utan att krascha.
- Kalender-popover öppnas via ikon-knappen och uppdaterar både `date` och `dateText`.
- Tidsfälten (`type="time"`) tillåter redan manuell inmatning – ingen ändring av logiken där.

Ingen ändring av sparlogik eller datamodell.