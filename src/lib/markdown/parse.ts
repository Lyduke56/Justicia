/**
 * A small Markdown parser for AI responses. It returns a plain syntax tree; the React renderer
 * (components/shared/Markdown.tsx) turns it into elements, so raw HTML in a response is always
 * shown as text and never injected into the page.
 *
 * Supported: ATX headings (#–######), paragraphs (single newlines kept as line breaks), **bold**,
 * __bold__, *italic*, _italic_, ~~strikethrough~~, `inline code`, fenced code blocks (``` / ~~~),
 * ordered and unordered lists (nested by indentation), > blockquotes, horizontal rules, GFM tables,
 * [links](https://…) and bare https:// links. Only http(s) and mailto links become links.
 *
 * `streaming: true` tolerates a response that is still arriving: an unclosed code fence renders as
 * code, and a dangling marker at the end (`**`, `` ` ``, `[text](…`) is hidden until it closes.
 */

export type Inline =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'strong' | 'em' | 'del'; children: Inline[] }
  | { type: 'link'; href: string; children: Inline[] }
  | { type: 'break' };

export type TableAlign = 'left' | 'center' | 'right' | null;

export type Block =
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; children: Inline[] }
  | { type: 'paragraph'; children: Inline[] }
  | { type: 'code'; lang: string; value: string }
  | { type: 'list'; ordered: boolean; start: number; items: Block[][] }
  | { type: 'quote'; children: Block[] }
  | { type: 'hr' }
  | { type: 'table'; align: TableAlign[]; header: Inline[][]; rows: Inline[][][] };

export interface ParseOptions {
  streaming?: boolean;
}

// ─── Links ────────────────────────────────────────────────────────────────────

/** The URL if it is safe to link to (http, https or mailto), otherwise null. */
export function safeHref(raw: string): string | null {
  const url = raw.trim();
  if (/^https?:\/\/[^\s]+$/i.test(url)) return url;
  if (/^mailto:[^\s@]+@[^\s@]+$/i.test(url)) return url;
  return null;
}

// ─── Inline ───────────────────────────────────────────────────────────────────

const ESCAPABLE = '\\`*_{}[]()#+-.!>|~';
const PUA = 0xe000;
const hideEscapes = (s: string) =>
  s.replace(/\\(.)/g, (m, ch: string) => (ESCAPABLE.includes(ch) ? String.fromCharCode(PUA + ch.charCodeAt(0)) : m));
const restoreEscapes = (s: string) => s.replace(/[-]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - PUA));

const INLINE = new RegExp(
  [
    '(?<code>`+)(?<codeBody>[\\s\\S]+?)\\k<code>(?!`)',
    '\\[(?<linkText>[^\\]\\n]+)\\]\\(\\s*<?(?<linkUrl>[^)\\s>]+)>?(?:\\s+["\'][^"\']*["\'])?\\s*\\)',
    '\\*\\*(?=\\S)(?<strongA>[\\s\\S]+?)(?<=\\S)\\*\\*',
    '(?<![\\w])__(?=\\S)(?<strongU>[\\s\\S]+?)(?<=\\S)__(?![\\w])',
    '~~(?=\\S)(?<del>[\\s\\S]+?)(?<=\\S)~~',
    '\\*(?=[^\\s*])(?<emA>[\\s\\S]+?)(?<=[^\\s*])\\*',
    '(?<![\\w])_(?=[^\\s_])(?<emU>[\\s\\S]+?)(?<=[^\\s_])_(?![\\w])',
    '(?<auto>https?:\\/\\/[^\\s<>]*[^\\s<>.,;:!?\'")\\]])',
  ].join('|'),
  'g'
);

function textNodes(value: string, out: Inline[]) {
  const parts = restoreEscapes(value).split('\n');
  parts.forEach((part, i) => {
    if (i > 0) out.push({ type: 'break' });
    if (part) out.push({ type: 'text', value: part });
  });
}

