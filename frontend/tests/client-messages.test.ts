import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../messages/en.json";
import bn from "../messages/bn.json";
import { MESSAGE_SCOPES, SHELL_MESSAGES, mergeMessages, pickMessages } from "../i18n/client-messages";
import { checkClientMessages } from "./client-messages-scan";

const root = join(__dirname, "..");
const real = { shell: SHELL_MESSAGES, scopes: MESSAGE_SCOPES };

describe("client messages per route", () => {
  it("every client component's namespaces are sent on its route", () => {
    expect(checkClientMessages(root, real, en)).toEqual([]);
  });

  it("notices when a route loses its scope", () => {
    const { officer: _officer, ...rest } = MESSAGE_SCOPES;
    const problems = checkClientMessages(root, { shell: SHELL_MESSAGES, scopes: rest }, en);
    expect(problems).toContain('app/[locale]/officer/layout.tsx: unknown ClientMessages scope "officer"');
    expect(problems.some((p) => p.startsWith("/officer/mutations: ") && /needs "mutation[."]/.test(p))).toBe(true);
  });

  it("keeps the staff namespaces out of the shell", () => {
    for (const ns of ["admin", "officer", "review", "mutation", "my"]) expect(SHELL_MESSAGES.some((p) => p.split(".")[0] === ns)).toBe(false);
  });
});

/** A tiny app/[locale] tree: `files` maps paths under the fixture root to source. */
function fixture(files: Record<string, string>) {
  const dir = mkdtempSync(join(tmpdir(), "client-messages-"));
  for (const [path, src] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), src);
  }
  return dir;
}

const MESSAGES = { nav: { home: "Home" }, extra: { a: "A", b: { c: "C" } }, server: { x: "X" }, other: { y: "Y" } };
const LAYOUT = `import Nav from "@/components/Nav";\nexport default function L({ children }) { return <Nav>{children}</Nav>; }\n`;
const NAV = `"use client";\nimport { useTranslations } from "next-intl";\nexport default function Nav() { const t = useTranslations("nav"); return t("home"); }\n`;

