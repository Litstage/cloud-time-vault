## Mål
1. Admin kan spara **personnummer** per användare.
2. **Arbetsgivaravgiften** räknas automatiskt utifrån användarens ålder vid arbetstillfället, istället för en fast procent per användare.

## Databas
Migration som lägger till kolumnen `personal_number text` på `public.user_wages` (den enda admin-only-tabellen kopplad till användare). RLS är redan satt så bara admin ser/skriver där — personnumret exponeras inte för vanliga användare eller `anon`.

Enkel validering i UI: 10 eller 12 siffror (ÅÅMMDD-XXXX / ÅÅÅÅMMDD-XXXX), bindestreck valfritt.

## Åldersregler (Skatteverket, standard)
Ny hjälpare `src/lib/employer-fee.ts` med `employerFeePctForAge(birthDate, workDate)`:

- **Under 15 år** → 0 %
- **15–17 år** (fyllt 15 men inte 18 vid årets ingång) → 10,21 %
- **18–65 år** → 31,42 %  *(full avgift)*
- **66 år och äldre** (född tidigare år än arbetsåret − 65) → 10,21 %
- **Född 1938 eller tidigare-motsvarighet (över 87 år)** → 0 %

Parser `parsePersonalNumber(pn)` som returnerar `Date` eller `null` (hanterar sekelsiffra via kontrolltecken `+`/`-` och 12-siffrigt format).

Om personnummer saknas eller är ogiltigt → använd den manuellt inmatade `employer_fee_pct` från `user_wages` som fallback (befintligt beteende bevaras).

## Server / rapporter
- `src/lib/admin.functions.ts` – `getSummary`: när `user_wages` läses in, plocka även `personal_number`. För varje tidspost räkna ut avgiftsprocenten via `employerFeePctForAge(birth, entry.started_at)`; fall tillbaka till lagrad procent om personnr saknas. Ingen ändring av returtyper.
- `updateUserWage` / `upsertUserWage` (eller vad den heter): tar emot valfritt `personal_number` och sparar det.

## UI
- `src/routes/_authenticated/admin.tsx`, "Redigera användare"-dialogen:
  - Nytt fält **"Personnummer (ÅÅÅÅMMDD-XXXX)"** överst i "Lön & OB"-boxen.
  - Under "Arbetsgivaravgift (%)" visas hjälptext: *"Lämnas tomt om personnummer angetts — då beräknas avgiften automatiskt utifrån ålder (0 / 10,21 / 31,42 %)."*
  - Skickar med `personal_number` när formuläret sparas.

## Ingen ändring
- Nettoskatt, skattetabeller, OB-regler, tidsregistrering och andra vyer rörs inte.
- Personnumret visas aldrig i listor för icke-admin och exponeras aldrig till klient-RLS för vanliga användare.
