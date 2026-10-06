import type { Intake, Risk, SafetyState, ReportedGroup } from '../contracts/assistant.js';
export const QUESTIONS = [
  'Are there urgent or severe symptoms, possible overdose, poisoning, or a severe allergic reaction?',
  'What symptoms are present, when did they begin, and are they worsening or returning after improvement? Include measured temperature if known.',
  'Who is this for, and what is their age? Include pregnancy or breastfeeding, allergies and reactions, medical conditions, and immune suppression. Keep unknown answers explicit.',
  'What prescription medicines, OTC products, and supplements are used or were recently taken? Include exact products, reported amounts and times where known, including anything outside this cabinet.',
  'Was there alcohol, cannabis, a stimulant, sedative, another recreational substance, withdrawal, or a new medication/substance exposure around symptom onset? Unknown is an acceptable answer.',
] as const;
export const PROFESSIONAL_REMINDER =
  'Ask a pharmacist or doctor whether a medicine is suitable for you before choosing medication. This interview does not diagnose or exclude serious illness.';
export function newIntake(): Intake {
  return {
    state: 'incomplete',
    groups: QUESTIONS.map((_, groupIndex) => ({ groupIndex, quote: null, status: 'unknown' })),
    risk: {
      urgent: 'unknown',
      adult: 'unknown',
      pregnancy: 'unknown',
      highRisk: 'unknown',
      unsafeExposure: 'unknown',
    },
    confirmed: false,
  };
}
export function mergeSafety(current: SafetyState, next: SafetyState): SafetyState {
  if (current === 'emergency' || next === 'emergency') return 'emergency';
  if (current === 'professional_review' || next === 'professional_review')
    return 'professional_review';
  return next;
}
const urgentPattern =
  /overdose|poisoning|seizures?|cannot breathe|can’t breathe|can't breathe|difficulty breathing|shortness of breath|persistent chest pain|unable to stay awake|severe allergic reaction|затруднено дишане|не мога да дишам|судороги|не могу дышать|передозировка|отравление/giu;
export function concerningReport(message: string): boolean {
  for (const clause of message.split(/[.!?\n]/))
    for (const match of clause.matchAll(urgentPattern)) {
      const prefix = clause.slice(0, match.index).slice(-40).trim();
      if (
        !/(?:\b(?:no|not|without|denies|deny)\s*(?:any\s*)?|(?:няма|нет|отрицаю)\s*)$/iu.test(
          prefix,
        )
      )
        return true;
    }
  return false;
}
export function nextGroup(intake: Intake): number | null {
  const n = intake.groups.find((g) => g.quote === null)?.groupIndex;
  return n === undefined ? null : n;
}
export function evaluateIntake(current: Intake, risk: Risk, message = ''): SafetyState {
  const emergency = risk.urgent === 'yes' || concerningReport(message);
  const review =
    risk.adult === 'no' ||
    risk.pregnancy === 'yes' ||
    risk.highRisk === 'yes' ||
    risk.unsafeExposure === 'yes';
  const complete =
    nextGroup(current) === null &&
    risk.urgent === 'no' &&
    risk.adult === 'yes' &&
    risk.pregnancy === 'no' &&
    risk.highRisk === 'no' &&
    risk.unsafeExposure === 'no';
  return mergeSafety(
    current.state,
    emergency
      ? 'emergency'
      : review
        ? 'professional_review'
        : complete
          ? 'education_only'
          : 'incomplete',
  );
}
export function supportedQuotes(groups: ReportedGroup[], message: string): ReportedGroup[] {
  if (new Set(groups.map((g) => g.groupIndex)).size !== groups.length)
    throw new Error('Repeated interview group.');
  return groups.map((g) => {
    if (g.quote !== null && (!g.quote.trim() || !message.includes(g.quote)))
      throw new Error('An extracted quote is not supported by the supplied message.');
    if (
      g.status === 'no' &&
      (!g.quote || !/^(no\b|none\b|not\b|няма|нет|не\s)/iu.test(g.quote.trim()))
    )
      throw new Error('A negative answer was not explicit.');
    return { ...g, status: g.quote === null ? 'unknown' : g.status };
  });
}
