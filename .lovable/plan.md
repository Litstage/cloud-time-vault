## Mål
När sluttid är tidigare än (eller lika med) starttid på samma datum vid manuell tidsregistrering ska sluttiden tolkas som nästa dygn istället för att avvisas.

## Ändring
**`src/routes/_authenticated/index.tsx` – `ManualEntryDialog.save()`**

Ta bort felmeddelandet "Sluttid måste vara efter starttid". Om `endIso <= startIso`, lägg till ett dygn på `endIso` innan posten sparas. Då blir t.ex. start 22:00 och slut 06:00 en post som löper över midnatt (8 timmar).

Ingen ändring krävs i durationsberäkningar (de räknar redan rakt på `end - start` i ms), inte heller i översikt eller admin, eftersom posten lagras med korrekta ISO-tidsstämplar.

## Edge case
Om start och slut är exakt samma tid räknas det också som +24h (en heldagspost). Det matchar formuleringen "sluttid före starttid = nästa dygn" tolkat inklusive lika.
