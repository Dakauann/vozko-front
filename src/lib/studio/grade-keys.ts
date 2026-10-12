import { changedGrade, extrasOf, GRADE_FIELDS, isNeutralGrade, mergeGrade, storedGrade, type ColorGrade, type GradeField, type LookId } from "./color-grade";
import type { Clip } from "./document";
import { valueAt, withoutProperty } from "./keyframes";
import type { IssueCode } from "./validate";

type Graded = Partial<Pick<Clip, "type" | "color" | "keyframes">>;

export function isGradeProperty(property: string): property is GradeField {
  return (GRADE_FIELDS as readonly string[]).includes(property);
}

export function keyedGradeFields(clip: Graded): GradeField[] {
  return GRADE_FIELDS.filter((field) => (clip.keyframes?.[field]?.length ?? 0) > 0);
}

export function gradeAt(clip: Graded, localMs: number): ColorGrade | undefined {
  const keyed = keyedGradeFields(clip);
  if (keyed.length === 0) return isNeutralGrade(clip.color) ? undefined : clip.color;
  const values = Object.fromEntries(keyed.map((field) => [field, valueAt(clip.keyframes![field]!, localMs)]));
  const merged = mergeGrade(clip.color, values);
  return isNeutralGrade(merged) ? undefined : merged;
}

export function gradeKeysIssue(clip: Graded): IssueCode | null {
  if (keyedGradeFields(clip).length === 0) return null;
  return clip.type === "video" || clip.type === "image" || clip.type === "group" ? null : "invalid";
}

export function gradeLaneProperties(clip: Graded): GradeField[] {
  return keyedGradeFields(clip);
}

export function gradeStaticValue(clip: Graded, field: GradeField): number {
  return clip.color?.[field] ?? 0;
}

export function primaryResetPatch(clip: Graded): Pick<Clip, "color" | "keyframes"> {
  let keyframes = clip.keyframes;
  for (const field of GRADE_FIELDS) keyframes = withoutProperty(keyframes, field);
  return { color: storedGrade(extrasOf(clip.color)), keyframes };
}

export function lookPatch(clip: Graded, look: LookId, intensity: number): Pick<Clip, "color" | "keyframes"> {
  return { ...primaryResetPatch(clip), color: changedGrade(clip.color, { look, intensity }) };
}

export function gradeStaticPatch(clip: Graded, field: GradeField, value: number): Pick<Clip, "color"> {
  return { color: storedGrade(mergeGrade(clip.color, { [field]: value })) };
}
