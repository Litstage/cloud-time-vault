## OB-debitering per kund

Två nya prisfält på kunder som används vid fakturering (påverkar inte lönesidan).

### Databas (migration)
Lägg till på `public.clients`:
- `ob1_rate numeric not null default 0` — kr/tim mellan 22:00 och 07:00 alla dagar
- `ob2_rate numeric not null default 0` — kr/tim hela lördag och söndag

`hourly_rate` fortsätter gälla för övrig tid (normaltid).

### Prioritet vid överlapp
En lördag kl 23:00 räknas som **OB2** (helg vinner över natt). Detta är standardregeln i sammanställningen.

### Beräkningslogik (`src/lib/admin.functions.ts`)
Ny hjälpfunktion `splitEntryByBilling(start, end)` som stegar minut för minut och delar tiden i tre hinkar: `normalMs`, `billOb1Ms`, `billOb2Ms` enligt reglerna ovan (helt fristående från `ob_rules`).

I `getSummary` byts nuvarande `billing = (ms/h) * hourly_rate` mot:
`billing = normalH*hourly_rate + ob1H*ob1_rate + ob2H*ob2_rate`

Om kunden saknar OB-priser (0) faller de tillbaka på `hourly_rate` för konsekvent resultat.

### Admin-UI (`src/routes/_authenticated/admin-projects.tsx`)
I kunddialogen: två nya nummer-fält "OB1-pris (22–07)" och "OB2-pris (helg)" bredvid befintlig timdebitering.

### Sammanställning / PDF
Ingen struktur ändras — `totalBilling` och per-rad `billing` blir automatiskt korrekta. Ingen extra kolumn läggs till.

### Vad som INTE ändras
- `ob_rules`-tabellen, lönekostnad, OB-påslag för anställda.
- Tidregistrering, exports (CSV), månadsöversikt.
