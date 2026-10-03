"use client";

import { useParams, useSearchParams } from "next/navigation";

import { ReportEditor } from "./report-editor";

export function NewReportRoute() {
  const searchParams = useSearchParams();
  return <ReportEditor entry={{ kind: "new", templateKey: searchParams.get("template"), accountId: searchParams.get("account") }} />;
}

export function SavedReportRoute() {
  const params = useParams<{ id: string }>();
  return <ReportEditor key={params.id} entry={{ kind: "saved", reportId: params.id }} />;
}
