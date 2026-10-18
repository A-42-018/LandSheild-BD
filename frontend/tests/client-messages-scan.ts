/**
 * Static check that every client component gets the messages it reads.
 *
 * The browser only receives the namespaces listed in i18n/client-messages.ts (SHELL for the root layout, a named scope
 * where a layout or page renders <ClientMessages scope="…">). A client component that calls useTranslations("x") under
 * a route whose provider lacks "x" renders raw keys and logs MISSING_MESSAGE at run time, so this walks each route's
 * import graph from the TypeScript AST and lists every namespace a client module needs but its route does not send.
 *
 * Rules the scan relies on:
 * - A module is client code when it says "use client" or is imported (transitively) by client code.
 * - useTranslations("ns") needs "ns". Root useTranslations() needs each key it is called with ("nav.home" → "nav.home",
 *   `roles.${r}` → "roles"). A computed root key, or a root translator passed elsewhere, needs a
 *   `// client-messages: ns1 ns2 (why)` comment in that file naming what it may read.
 * - <ClientMessages scope="x"> must wrap the whole tree a layout or page returns: the file counts as inside the scope.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, sep } from "node:path";
import ts from "typescript";

export type MessageConfig = { shell: readonly string[]; scopes: Record<string, readonly string[]> };

type FileInfo = {
  client: boolean;
  imports: string[];
  needs: string[];
  /** set when the file reads keys the scan cannot name and has no client-messages comment */
  unnamed: string | null;
  scope: string | null;
};

const EXTENSIONS = [".tsx", ".ts", "/index.tsx", "/index.ts"];
const TRANSLATOR_METHODS = new Set(["rich", "raw", "markup", "has"]);

/** Static prefix of a key expression: literal text, a template head up to its last dot, both arms of a ternary. */
function keyPaths(node: ts.Expression): string[] | null {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return [node.text];
  if (ts.isTemplateExpression(node)) {
    const head = node.head.text;
    const cut = head.lastIndexOf(".");
    return cut > 0 ? [head.slice(0, cut)] : null;
  }
  if (ts.isParenthesizedExpression(node)) return keyPaths(node.expression);
  if (ts.isConditionalExpression(node)) {
    const a = keyPaths(node.whenTrue);
    const b = keyPaths(node.whenFalse);
    return a && b ? [...a, ...b] : null;
  }
  return null;
}

function enclosingScope(node: ts.Node): ts.Node {
  let n = node.parent;
  while (n && !ts.isFunctionLike(n) && !ts.isSourceFile(n)) n = n.parent;
  return n;
}

function parse(file: string, label: string, resolve: (spec: string) => string | null): FileInfo {
  const text = readFileSync(file, "utf8");
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const first = sf.statements[0];
  const client = !!first && ts.isExpressionStatement(first) && ts.isStringLiteral(first.expression) && first.expression.text === "use client";
  const comment = /\/\/\s*client-messages:([^(\n]*)/.exec(text); // names, then an optional "(note)"
  const named = comment ? comment[1].split(/[\s,]+/).filter(Boolean) : null;

  const imports: string[] = [];
  const needs = new Set<string>(named ?? []);
  let unnamed: string | null = null;
  let scope: string | null = null;
  const addImport = (spec: string) => {
    const r = resolve(spec);
    if (r) imports.push(r);
  };

  const visit = (node: ts.Node) => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const c = node.importClause;
      const typeOnly =
        !!c && (c.isTypeOnly || (!c.name && !!c.namedBindings && ts.isNamedImports(c.namedBindings) && c.namedBindings.elements.length > 0 && c.namedBindings.elements.every((e) => e.isTypeOnly)));
      if (!typeOnly) addImport(node.moduleSpecifier.text);
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier) && !node.isTypeOnly) {
      addImport(node.moduleSpecifier.text);
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword && node.arguments[0] && ts.isStringLiteral(node.arguments[0])) {
      addImport(node.arguments[0].text);
    } else if (ts.isJsxOpeningLikeElement(node) && node.tagName.getText(sf) === "ClientMessages") {
      for (const a of node.attributes.properties) {
        if (ts.isJsxAttribute(a) && a.name.getText(sf) === "scope" && a.initializer && ts.isStringLiteral(a.initializer)) scope = a.initializer.text;
      }
    } else if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "useTranslations") {
      translator(node);
    }
    ts.forEachChild(node, visit);
  };

  const translator = (call: ts.CallExpression) => {
    const where = `${label}:${sf.getLineAndCharacterOfPosition(call.getStart(sf)).line + 1}`;
    const arg = call.arguments[0];
    let ns: string | null = null;
    if (arg) {
      const p = keyPaths(arg);
      if (!p || p.length !== 1) {
        if (!named) unnamed ??= `${where} computes its namespace`;
        return;
      }
      ns = p[0];
    }
    // Follow every use of the variable the translator is stored in. A namespaced translator whose keys are not all
    // known needs its whole namespace; a root one needs a client-messages comment.
    const decl = call.parent;
    const found = new Set<string>();
    let unknown: string | null = null;
    if (!ts.isVariableDeclaration(decl) || !ts.isIdentifier(decl.name)) {
      unknown = "not stored in a variable";
    } else {
      const name = decl.name.text;
      const uses = (node: ts.Node) => {
        if (ts.isIdentifier(node) && node.text === name && node !== decl.name) {
          const p = node.parent;
          let key: ts.Expression | undefined;
          let called = false;
          if (ts.isCallExpression(p) && p.expression === node) {
            called = true;
            key = p.arguments[0];
          } else if (ts.isPropertyAccessExpression(p) && p.expression === node && TRANSLATOR_METHODS.has(p.name.text) && ts.isCallExpression(p.parent) && p.parent.expression === p) {
            called = true;
            key = p.parent.arguments[0];
          }
          const paths = called && key ? keyPaths(key) : null;
          if (paths) paths.forEach((k) => found.add(ns ? `${ns}.${k}` : k));
          else unknown ??= `"${name}" is ${called ? "called with a computed key" : "passed on"}`;
        }
        ts.forEachChild(node, uses);
      };
      uses(enclosingScope(call));
    }
    if (ns && unknown) needs.add(ns);
    else found.forEach((k) => needs.add(k));
    if (!ns && unknown && !named) unnamed ??= `${where}: root translator ${unknown}`;
  };

  visit(sf);
  return { client, imports, needs: [...needs], unnamed, scope };
}

