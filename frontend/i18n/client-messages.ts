import type { AbstractIntlMessages } from "next-intl";

/**
 * Which messages reach the browser. Server components read the whole file through getTranslations/useTranslations on the
 * server; only client components need messages in the page, and sending all of bn.json (staff namespaces included) cost
 * the home page about 35 KB gzipped.
 *
 * SHELL goes to every page from app/[locale]/layout.tsx: the header, top strip, ticker, help button, "was this helpful",
 * error and loading screens, plus a few small namespaces most routes use (breadcrumb, sign-in gate, status and risk
 * labels). A route that needs more wraps its tree in <ClientMessages scope="…">, which adds that scope to SHELL.
 *
 * Paths are namespaces ("verify") or parts of one ("result.units"). tests/client-messages.test.ts fails when a client
 * component reads something its route does not send; its message says which file needs which path.
 */
export const SHELL_MESSAGES: readonly string[] = [
  "common",
  "errors",
  "errorPages",
  "nav",
  "roles",
  "strip",
  "ticker",
  "theme",
  "table",
  "help",
  "landing.notices",
  "feedback.helpful",
  "page.breadcrumb",
  "auth.checkingSession",
  "auth.loginRequired",
  "status",
  "risk.label",
  "risk.level",
];

/** The verify form, its masked public summary and land card: the home hero search and /verify. */
const LAND_SEARCH = [
  "verify",
  ...["area", "currentOwners", "dag", "district", "fatherName", "khatian", "landId", "landInfo", "mouza", "noOwners", "status", "units", "upazila"].map(
    (k) => `result.${k}`,
  ),
  // survey / JL / sheet (SJ5-SJ6)
  ...["jlNo", "sheetMismatch", "sheetNo", "survey"].map((k) => `result.${k}`),
  "archive.surveys",
];

export const MESSAGE_SCOPES = {
  home: [...LAND_SEARCH, "home.search", "track", "info.faq"],
  info: ["info.faq"],
  guide: ["guide.video", "guide.more", "readAloud"],
  verify: [...LAND_SEARCH, "services"],
  /** full result, ownership graph and printable report (signed in) */
  record: [
    "result", "risk", "graph", "report", "readAloud", "page", "qr", "my.watch", "archive.surveys",
    // the land's deed list and its version panel (H6-H8)
    "library.digitisedNo", "library.digitisedYes", "library.historical", "library.landDocs", "library.openRow", "library.doc", "upload.types",
  ],
  publicRecord: ["publicVerify", "page.dataAsOf", "page.publicPurpose", "risk.disclaimer"],
  /** public QR page of one approved deed record (/v/r/[recordId], H8) */
  publicDeedRecord: ["publicRecord", "publicVerify.signIn"],
  check: ["check", "services", "verify"],
  verifyDocument: ["verifyDoc", "services", "demoDocs"],
  track: ["track", "services", "mutation", "feedback.kinds", "feedback.status", "pageTip"],
  map: ["map", "result.units"],
  tools: ["tools"],
  feedback: ["feedback"],
  login: ["auth", "authShell"],
  signup: ["citizenSignup", "authShell"],
  officerSignup: ["officerSignup", "authShell"],
  my: ["my", "result", "authShell", "pageTip"],
  officer: [
    "officer", "auth", "area", "officerSignup", "review", "reviewer", "mutation", "hearings", "archive", "upload", "result", "risk",
    "feedback", "admin.audit", "pageTip", "partyNid", "demoDocs", "library",
    // the land chooser of an ambiguous deed in the review actions (D7)
    "verify.chooser",
  ],
  admin: ["admin", "auth", "officer.activity", "upload.types", "archive.surveys"],
} satisfies Record<string, readonly string[]>;

export type MessageScope = keyof typeof MESSAGE_SCOPES;

/** Copy only `paths` ("nav", "info.sitemap.title") out of a message tree. Never mutates `messages`. */
export function pickMessages(messages: AbstractIntlMessages, paths: readonly string[]): AbstractIntlMessages {
  const out: Record<string, unknown> = {};
  // shortest first, so a path inside one already copied is skipped and an intermediate object is always our own copy
  const sorted = [...new Set(paths)].sort((a, b) => a.split(".").length - b.split(".").length);
  const taken: string[] = [];
  for (const path of sorted) {
    if (taken.some((t) => path === t || path.startsWith(`${t}.`))) continue;
    const keys = path.split(".");
    let src: unknown = messages;
    let dst = out;
    for (const [i, k] of keys.entries()) {
      if (!src || typeof src !== "object" || !(k in src)) break;
      src = (src as Record<string, unknown>)[k];
      if (i === keys.length - 1) dst[k] = src;
      else dst = (dst[k] ??= {}) as Record<string, unknown>;
    }
    taken.push(path);
  }
  return out as AbstractIntlMessages;
}

/** `outer` with `inner` laid over it, nested objects merged (SHELL's "risk.level" plus a scope's "risk"). */
export function mergeMessages(outer: AbstractIntlMessages, inner: AbstractIntlMessages): AbstractIntlMessages {
  const out: Record<string, unknown> = { ...outer };
  for (const [k, v] of Object.entries(inner)) {
    const o = out[k];
    out[k] = o && typeof o === "object" && v && typeof v === "object" ? mergeMessages(o as AbstractIntlMessages, v as AbstractIntlMessages) : v;
  }
  return out as AbstractIntlMessages;
}
