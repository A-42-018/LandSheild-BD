/** Read-aloud helpers (U4.4): browser speech synthesis only, no network call, no audio file. */

/** Tags that are controls, pictures or decoration: never read. */
const SKIP_TAGS = new Set(["SCRIPT", "STYLE", "SVG", "IMG", "VIDEO", "AUDIO", "CANVAS", "BUTTON", "SELECT", "INPUT", "TEXTAREA", "NAV", "TEMPLATE"]);
/** Controls by role (tab rows, toolbars) and anything marked `data-no-speech`. */
const SKIP_SELECTOR = "[aria-hidden='true'], [hidden], [role='tablist'], [role='toolbar'], [data-no-speech]";
const END_MARK = /[.!?।:;]$/;
/** Engines cut long utterances (Chrome stops after about 15 s), so keep each piece short. */
const MAX_PIECE = 180;

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window && typeof SpeechSynthesisUtterance !== "undefined";
}

/** Closest ancestor that starts a new line of text; text under the same one is read as one sentence. */
function blockOf(node: Node, root: Element): Element {
  let el = node.parentElement;
  while (el && el !== root) {
    if (/^(P|LI|H[1-6]|DT|DD|TH|TD|SUMMARY|FIGCAPTION|LEGEND|BLOCKQUOTE|ARTICLE|SECTION|DIV|TR|UL|OL|DL|TABLE|HEADER|FOOTER)$/.test(el.tagName)) return el;
    el = el.parentElement;
  }
  return root;
}

function skipped(node: Node, root: Element): boolean {
  for (let el = node.parentElement; el; el = el.parentElement) {
    if (SKIP_TAGS.has(el.tagName.toUpperCase()) || el.matches(SKIP_SELECTOR)) return true;
    // Closed <details>: only the <summary> is on screen.
    if (el.tagName === "DETAILS" && !(el as HTMLDetailsElement).open) {
      const inSummary = (node.parentElement as Element).closest("summary");
      if (!inSummary || inSummary.parentElement !== el) return true;
    }
    if (el === root) break;
  }
  return false;
}

/** Split one line at sentence ends so no piece is longer than `MAX_PIECE`. */
function splitLong(line: string): string[] {
  if (line.length <= MAX_PIECE) return [line];
  const out: string[] = [];
  let cur = "";
  // No look-behind: older iPhones (Safari < 16.4) would fail to parse it.
  for (const raw of line.match(/[^.!?।;,]+[.!?।;,]*/g) ?? [line]) {
    const part = raw.trim();
    if (!part) continue;
    if (cur && cur.length + part.length + 1 > MAX_PIECE) {
      out.push(cur);
      cur = part;
    } else {
      cur = cur ? `${cur} ${part}` : part;
    }
  }
  if (cur) out.push(cur);
  return out;
}

/** What is on screen inside `root`, as short spoken pieces. Hidden parts, buttons, pictures and tab rows are left out;
 *  headings, list items and table cells each end with a full stop so the voice pauses. */
export function readableText(root: Element | null, locale: string): string[] {
  if (!root) return [];
  const stop = locale === "bn" ? "।" : ".";
  const lines: string[] = [];
  let block: Element | null = null;
  let line = "";
  const flush = () => {
    const text = line.replace(/\s+/g, " ").trim();
    if (text) lines.push(END_MARK.test(text) ? text : `${text}${stop}`);
    line = "";
  };
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (skipped(n, root)) continue;
    const b = blockOf(n, root);
    if (b !== block) {
      flush();
      block = b;
    }
    line += ` ${n.textContent ?? ""}`;
  }
  flush();
  return lines.flatMap(splitLong);
}

/** Language tag the page speaks: Bangla pages ask for a Bangla voice. */
export function speechLang(locale: string): string {
  return locale === "bn" ? "bn-BD" : "en-US";
}

/** Best installed voice for the page language, or undefined when the device has none (common for Bangla on desktops). */
export function pickVoice(voices: SpeechSynthesisVoice[], locale: string): SpeechSynthesisVoice | undefined {
  const base = locale === "bn" ? "bn" : "en";
  const want = speechLang(locale).toLowerCase();
  const mine = voices.filter((v) => v.lang.toLowerCase().replace("_", "-").startsWith(base));
  return mine.find((v) => v.lang.toLowerCase().replace("_", "-") === want) ?? mine[0];
}
