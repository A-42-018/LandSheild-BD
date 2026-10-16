/** Demo notices (synthetic). One list feeds the header ticker and the home-page notice board; copy lives in `landing.notices.items.<id>`.
 *  `ticker` is the flag U3.6 will let an admin set: only flagged notices scroll in the ticker, every notice is on the board. */
export const NOTICES = [
  { id: "n1", date: "2026-10-14", ticker: true },
  { id: "n2", date: "2026-10-12", ticker: true },
  { id: "n3", date: "2026-10-07", ticker: false },
  { id: "n4", date: "2026-10-06", ticker: true },
] as const;

export type NoticeId = (typeof NOTICES)[number]["id"];

/** Anchor of one notice on the home-page board. */
export const noticeAnchor = (id: NoticeId) => `notice-${id}`;