function inlineTree(text: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of text.matchAll(INLINE)) {
    const g = m.groups ?? {};
    const index = m.index ?? 0;
    if (index > last) textNodes(text.slice(last, index), out);
    if (g.code !== undefined) {
      // Inline code keeps its text exactly (one leading/trailing space is padding, per CommonMark).
      const body = g.codeBody.replace(/\n/g, ' ');
      out.push({ type: 'code', value: restoreEscapes(/^ .* $/.test(body) ? body.slice(1, -1) : body) });
    } else if (g.linkText !== undefined) {
      const href = safeHref(restoreEscapes(g.linkUrl));
      const children = inlineTree(g.linkText);
      if (href) out.push({ type: 'link', href, children });
      else out.push(...children);
    } else if (g.strongA !== undefined || g.strongU !== undefined) {
      out.push({ type: 'strong', children: inlineTree(g.strongA ?? g.strongU) });
    } else if (g.del !== undefined) {
      out.push({ type: 'del', children: inlineTree(g.del) });
    } else if (g.emA !== undefined || g.emU !== undefined) {
      out.push({ type: 'em', children: inlineTree(g.emA ?? g.emU) });
    } else if (g.auto !== undefined) {
      const href = safeHref(restoreEscapes(g.auto));
      if (href) out.push({ type: 'link', href, children: [{ type: 'text', value: href }] });
      else textNodes(g.auto, out);
    }
    last = index + m[0].length;
  }
  if (last < text.length) textNodes(text.slice(last), out);
  return out;
}

export function parseInline(text: string): Inline[] {
  return inlineTree(hideEscapes(text));
}

// ─── Blocks ───────────────────────────────────────────────────────────────────

