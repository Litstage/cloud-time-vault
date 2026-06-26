## Mål
- Per användare: **timlön** och **OB-ersättning** (procentsatser för OB1/OB2/OB3) som bara admin kan se/redigera.
- Konfigurerbara **OB-regler** (veckodag + tidsintervall → OB-nivå) under admin.
- Sammanställningar visar **normaltid vs OB-timmar** (per nivå) samt **lönebelopp** (grundlön + OB-tillägg).

## 1. Databas (migration)

**`public.user_wages`** (en rad per användare):
- `user_id` (PK, FK auth.users)
- `hourly_rate numeric(10,2)` – grundtimlön (kr)
- `ob1_pct numeric(5,2)` – procentpåslag OB1 (t.ex. 50.00)
- `ob2_pct numeric(5,2)` – OB2 (t.ex. 70.00)
- `ob3_pct numeric(5,2)` – OB3 (t.ex. 100.00)
- RLS: endast admin kan SELECT/INSERT/UPDATE/DELETE (`has_role(auth.uid(),'admin')`).

**`public.ob_rules`** (globala regler):
- `id`, `name text`
- `level smallint` (1/2/3 → OB1/OB2/OB3)
- `weekday smallint` (0=söndag … 6=lördag, matchar JS `getDay()`)
- `start_time time`, `end_time time` (om end < start → spänner över midnatt)
- `active boolean default true`
- RLS: alla inloggade får SELECT (för att kunna räkna i klienten), endast admin INSERT/UPDATE/DELETE.

GRANT på båda enligt regler (authenticated + service_role).

## 2. OB-beräkning
Hjälpfunktion `splitEntryByOb(start, end, rules)` i `src/lib/ob.ts`:
- Itererar minut-/segmentvis genom tidsposten (klipp på dygnsgräns + regelgränser).
- För varje segment: hitta högsta matchande `level` bland aktiva regler; om ingen match → normaltid (level 0).
- Returnerar `{ normalMs, ob1Ms, ob2Ms, ob3Ms }`.

Lönebelopp = `hourly_rate * (normal + ob1*(1+ob1_pct/100) + ob2*(1+ob2_pct/100) + ob3*(1+ob3_pct/100))`.

## 3. Admin-UI
- **`src/routes/_authenticated/admin.tsx`** – i användardialogen lägg till fält "Timlön (kr)", "OB1 %", "OB2 %", "OB3 %" (läses/sparas via nya server-fn `getUserWage`, `upsertUserWage` i `src/lib/admin.functions.ts`).
- **Ny sida `src/routes/_authenticated/admin-ob.tsx`** – CRUD för `ob_rules`:
  - Lista regler grupperade på nivå.
  - Skapa/redigera: namn, nivå (1/2/3), veckodag (mån-sön, sv lokal), starttid, sluttid.
  - Länk till sidan från admin-startsidan.

## 4. Sammanställning
**`src/routes/_authenticated/admin-summary.tsx`** + tillhörande `getSummary`-serverfn:
- Hämta OB-regler en gång; för varje time_entry kör `splitEntryByOb`.
- Aggregera per kund/projekt/användare: `normalH`, `ob1H`, `ob2H`, `ob3H`, `totalH`, `belopp`.
- Visa kolumner: Normal | OB1 | OB2 | OB3 | Totalt | Belopp (kr) – per användare baseras belopp på användarens egen timlön/OB-%.
- CSV-export utökas med samma kolumner.

**`src/routes/_authenticated/overview.tsx`** (månadsöversikt): visa endast timuppdelning normal/OB (utan belopp, eftersom vanliga användare inte ska se sin lön där om de inte är admin – om det är OK lägger vi till belopp där också; säg till om du vill ha det).

## 5. Säkerhet
- `user_wages`: ingen vanlig användare ser sin egen rad (admin-only). Om vi senare vill att användaren själv ska se sin lön får vi öppna policyn.
- Lönefält visas bara i admin-vyer.

## Tekniskt
- Inga ändringar i `time_entries`-schema.
- OB-uppdelning sker on-the-fly vid rendering/aggregering (regler kan ändras retroaktivt).
- Tidszon: hela appen kör lokal tid (svensk) som idag – `splitEntryByOb` använder `Date`-metoder lokalt.
