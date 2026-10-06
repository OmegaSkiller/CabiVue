import { z } from 'zod';
export const triState = z.enum(['yes', 'no', 'unknown']);
export const riskSchema = z.strictObject({
  urgent: triState,
  adult: triState,
  pregnancy: triState,
  highRisk: triState,
  unsafeExposure: triState,
});
export const safetySchema = z.enum([
  'emergency',
  'professional_review',
  'incomplete',
  'education_only',
]);
export const reportedGroupSchema = z.strictObject({
  groupIndex: z.number().int().min(0).max(4),
  quote: z.string().max(2000).nullable(),
  status: z.enum(['reported', 'no', 'unknown']),
});
export const assistantExtractionSchema = z.strictObject({
  urgency: safetySchema,
  groups: z.array(reportedGroupSchema).max(5),
  packIds: z.array(z.string().uuid()).max(3),
  sourceIds: z.array(z.string().uuid()).max(10),
});
export const answerSchema = z.strictObject({
  message: z.string().trim().min(1).max(2000),
  risk: riskSchema,
  useProvider: z.boolean(),
  consent: z.boolean(),
  packId: z.string().uuid().nullable().default(null),
});
export type Risk = z.infer<typeof riskSchema>;
export type SafetyState = z.infer<typeof safetySchema>;
export type ReportedGroup = z.infer<typeof reportedGroupSchema>;
export type Intake = {
  state: SafetyState;
  groups: ReportedGroup[];
  risk: Risk;
  confirmed: boolean;
};
export type IntakeView = Intake & {
  nextGroup: number | null;
  question: string | null;
  questions: readonly string[];
  urgentContact: string;
  urgentLocation: string;
  reminder: string;
  simulated: boolean;
};
