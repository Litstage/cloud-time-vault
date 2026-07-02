## Förhandsvisning av PDF

Lägg till möjligheten att förhandsgranska PDF:en i webbläsaren innan nedladdning på sidan `admin-summary`.

### Ändringar

**`src/routes/_authenticated/admin-summary.tsx`**
- Refaktorera `exportPdf` så att `jsPDF`-dokumentet byggs i en separat funktion `buildPdf()` som returnerar doc-objektet (all logik för tabeller, avrundning, val av specifikation återanvänds).
- Lägg till en ny knapp **"Förhandsgranska PDF"** bredvid befintliga **"PDF"**-knappen.
- Vid klick: generera PDF:en, konvertera till `blob` → `URL.createObjectURL`, och visa i en `Dialog` med ett `<iframe>` (t.ex. `h-[80vh] w-full`).
- Dialogen har två knappar: **"Ladda ner"** (triggar samma `doc.save(...)`) och **"Stäng"** (revokerar object-URL:en).
- Behåll befintlig **"PDF"**-knapp för direkt nedladdning utan förhandsvisning.

### Teknisk detalj
- `doc.output("bloburl")` eller `new Blob([doc.output("arraybuffer")], { type: "application/pdf" })` för iframe-källa.
- Object-URL rensas med `URL.revokeObjectURL` när dialogen stängs för att undvika minnesläckor.
- Mobil: iframe med PDF fungerar sämre på iOS Safari — där visas istället en "Öppna PDF"-länk som fallback om `navigator.userAgent` indikerar iOS.