const FENCE = /^ {0,3}(`{3,}|~{3,})\s*([\w+#.-]*)[^\n]*$/;
const HEADING = /^ {0,3}(#{1,6})(?:\s+(.*?))?\s*#*\s*$/;
const HR = /^ {0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE = /^ {0,3}> ?(.*)$/;
const ITEM = /^(\s*)([-*+]|\d{1,9}[.)])\s+(.*)$/;
const TABLE_SEPARATOR = /^\s*\|?\s*:?-+:?\s*(?:\|\s*:?-+:?\s*)*\|?\s*$/;

const indentOf = (line: string) => line.length - line.trimStart().length;
const isBlank = (line: string) => line.trim() === '';

function splitRow(line: string): string[] {
  let row = line.trim();
  if (row.startsWith('|')) row = row.slice(1);
  if (row.endsWith('|') && !row.endsWith('\\|')) row = row.slice(0, -1);
  return row.split(/(?<!\\)\|/).map((cell) => cell.trim().replace(/\\\|/g, '|'));
}

function isTableStart(lines: string[], i: number): boolean {
  return lines[i].includes('|') && i + 1 < lines.length && lines[i + 1].includes('-') && TABLE_SEPARATOR.test(lines[i + 1]) && lines[i + 1].includes('|');
}

function startsBlock(lines: string[], i: number): boolean {
  const line = lines[i];
  return FENCE.test(line) || HEADING.test(line) || HR.test(line) || QUOTE.test(line) || ITEM.test(line) || isTableStart(lines, i);
}

function parseList(lines: string[], start: number): { block: Block; next: number } {
  const first = ITEM.exec(lines[start])!;
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const startNumber = ordered ? parseInt(first[2], 10) : 1;
  const items: string[][] = [];
  let contentIndent = 0;
  let i = start;

  while (i < lines.length) {
    const line = lines[i];
    const item = ITEM.exec(line);
    if (item && item[1].length === baseIndent && /\d/.test(item[2]) === ordered) {
      items.push([item[3]]);
      contentIndent = baseIndent + item[2].length + 1;
      i++;
      continue;
    }
    const current = items[items.length - 1];
    if (isBlank(line)) {
      // A blank line continues the list only if more of it follows.
      let j = i + 1;
      while (j < lines.length && isBlank(lines[j])) j++;
      if (j >= lines.length) break;
      const nextItem = ITEM.exec(lines[j]);
      const continues =
        indentOf(lines[j]) > baseIndent || (!!nextItem && nextItem[1].length === baseIndent && /\d/.test(nextItem[2]) === ordered);
      if (!continues) break;
      current.push('');
      i++;
      continue;
    }
    if (indentOf(line) > baseIndent) {
      // Continuation or nested block: drop the item's indentation.
      current.push(line.slice(Math.min(indentOf(line), contentIndent)));
      i++;
      continue;
    }
    // Lazy continuation of the item's paragraph.
    if (!startsBlock(lines, i) && current.length > 0 && !isBlank(current[current.length - 1])) {
      current.push(line.trim());
      i++;
      continue;
    }
    break;
  }

  return {
    block: { type: 'list', ordered, start: startNumber, items: items.map((content) => parseLines(content)) },
    next: i,
  };
}

function parseLines(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (isBlank(line)) {
      i++;
      continue;
    }

    const fence = FENCE.exec(line);
    if (fence) {
      const marker = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !new RegExp(`^ {0,3}${marker[0]}{${marker.length},}\\s*$`).test(lines[i])) {
        body.push(lines[i]);
        i++;
      }
      i++; // closing fence (or past the end while streaming)
      blocks.push({ type: 'code', lang: fence[2] ?? '', value: body.join('\n') });
      continue;
    }

    const heading = HEADING.exec(line);
    if (heading) {
      blocks.push({ type: 'heading', level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6, children: parseInline(heading[2] ?? '') });
      i++;
      continue;
    }

    if (HR.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    if (QUOTE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && !isBlank(lines[i])) {
        const q = QUOTE.exec(lines[i]);
        if (q) inner.push(q[1]);
        else if (startsBlock(lines, i)) break;
        else inner.push(lines[i]);
        i++;
      }
      blocks.push({ type: 'quote', children: parseLines(inner) });
      continue;
    }

    if (ITEM.test(line)) {
      const { block, next } = parseList(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const align: TableAlign[] = splitRow(lines[i + 1]).map((cell) =>
        cell.startsWith(':') && cell.endsWith(':') ? 'center' : cell.endsWith(':') ? 'right' : cell.startsWith(':') ? 'left' : null
      );
      i += 2;
      const rows: Inline[][][] = [];
      while (i < lines.length && !isBlank(lines[i]) && lines[i].includes('|')) {
        const cells = splitRow(lines[i]);
        rows.push(header.map((_, c) => parseInline(cells[c] ?? '')));
        i++;
      }
      blocks.push({ type: 'table', align: header.map((_, c) => align[c] ?? null), header: header.map((h) => parseInline(h)), rows });
      continue;
    }

    // Paragraph: until a blank line or the start of another block.
    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines, i)) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: 'paragraph', children: parseInline(para.join('\n')) });
  }
  return blocks;
}

/** Hides markers that are still waiting for their closing half at the end of a streamed reply. */
function tidyStreaming(src: string): string {
  // A link that is still being written: "[text" or "[text](https://exa".
  let text = src.replace(/\[[^\]\n]*(?:\]\([^)\n]*)?$/, '');
  const outsideFences = text.split(/^ {0,3}(?:`{3,}|~{3,}).*$/m);
  const fenceOpen = outsideFences.length % 2 === 0;
  if (!fenceOpen) {
    const tail = outsideFences[outsideFences.length - 1];
    const stripLastUnpaired = (marker: string) => {
      const count = tail.split(marker).length - 1;
      if (count % 2 === 1) {
        const at = text.lastIndexOf(marker);
        if (at >= 0) text = text.slice(0, at) + text.slice(at + marker.length);
      }
    };
    stripLastUnpaired('**');
    stripLastUnpaired('~~');
    stripLastUnpaired('`');
  }
  return text;
}

export function parseMarkdown(source: string, { streaming = false }: ParseOptions = {}): Block[] {
  let text = (source ?? '').replace(/\r\n?/g, '\n').replace(/\t/g, '    ');
  if (streaming) text = tidyStreaming(text);
  return parseLines(text.split('\n'));
}
