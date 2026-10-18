"use client";
import { createContext, useContext, useMemo } from "react";
import { useRecordEdit } from "../useRecordEdit";
import type { ExtractionOut, RecordOp } from "../types";

export interface RecordIssueView {
  path: string;
  code: string;
  message: string;
  severity: "error" | "warning";
}

interface Ctx {
  editable: boolean;
  save: (ops: RecordOp | RecordOp[]) => Promise<ExtractionOut>;
  issues: RecordIssueView[];
}

const RecordEditContext = createContext<Ctx | null>(null);

/** What a value in the digital deed needs to be edited and to show its issues; null = read-only view. */
export const useRecordEditContext = () => useContext(RecordEditContext);

/** The H1 content issues of the record, errors first. */
export function issuesOf(data: ExtractionOut): RecordIssueView[] {
  const v = data.record_validation;
  if (!v) return [];
  return [
    ...v.errors.map((i) => ({ ...i, severity: "error" as const })),
    ...v.warnings.map((i) => ({ ...i, severity: "warning" as const })),
  ];
}

export function RecordEditProvider({
  documentId,
  editable,
  issues,
  children,
}: {
  documentId: string;
  editable: boolean;
  issues: RecordIssueView[];
  children: React.ReactNode;
}) {
  const { save } = useRecordEdit(documentId);
  const value = useMemo(() => ({ editable, save, issues }), [editable, save, issues]);
  return <RecordEditContext.Provider value={value}>{children}</RecordEditContext.Provider>;
}

/** Issues that belong to a value: the pointer itself or anything below it. */
export function issuesAt(issues: RecordIssueView[], path: string): RecordIssueView[] {
  return issues.filter((i) => i.path === path || i.path.startsWith(`${path}/`));
}

/** Forces the read-only view even below an editing provider (H7d: the document page shows saved versions). */
export function ReadOnlyRecord({ children }: { children: React.ReactNode }) {
  return <RecordEditContext.Provider value={null}>{children}</RecordEditContext.Provider>;
}
