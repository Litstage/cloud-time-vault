## Mål
Optimera appen för att användas på mobil i webbläsaren, och göra den installerbar på hemskärmen så den känns som en app.

## Vad jag gör

1. **Mobil-först layout på huvudvyn** (`src/routes/_authenticated/index.tsx`)
   - Sticky toppbar med pågående timer + dagens summa alltid synlig.
   - Stor start/stopp-knapp (full bredd, hög tryckyta) längst upp.
   - Tidsposter som kort istället för täta rader, datum-sektionerade.
   - Dag/Vecka/Månad-väljaren som segmenterad kontroll i full bredd.
   - Bottennavigation på mobil: Idag · Översikt · (Admin) · Meny.

2. **Responsiva fixar i admin-vyerna** (`admin.tsx`, `admin-projects.tsx`, `admin-summary.tsx`, `admin-ob.tsx`, `overview.tsx`)
   - Tabeller blir kort på <640px (varje rad = kort med etiketterade fält).
   - Rubrikrader: `grid-cols-[minmax(0,1fr)_auto]` + `min-w-0` + `truncate` så inget klipps.
   - Filterrader staplas vertikalt på mobil.

3. **Dialoger blir bottom sheets på mobil**
   - Manuell tidspost, användareredigering, projektredigering, OB-regel: full skärmhöjd, scrollbar inuti, sticky knappar i botten.

4. **Formulär och tryckytor**
   - Alla knappar minst 44px höga.
   - `inputMode="numeric"` på tid, timlön, OB-procent; `inputMode="decimal"` där relevant.
   - Större input-höjd (h-12) på mobil.

5. **Installerbar på hemskärmen (manifest-only PWA)**
   - `public/manifest.webmanifest` med namn, theme color (amber), `display: "standalone"`.
   - 192px + 512px ikoner i `public/` (genereras).
   - `<link rel="manifest">`, `theme-color` och `apple-touch-icon` i `src/routes/__root.tsx`.
   - Ingen service worker, ingen offline-cache.

6. **Förhandsvisning**
   - Växlar editor-preview till mobil så du ser resultatet direkt. Du kan byta tillbaka via enhetsknappen ovanför previewen.

## Det jag inte gör
- Ingen native-paketering (Capacitor / App Store / Play).
- Ingen offline-funktion / service worker.
- Inga push-notiser.
- Inga ändringar av databas, RLS eller serverlogik.
- Inga färg- eller typografibyten — befintligt amber-tema behålls.
