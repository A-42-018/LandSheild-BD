"use client";
import { useCallback, useRef } from "react";
import { useReviewActions } from "./useReviewActions";
import type { ExtractionOut, RecordOp } from "./types";

/**
 * Queue of record edits (H6b). `save` sends the given ops in one PATCH /documents/{id}/extraction
 * ({record: ops}); saves run one after the other so two quick edits never race over the same version.
 * The answer replaces the cached extraction, so the record, its issues and the derived 13 fields refresh.
 * A refused save rejects with the ApiError (see toRecordErrors).
 */
export function useRecordEdit(documentId: string) {
  const { saveRecord } = useReviewActions(documentId);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  const { mutateAsync } = saveRecord;
  const save = useCallback(
    (ops: RecordOp | RecordOp[]): Promise<ExtractionOut> => {
      const run = chain.current.then(() => mutateAsync(Array.isArray(ops) ? ops : [ops]));
      chain.current = run.catch(() => undefined);
      return run;
    },
    [mutateAsync],
  );
  return { save, saving: saveRecord.isPending };
}