describe("client messages scan", () => {
  it("reports a client namespace the route does not send, with the file that needs it", () => {
    const dir = fixture({
      "app/[locale]/layout.tsx": LAYOUT,
      "components/Nav.tsx": NAV,
      "app/[locale]/x/page.tsx": `import Extra from "@/features/Extra";\nexport default function P() { return <Extra />; }\n`,
      "features/Extra.tsx": `"use client";\nimport { useTranslations } from "next-intl";\nexport default function E() { const t = useTranslations("extra"); return t("a"); }\n`,
    });
    expect(checkClientMessages(dir, { shell: ["nav"], scopes: {} }, MESSAGES)).toEqual([
      '/x: features/Extra.tsx needs "extra.a", which SHELL does not send',
    ]);
    expect(checkClientMessages(dir, { shell: ["nav", "extra.a"], scopes: {} }, MESSAGES)).toEqual([]);
  });

  it("adds a <ClientMessages> scope to the shell, and a layout's scope to the pages below it", () => {
    const dir = fixture({
      "app/[locale]/layout.tsx": LAYOUT,
      "components/Nav.tsx": NAV,
      "app/[locale]/s/layout.tsx": `export default function L({ children }) { return <ClientMessages scope="extra">{children}</ClientMessages>; }\n`,
      "app/[locale]/s/page.tsx": `import Both from "./Both";\nexport default function P() { return <Both />; }\n`,
      "app/[locale]/s/Both.tsx": `"use client";\nimport { useTranslations } from "next-intl";\nexport default function B() { const t = useTranslations(); return t("nav.home") + t("extra.b.c"); }\n`,
    });
    expect(checkClientMessages(dir, { shell: ["nav"], scopes: { extra: ["extra"] } }, MESSAGES)).toEqual([]);
    expect(checkClientMessages(dir, { shell: [], scopes: { extra: ["extra"] } }, MESSAGES)).toContain(
      '/s: app/[locale]/s/Both.tsx needs "nav.home", which SHELL + "extra" does not send',
    );
  });

  it("ignores server components and type-only imports, and follows imports of client code", () => {
    const dir = fixture({
      "app/[locale]/layout.tsx": LAYOUT,
      "components/Nav.tsx": NAV,
      // server component: reads the whole file on the server, needs nothing in the page
      "app/[locale]/p/page.tsx": `import { useTranslations } from "next-intl";\nimport type { T } from "@/features/Typed";\nimport Wrap from "@/features/Wrap";\nexport default function P() { const t = useTranslations("server"); return <Wrap>{t("x")}</Wrap>; }\n`,
      "features/Typed.tsx": `"use client";\nimport { useTranslations } from "next-intl";\nexport type T = string;\nexport default function X() { return useTranslations("other")("y"); }\n`,
      // no "use client" of its own, but imported by a client module: runs in the browser
      "features/Wrap.tsx": `"use client";\nimport Label from "./Label";\nexport default function W({ children }) { return <Label>{children}</Label>; }\n`,
      "features/Label.tsx": `import { useTranslations } from "next-intl";\nexport default function Label() { const t = useTranslations("extra"); return t("b.c"); }\n`,
    });
    expect(checkClientMessages(dir, { shell: ["nav"], scopes: {} }, MESSAGES)).toEqual([
      '/p: features/Label.tsx needs "extra.b.c", which SHELL does not send',
    ]);
  });

  it("asks for a client-messages comment when a root key is computed, and trusts the comment", () => {
    const comp = (comment: string) =>
      `"use client";\nimport { useTranslations } from "next-intl";\n${comment}\nexport default function C({ k }) { const t = useTranslations(); return t(k); }\n`;
    const files = { "app/[locale]/layout.tsx": LAYOUT, "components/Nav.tsx": NAV, "app/[locale]/c/page.tsx": `import C from "@/features/C";\nexport default function P() { return <C k="x" />; }\n` };
    const without = checkClientMessages(fixture({ ...files, "features/C.tsx": comp("") }), { shell: ["nav"], scopes: {} }, MESSAGES);
    expect(without).toHaveLength(1);
    expect(without[0]).toMatch(/features\/C\.tsx:4: root translator "t" is called with a computed key; add a "\/\/ client-messages/);
    const withComment = fixture({ ...files, "features/C.tsx": comp("// client-messages: other (k is always other.*)") });
    expect(checkClientMessages(withComment, { shell: ["nav"], scopes: {} }, MESSAGES)).toEqual([
      '/c: features/C.tsx needs "other", which SHELL does not send',
    ]);
  });

  it("falls back to the whole namespace when a namespaced key is computed, and flags paths missing from the messages", () => {
    const dir = fixture({
      "app/[locale]/layout.tsx": LAYOUT,
      "components/Nav.tsx": NAV,
      "app/[locale]/n/page.tsx": `import N from "@/features/N";\nexport default function P() { return <N />; }\n`,
      "features/N.tsx": `"use client";\nimport { useTranslations } from "next-intl";\nexport default function N({ k }) { const t = useTranslations("extra"); const m = useTranslations("nav"); return t(k) + m(\`gone.\${k}\`); }\n`,
    });
    expect(checkClientMessages(dir, { shell: ["nav", "extra", "typo"], scopes: {} }, MESSAGES)).toEqual([
      'SHELL lists "typo", which is not in the message file',
      'features/N.tsx reads "nav.gone", which is not in the message file',
    ]);
  });
});

describe("pickMessages / mergeMessages", () => {
  it("copies only the listed paths and leaves the source alone", () => {
    const src = structuredClone(MESSAGES);
    const picked = pickMessages(src, ["extra.b.c", "extra.b", "nav"]);
    expect(picked).toEqual({ nav: { home: "Home" }, extra: { b: { c: "C" } } });
    (picked.extra as Record<string, unknown>).z = 1;
    expect(src).toEqual(MESSAGES);
  });

  it("merges a scope into the shell without dropping either side", () => {
    expect(mergeMessages({ risk: { level: { HIGH: "H" } }, nav: { home: "Home" } }, { risk: { disclaimer: "D" } })).toEqual({
      risk: { level: { HIGH: "H" }, disclaimer: "D" },
      nav: { home: "Home" },
    });
  });

  it("sends the home page much less than the whole Bangla file", () => {
    const home = mergeMessages(pickMessages(bn, SHELL_MESSAGES), pickMessages(bn, MESSAGE_SCOPES.home));
    expect(JSON.stringify(home).length).toBeLessThan(JSON.stringify(bn).length / 3);
  });
});