function listFiles(dir: string, name: RegExp, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) listFiles(p, name, out);
    else if (name.test(e)) out.push(p);
  }
  return out;
}

export function lookup(messages: Record<string, unknown>, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), messages);
}

export const covers = (provided: readonly string[], need: string) => provided.some((p) => need === p || need.startsWith(`${p}.`));

/**
 * Scan the Next app under `root` (expects root/app/[locale]). Returns one line per problem: a namespace a client module
 * needs that its route does not provide, a key the scan cannot name, an unknown scope, or a needed key that is not in
 * the message file.
 */
export function checkClientMessages(root: string, config: MessageConfig, messages: Record<string, unknown>) {
  const cache = new Map<string, FileInfo>();
  const resolveFrom = (from: string) => (spec: string) => {
    const base = spec.startsWith("@/") ? join(root, spec.slice(2)) : spec.startsWith(".") ? join(dirname(from), spec) : null;
    if (!base) return null;
    for (const ext of EXTENSIONS) if (existsSync(base + ext)) return base + ext;
    return null;
  };
  const info = (file: string) => {
    let i = cache.get(file);
    if (!i) cache.set(file, (i = parse(file, relative(root, file), resolveFrom(file))));
    return i;
  };
  /** Needs of the client code reachable from `entry`, with the module that has each one. */
  const clientNeeds = (entry: string) => {
    const found = new Map<string, string>();
    const unnamed = new Set<string>();
    const seen = new Set<string>();
    const walk = (file: string, inClient: boolean) => {
      const i = info(file);
      const client = inClient || i.client;
      const id = `${client}:${file}`;
      if (seen.has(id)) return;
      seen.add(id);
      if (client) {
        for (const n of i.needs) if (!found.has(n)) found.set(n, relative(root, file));
        if (i.unnamed) unnamed.add(i.unnamed);
      }
      for (const imp of i.imports) walk(imp, client);
    };
    walk(entry, false);
    return { found, unnamed };
  };

  const problems = new Set<string>();
  const appDir = join(root, "app", "[locale]");
  const check = (route: string, file: string, provided: readonly string[], scopeName: string) => {
    const { found, unnamed } = clientNeeds(file);
    for (const u of unnamed) problems.add(`${u}; add a "// client-messages: <namespaces>" comment`);
    for (const [need, owner] of found) {
      if (lookup(messages, need) === undefined) problems.add(`${owner} reads "${need}", which is not in the message file`);
      else if (!covers(provided, need)) problems.add(`${route}: ${owner} needs "${need}", which ${scopeName} does not send`);
    }
  };
  const scopeOf = (file: string) => {
    const s = info(file).scope;
    if (s && !config.scopes[s]) problems.add(`${relative(root, file)}: unknown ClientMessages scope "${s}"`);
    return s && config.scopes[s] ? s : null;
  };
  const BOUNDARIES = ["error.tsx", "loading.tsx", "not-found.tsx"];

  // The root layout and its boundaries sit under the SHELL provider.
  for (const f of ["layout.tsx", ...BOUNDARIES]) if (existsSync(join(appDir, f))) check("shell", join(appDir, f), config.shell, "SHELL");

  // A nested <ClientMessages> adds its scope to what the providers above it send (MergeMessages).
  const add = (outer: { paths: readonly string[]; name: string }, s: string | null) =>
    s ? { paths: [...outer.paths, ...config.scopes[s]], name: `${outer.name} + "${s}"` } : outer;
  for (const page of listFiles(appDir, /^page\.tsx$/)) {
    const route = `/${relative(appDir, dirname(page)).split(sep).join("/")}`;
    let outer = { paths: config.shell, name: "SHELL" };
    const segments = relative(appDir, dirname(page)).split(sep).filter(Boolean);
    for (let d = 1; d <= segments.length; d++) {
      const dir = join(appDir, ...segments.slice(0, d));
      for (const f of ["layout.tsx", ...BOUNDARIES]) {
        const file = join(dir, f);
        if (!existsSync(file)) continue;
        // a layout's scope covers the segment below it; a boundary's scope covers only the boundary
        const inner = add(outer, scopeOf(file));
        if (f === "layout.tsx") outer = inner;
        check(route, file, inner.paths, inner.name);
      }
    }
    const inner = add(outer, scopeOf(page));
    check(route, page, inner.paths, inner.name);
  }
  for (const [name, paths] of Object.entries({ SHELL: config.shell, ...config.scopes })) {
    for (const p of paths) if (lookup(messages, p) === undefined) problems.add(`${name} lists "${p}", which is not in the message file`);
  }
  return [...problems].sort();
}
