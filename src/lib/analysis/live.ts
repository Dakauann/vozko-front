import type {
  Analysis,
  AnalysisDisposition,
  AnalysisEntryType,
  AnalysisInterest,
  AnalysisNextAction,
  AnalysisQualification,
  AnalysisSentiment,
} from "./types";
import type { InboxEntry } from "@/lib/conversations/types";
import type { LiveRead } from "@/lib/live-decisions/types";

const INTERESTS: AnalysisInterest[] = ["interested", "not_interested", "undecided"];
const DISPOSITIONS: string[] = ["sale", "filling_info", "callback", "declined", "pending"];
const SENTIMENTS: AnalysisSentiment[] = ["positive", "neutral", "negative"];
const QUALIFICATIONS: AnalysisQualification[] = ["hot_lead", "warm_lead", "cold_lead"];
const NEXT_ACTIONS: AnalysisNextAction[] = ["schedule_callback", "send_whatsapp", "close", "escalate", "continue"];

type Labels = Pick<Analysis, "interest" | "disposition" | "sentiment" | "qualification" | "nextAction">;

function labelsOf(read: LiveRead): Labels | null {
  const { interest, disposition, sentiment, qualification, nextAction } = read;
  if (
    !INTERESTS.includes(interest as AnalysisInterest) ||
    !DISPOSITIONS.includes(disposition ?? "") ||
    !SENTIMENTS.includes(sentiment as AnalysisSentiment) ||
    !QUALIFICATIONS.includes(qualification as AnalysisQualification) ||
    !NEXT_ACTIONS.includes(nextAction as AnalysisNextAction)
  ) {
    return null;
  }
  return {
    interest: interest as AnalysisInterest,
    disposition: disposition as AnalysisDisposition,
    sentiment: sentiment as AnalysisSentiment,
    qualification: qualification as AnalysisQualification,
    nextAction: nextAction as AnalysisNextAction,
  };
}

function isNewer(read: LiveRead, analysis: Analysis | null): boolean {
  if (!analysis) return true;
  return new Date(read.decidedAt).getTime() > new Date(analysis.createdAt).getTime();
}

export interface AnalysisSubject {
  entryId: string;
  entryType: AnalysisEntryType;
}

export function withLiveRead(
  analysis: Analysis | null,
  read: LiveRead | null | undefined,
  subject: AnalysisSubject,
): Analysis | null {
  const labels = read && isNewer(read, analysis) ? labelsOf(read) : null;
  if (!read || !labels) return analysis;
  const live = { ...labels, attendanceQuality: read.attendanceQuality, createdAt: read.decidedAt };
  const base: Analysis = analysis ?? {
    id: `live-${subject.entryId}`,
    entryId: subject.entryId,
    entryType: subject.entryType,
    productInterest: null,
    summary: "",
    messageCount: 0,
    ...live,
  };
  return { ...base, ...live };
}

export function effectiveAnalysis(entry: InboxEntry): Analysis | null {
  return withLiveRead(entry.latest_analysis ?? null, entry.live_read, {
    entryId: entry.entry_id,
    entryType: entry.entry_type as AnalysisEntryType,
  });
}
