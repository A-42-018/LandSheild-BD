/** Built-in sample notices (synthetic), shown only while the admin-managed list (U3.6, `useNotices`) is loading or unreachable.
 *  Copy lives in `landing.notices.items.<id>`. `ticker`: only flagged notices scroll in the header ticker, every notice is on the board. */
export const NOTICES = [
  { id: "n1", date: "2026-10-14", ticker: true },
  { id: "n2", date: "2026-10-12", ticker: true },
  { id: "n3", date: "2026-10-07", ticker: false },
  { id: "n4", date: "2026-10-06", ticker: true },
] as const;

/** Anchor of one notice on the home-page board. */
export const noticeAnchor = (id: string) => `notice-${id}`;
