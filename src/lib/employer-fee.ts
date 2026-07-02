// Beräknar arbetsgivaravgift (%) utifrån ålder enligt Skatteverkets standardregler.
// - Under 15 år: 0 %
// - 15–17 år (fyllt 15 men inte 18 vid årets ingång): 10,21 %
// - 18–65 år (ordinarie): 31,42 %
// - 66 år och äldre vid årets ingång: 10,21 %
// - Över 87 år vid årets ingång: 0 %

export const FULL_EMPLOYER_FEE_PCT = 31.42;
export const REDUCED_EMPLOYER_FEE_PCT = 10.21;

/**
 * Tillfällig nedsättning av arbetsgivaravgifter för unga 19–23 år.
 * Gäller ersättning som betalas ut 2026-04-01 – 2027-09-30, för personer
 * som vid årets ingång fyllt 18 men inte 23 år (för 2026 = födda 2003–2007).
 * På lön upp till 25 000 kr/mån betalas 20,81 % (ålderspensionsavgift +
 * hälften av övriga avgifter). Överskjutande del: full avgift 31,42 %.
 */
export const YOUTH_REDUCED_PCT = 20.81;
export const YOUTH_SALARY_CAP = 25000;
export const YOUTH_PERIOD_START = new Date(Date.UTC(2026, 3, 1)); // 2026-04-01
export const YOUTH_PERIOD_END = new Date(Date.UTC(2027, 8, 30, 23, 59, 59)); // 2027-09-30

/**
 * Parsar ett svenskt personnummer (10 eller 12 siffror, valfritt bindestreck/plus)
 * och returnerar födelsedatumet, eller null om det inte går att tolka.
 * Sekelbestämning: 12 siffror används direkt; för 10 siffror antas 1900-talet
 * om personen skulle vara under 100 år, annars 2000-talet. Skiljetecknet "+"
 * (istället för "-") flyttar bak födelseåret 100 år.
 */
export function parsePersonalNumber(pn: string | null | undefined): Date | null {
  if (!pn) return null;
  const raw = pn.trim();
  if (!raw) return null;
  const plusMarker = /\+\d{4}$/.test(raw.replace(/\s/g, ""));
  const digits = raw.replace(/\D/g, "");
  let year: number, month: number, day: number;
  if (digits.length === 12) {
    year = Number(digits.slice(0, 4));
    month = Number(digits.slice(4, 6));
    day = Number(digits.slice(6, 8));
  } else if (digits.length === 10) {
    const yy = Number(digits.slice(0, 2));
    month = Number(digits.slice(2, 4));
    day = Number(digits.slice(4, 6));
    const now = new Date();
    const currentYy = now.getFullYear() % 100;
    // Standardregel: 19xx om personen då skulle vara <100 år, annars 20xx
    let century = yy <= currentYy ? 2000 : 1900;
    year = century + yy;
    if (plusMarker) year -= 100;
  } else {
    return null;
  }
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  ) {
    return null;
  }
  return d;
}

/** Ålder i hela år vid ett givet datum. */
export function ageAt(birth: Date, at: Date): number {
  let age = at.getFullYear() - birth.getFullYear();
  const m = at.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && at.getDate() < birth.getDate())) age -= 1;
  return age;
}

/** Ålder vid årets ingång (1 januari) av arbetsårets datum. */
export function ageAtStartOfYear(birth: Date, workDate: Date): number {
  const startOfYear = new Date(workDate.getFullYear(), 0, 1);
  return ageAt(birth, startOfYear);
}

/**
 * Returnerar arbetsgivaravgift i procent för given ålder vid arbetstillfället.
 * Åldersgränserna utvärderas mot 1 januari arbetsåret enligt Skatteverkets praxis.
 */
export function employerFeePctForAge(birth: Date, workDate: Date): number {
  const age = ageAtStartOfYear(birth, workDate);
  if (age < 15) return 0;
  if (age < 18) return REDUCED_EMPLOYER_FEE_PCT;
  if (age > 87) return 0;
  if (age >= 66) return REDUCED_EMPLOYER_FEE_PCT;
  return FULL_EMPLOYER_FEE_PCT;
}

/**
 * True om personen omfattas av ungdomsnedsättningen 19–23 år vid arbetstillfället.
 * Kräver att åldern vid årets ingång är 18–22 år OCH att datumet ligger inom
 * perioden 2026-04-01 – 2027-09-30.
 */
export function isYouthReductionEligible(birth: Date, workDate: Date): boolean {
  const t = workDate.getTime();
  if (t < YOUTH_PERIOD_START.getTime() || t > YOUTH_PERIOD_END.getTime()) return false;
  const age = ageAtStartOfYear(birth, workDate);
  return age >= 18 && age <= 22;
}

/**
 * Beräknar arbetsgivarkostnad för en enskild lönepost och tar hänsyn till
 * ungdomsnedsättningens månadstak (25 000 kr per utbetalningsmånad).
 *
 * @param birth              Födelsedatum, eller null om personnummer saknas.
 * @param entryDate          Datum för posten (används både för ålder och period).
 * @param entryGross         Bruttolön (kr) för just denna post.
 * @param grossBeforeInMonth Ackumulerad bruttolön (kr) tidigare i samma månad
 *                           för samma användare, exkl. denna post.
 * @param fallbackPct        Sats att använda när personnummer saknas (manuell).
 */
export function employerFeeForEntry(args: {
  birth: Date | null;
  entryDate: Date;
  entryGross: number;
  grossBeforeInMonth: number;
  fallbackPct: number;
}): { cost: number; effectivePct: number } {
  const { birth, entryDate, entryGross, grossBeforeInMonth, fallbackPct } = args;
  const gross = Math.max(0, entryGross);
  if (gross === 0) return { cost: 0, effectivePct: 0 };

  if (birth && isYouthReductionEligible(birth, entryDate)) {
    const remainingUnderCap = Math.max(0, YOUTH_SALARY_CAP - Math.max(0, grossBeforeInMonth));
    const underCap = Math.min(gross, remainingUnderCap);
    const overCap = gross - underCap;
    const cost =
      underCap * (YOUTH_REDUCED_PCT / 100) +
      overCap * (FULL_EMPLOYER_FEE_PCT / 100);
    const effectivePct = (cost / gross) * 100;
    return { cost: gross + cost, effectivePct };
  }

  const pct = birth ? employerFeePctForAge(birth, entryDate) : fallbackPct;
  return { cost: gross * (1 + pct / 100), effectivePct: pct };
}