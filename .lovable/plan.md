## Nedsatt arbetsgivaravgift för unga 19–23 år (fr.o.m. 2026-04-01)

### Regel (enligt Skatteverket / riksdagsbeslut)
- Gäller ersättning som **betalas ut 2026-04-01 – 2027-09-30**.
- Omfattar personer som **vid årets ingång fyllt 18 men inte 23 år** (2026 = födda **2003–2007**).
- På lön upp till **25 000 kr/månad**: endast ålderspensionsavgift + halva övriga avgifter = **20,81 %**.
- På den del av månadslönen som överstiger 25 000 kr: full avgift **31,42 %**.
- Utanför perioden (före 1/4 2026 och efter 30/9 2027): full avgift som vanligt.

### Ändringar i koden

**1. `src/lib/employer-fee.ts`**
- Ny konstant `YOUTH_REDUCED_PCT = 20.81` och `YOUTH_SALARY_CAP = 25000`.
- Ny hjälpare `isYouthReductionEligible(birth, payoutDate)` – kollar född 2003–2007-motsvarande regel ("vid årets ingång fyllt 18 men inte 23") + att `payoutDate` ligger 2026-04-01 – 2027-09-30.
- Ny funktion `employerFeeForEntry({ birth, entryDate, grossThisMonth, entryGross })` som:
  - Om ung + inom perioden → applicerar 20,81 % på den del som ryms under 25 000 kr-taket för månaden, och 31,42 % på överskjutande.
  - Annars faller tillbaka på befintlig `employerFeePctForAge` (0 / 10,21 / 31,42 %).
- Returnerar `{ cost, effectivePct }` så rapporten kan visa vilken effektiv sats som använts.

**2. `src/lib/admin.functions.ts` – `getSummary`**
- Månadstaket på 25 000 kr är per **utbetalningsmånad**, så per användare aggregeras löpande bruttolön i månadsordning. Poster sorteras `(user_id, start_time asc)` och en `Map<userId+YYYY-MM, ackumuleradBrutto>` håller reda på hur mycket av taket som redan är förbrukat innan varje post.
- För varje post beräknas `entryGross = timmar * timlön + OB-tillägg`, sedan anropas `employerFeeForEntry` med `grossThisMonth` (ack. före posten) → arbetsgivarkostnaden blir korrekt även när en post spänner över taket.
- Fältet `employer_fee_pct` per rad ersätts med en beräknad effektiv sats (vägt genomsnitt om posten delas av taket).

**3. UI – `src/routes/_authenticated/admin.tsx` (användardialogen)**
- Hjälptext under "Arbetsgivaravgift (%)" uppdateras:
  > "Ignoreras om personnummer angetts. Då beräknas 0 / 10,21 / 20,81 / 31,42 % automatiskt utifrån ålder och utbetalningsdatum (ungdomsnedsättning 19–23 år, 1 apr 2026 – 30 sep 2027, lönetak 25 000 kr/mån)."

**4. UI – `src/routes/_authenticated/admin-summary.tsx`**
- Liten info-rad ovanför "Arbetsgivarkostnad"-summan som förklarar att ungdomsnedsättningen är inräknad när personnummer finns.
- (Ingen ny kolumn – vi håller det enkelt; effektiv sats syns implicit via kostnaden.)

### Utanför scope (frågar om det behövs sen)
- Växa-stödet (första anställd, 10,21 % i 24 mån).
- Regional nedsättning för stödområde A.
- Admin-inställningssida för att själv redigera satser/tak när Skatteverket ändrar dem.

### Verifiering
- Enhetstest-liknande sanity check i konsollen: en post på 30 000 kr brutto för en person född 2005, utbetald april 2026, ska ge arbetsgivarkostnad = 25000·1,2081 + 5000·1,3142 = **36 773 kr** (istället för 39 426 kr med full avgift).
- Person född 2002 (fyllt 24 vid årets ingång) → oförändrat 31,42 %.
- Post daterad mars 2026 → oförändrat 31,42 % även för född 2005.
