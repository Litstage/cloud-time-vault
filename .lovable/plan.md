Öka storleken på "Lägg till tid"-dialogen så den känns rymligare på desktop/tablet.

## Ändringar
- I `src/routes/_authenticated/index.tsx`, på `<DialogContent>` för `ManualEntryDialog`: byt nuvarande bredd till `sm:max-w-lg` (eller `max-w-xl`) och öka inre padding/spacing (`p-6`, `gap-5`).
- Öka input-höjder till `h-12` och textstorlek till `text-base` för fälten Datum, Start, Slut, Projekt, Beskrivning.
- Större titel (`text-xl`) och något större knappar i footern.

Ingen ändring av logik eller datafält.