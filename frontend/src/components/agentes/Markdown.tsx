import type { ReactNode } from "react";

import { cx } from "@/components/ui/cx";

import styles from "./markdown.module.css";

/**
 * Renderizador "markdown-lite" SEGURO para los informes de los agentes.
 *
 * - Solo produce elementos React: nunca usa dangerouslySetInnerHTML, así que
 *   cualquier HTML del texto se muestra escapado (como texto literal).
 * - Soporta: encabezados, párrafos (saltos de línea conservados), negrita,
 *   cursiva, tachado, código en línea y en bloque, listas (anidadas,
 *   ordenadas y no ordenadas), citas, separadores y tablas GFM.
 * - Enlaces: solo http(s) y mailto, con rel="noopener noreferrer nofollow".
 *
 * Es puro (sin hooks): se usa en Server Components.
 */

const MAX_CHARS = 150_000;

type Align = "left" | "center" | "right" | null;

type Block =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; lines: string[] }
  | { type: "code"; lang: string; text: string }
  | { type: "hr" }
  | { type: "quote"; blocks: Block[] }
  | { type: "list"; ordered: boolean; start: number; items: ListItem[] }
  | { type: "table"; header: string[]; align: Align[]; rows: string[][] };

type ListItem = { text: string[]; children: Block[] };

const FENCE_RE = /^\s{0,3}(`{3,}|~{3,})\s*([\w+#.-]*)[^`]*$/;
const HEADING_RE = /^\s{0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const HR_RE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/;
const QUOTE_RE = /^\s{0,3}>\s?/;
const LIST_RE = /^(\s*)([-*+•]|\d{1,9}[.)])\s+(.*)$/;
const BLANK_RE = /^\s*$/;
const TABLE_SEP_RE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

function expandTabs(line: string): string {
  return line.replace(/\t/g, "    ");
}

function indentOf(line: string): number {
  const m = line.match(/^ */);
  return m ? m[0].length : 0;
}

function isTableStart(lines: string[], i: number): boolean {
  if (!lines[i].includes("|") || i + 1 >= lines.length) return false;
  const sep = lines[i + 1];
  return sep.includes("|") && sep.includes("-") && TABLE_SEP_RE.test(sep);
}

/** Divide una fila de tabla por `|` no escapados. */
function splitRow(line: string): string[] {
  let s = line.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|") && !s.endsWith("\\|")) s = s.slice(0, -1);
  const cells: string[] = [];
  let current = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (ch === "\\" && s[i + 1] === "|") {
      current += "|";
      i++;
    } else if (ch === "|") {
      cells.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  cells.push(current.trim());
  return cells;
}

/** ¿Empieza esta línea un bloque que interrumpe un párrafo? */
function startsBlock(lines: string[], i: number): boolean {
  const line = lines[i];
  return (
    FENCE_RE.test(line) ||
    HEADING_RE.test(line) ||
    HR_RE.test(line) ||
    QUOTE_RE.test(line) ||
    LIST_RE.test(line) ||
    isTableStart(lines, i)
  );
}

function parseList(lines: string[], start: number): { block: Block; next: number } {
  const first = lines[start].match(LIST_RE)!;
  const baseIndent = first[1].length;
  const ordered = /\d/.test(first[2]);
  const startNum = ordered ? parseInt(first[2], 10) || 1 : 1;
  const items: Array<{ text: string[]; childLines: string[] }> = [];
  let i = start;
  let sawBlank = false;

  while (i < lines.length) {
    const line = lines[i];
    const m = line.match(LIST_RE);
    const indent = indentOf(line);

    if (m && m[1].length === baseIndent) {
      if (/\d/.test(m[2]) !== ordered) break; // otro tipo de lista
      items.push({ text: [m[3]], childLines: [] });
      sawBlank = false;
      i++;
      continue;
    }
    const current = items[items.length - 1];
    if (BLANK_RE.test(line)) {
      // Sigue la lista si lo siguiente no vacío es un ítem o contenido indentado.
      let j = i + 1;
      while (j < lines.length && BLANK_RE.test(lines[j])) j++;
      if (j >= lines.length) break;
      const nm = lines[j].match(LIST_RE);
      const nIndent = indentOf(lines[j]);
      if ((nm && nm[1].length >= baseIndent) || nIndent > baseIndent) {
        if (current) current.childLines.push("");
        sawBlank = true;
        i++;
        continue;
      }
      break;
    }
    if (m && m[1].length < baseIndent) break; // pertenece a una lista padre
    if (indent > baseIndent && current) {
      // Sub-lista o contenido indentado del ítem actual.
      if (!m && current.childLines.length === 0 && !sawBlank) {
        current.text.push(line.trim());
      } else {
        current.childLines.push(line);
      }
      i++;
      continue;
    }
    // Continuación "perezosa" del texto del ítem.
    if (current && !sawBlank && !startsBlock(lines, i)) {
      current.text.push(line.trim());
      i++;
      continue;
    }
    break;
  }

  const listItems: ListItem[] = items.map((it) => {
    const nonBlank = it.childLines.filter((l) => !BLANK_RE.test(l));
    const minIndent = nonBlank.length ? Math.min(...nonBlank.map(indentOf)) : 0;
    const dedented = it.childLines.map((l) => l.slice(Math.min(minIndent, indentOf(l))));
    return { text: it.text, children: dedented.length ? parseBlocks(dedented) : [] };
  });
  return { block: { type: "list", ordered, start: startNum, items: listItems }, next: i };
}

function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (BLANK_RE.test(line)) {
      i++;
      continue;
    }

    const fence = line.match(FENCE_RE);
    if (fence) {
      const marker = fence[1];
      const body: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith(marker)) {
        body.push(lines[i]);
        i++;
      }
      i++; // cierre (o fin del texto)
      blocks.push({ type: "code", lang: fence[2] ?? "", text: body.join("\n") });
      continue;
    }

    const heading = line.match(HEADING_RE);
    if (heading) {
      blocks.push({ type: "heading", level: heading[1].length, text: heading[2] });
      i++;
      continue;
    }

    if (HR_RE.test(line)) {
      blocks.push({ type: "hr" });
      i++;
      continue;
    }

    if (QUOTE_RE.test(line)) {
      const inner: string[] = [];
      while (i < lines.length && QUOTE_RE.test(lines[i])) {
        inner.push(lines[i].replace(QUOTE_RE, ""));
        i++;
      }
      blocks.push({ type: "quote", blocks: parseBlocks(inner) });
      continue;
    }

    if (isTableStart(lines, i)) {
      const header = splitRow(line);
      const align: Align[] = splitRow(lines[i + 1]).map((c) => {
        const l = c.startsWith(":");
        const r = c.endsWith(":");
        return l && r ? "center" : r ? "right" : l ? "left" : null;
      });
      const rows: string[][] = [];
      i += 2;
      while (i < lines.length && !BLANK_RE.test(lines[i]) && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i++;
      }
      blocks.push({ type: "table", header, align, rows });
      continue;
    }

    if (LIST_RE.test(line)) {
      const { block, next } = parseList(lines, i);
      blocks.push(block);
      i = next;
      continue;
    }

    const para: string[] = [line.trim()];
    i++;
    while (i < lines.length && !BLANK_RE.test(lines[i]) && !startsBlock(lines, i)) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ type: "paragraph", lines: para });
  }
  return blocks;
}

// Inline --------------------------------------------------------------------

type InlineRule = {
  re: RegExp;
  render: (m: RegExpExecArray, key: string) => ReactNode;
};

const SAFE_URL_RE = /^(https?:\/\/|mailto:)/i;

// Cuantificadores acotados y flag `g` (se busca desde `lastIndex` sobre la línea
// completa): el texto de los informes lo genera un LLM y no es de fiar, así que
// ningún patrón puede degenerar en tiempo cuadrático sobre una línea larga.
const INLINE_RULES: InlineRule[] = [
  { re: /`([^`\n]{1,1000})`/g, render: (m, key) => <code key={key}>{m[1]}</code> },
  {
    re: /\[([^\]\n]{1,500})\]\(\s*([^()\s]{1,2000})(?:\s+"[^"\n]{0,300}")?\s*\)/g,
    render: (m, key) =>
      SAFE_URL_RE.test(m[2]) ? (
        <a key={key} href={m[2]} target="_blank" rel="noopener noreferrer nofollow">
          {parseInline(m[1], key)}
        </a>
      ) : (
        <span key={key}>{parseInline(m[1], key)}</span>
      ),
  },
  { re: /\*\*(?=\S)([^\n]{1,1000}?)(?<=\S)\*\*/g, render: (m, key) => <strong key={key}>{parseInline(m[1], key)}</strong> },
  {
    re: /(?<![\w_])__(?=\S)([^\n]{1,1000}?)(?<=\S)__(?![\w_])/g,
    render: (m, key) => <strong key={key}>{parseInline(m[1], key)}</strong>,
  },
  { re: /~~(?=\S)([^\n]{1,1000}?)(?<=\S)~~/g, render: (m, key) => <del key={key}>{parseInline(m[1], key)}</del> },
  { re: /\*(?=[^\s*])([^*\n]{1,1000}?)(?<=[^\s*])\*/g, render: (m, key) => <em key={key}>{parseInline(m[1], key)}</em> },
  {
    re: /(?<![\w_])_(?=[^\s_])([^_\n]{1,1000}?)(?<=[^\s_])_(?![\w_])/g,
    render: (m, key) => <em key={key}>{parseInline(m[1], key)}</em>,
  },
];

/** Líneas más largas que esto se muestran como texto plano (sin marcas inline). */
const MAX_INLINE_LINE = 4_000;

/** Convierte texto con marcas inline en nodos React (texto siempre escapado). */
function parseInline(text: string, keyPrefix = "i"): ReactNode[] {
  if (text.length > MAX_INLINE_LINE) return [text];
  const out: ReactNode[] = [];
  // Próxima coincidencia de cada regla desde `pos` (null = ya no hay más). Solo
  // se vuelve a buscar cuando `pos` sobrepasa la coincidencia guardada.
  const next: Array<RegExpExecArray | null | undefined> = INLINE_RULES.map(() => undefined);
  let pos = 0;
  let n = 0;
  while (pos < text.length) {
    let best = -1;
    for (let i = 0; i < INLINE_RULES.length; i++) {
      let match = next[i];
      if (match === undefined || (match !== null && match.index < pos)) {
        const re = INLINE_RULES[i].re;
        re.lastIndex = pos;
        match = re.exec(text);
        next[i] = match;
      }
      if (match && (best < 0 || match.index < (next[best] as RegExpExecArray).index)) best = i;
    }
    if (best < 0) {
      out.push(text.slice(pos));
      break;
    }
    const match = next[best] as RegExpExecArray;
    if (match.index > pos) out.push(text.slice(pos, match.index));
    out.push(INLINE_RULES[best].render(match, `${keyPrefix}-${n++}`));
    pos = match.index + match[0].length;
  }
  return out;
}

function renderLines(lines: string[], key: string): ReactNode[] {
  const out: ReactNode[] = [];
  lines.forEach((line, idx) => {
    if (idx > 0) out.push(<br key={`${key}-br-${idx}`} />);
    out.push(...parseInline(line, `${key}-${idx}`));
  });
  return out;
}

function renderBlocks(blocks: Block[], keyPrefix: string): ReactNode[] {
  return blocks.map((block, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (block.type) {
      case "heading": {
        const content = parseInline(block.text, key);
        if (block.level <= 1) return <h3 key={key}>{content}</h3>;
        if (block.level === 2) return <h4 key={key}>{content}</h4>;
        if (block.level === 3) return <h5 key={key}>{content}</h5>;
        return <h6 key={key}>{content}</h6>;
      }
      case "paragraph":
        return <p key={key}>{renderLines(block.lines, key)}</p>;
      case "code":
        return (
          <pre key={key} className={styles.pre} data-lang={block.lang || undefined}>
            <code>{block.text}</code>
          </pre>
        );
      case "hr":
        return <hr key={key} />;
      case "quote":
        return <blockquote key={key}>{renderBlocks(block.blocks, key)}</blockquote>;
      case "list": {
        const items = block.items.map((item, i) => (
          <li key={`${key}-li-${i}`}>
            {renderLines(item.text, `${key}-li-${i}`)}
            {item.children.length > 0 && renderBlocks(item.children, `${key}-li-${i}-c`)}
          </li>
        ));
        return block.ordered ? (
          <ol key={key} start={block.start !== 1 ? block.start : undefined}>
            {items}
          </ol>
        ) : (
          <ul key={key}>{items}</ul>
        );
      }
      case "table": {
        const cols = Math.max(block.header.length, ...block.rows.map((r) => r.length));
        const alignOf = (c: number) => block.align[c] ?? undefined;
        return (
          <div key={key} className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  {Array.from({ length: cols }, (_, c) => (
                    <th key={c} style={alignOf(c) ? { textAlign: alignOf(c) } : undefined}>
                      {parseInline(block.header[c] ?? "", `${key}-h${c}`)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {block.rows.map((row, r) => (
                  <tr key={r}>
                    {Array.from({ length: cols }, (_, c) => (
                      <td key={c} style={alignOf(c) ? { textAlign: alignOf(c) } : undefined}>
                        {parseInline(row[c] ?? "", `${key}-${r}-${c}`)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }
  });
}

export type MarkdownProps = {
  /** Texto en markdown (informe de un agente). */
  content: string;
  className?: string;
};

/** Informe renderizado de forma segura (ver descripción del módulo). */
export function Markdown({ content, className }: MarkdownProps) {
  const truncated = content.length > MAX_CHARS;
  const text = (truncated ? content.slice(0, MAX_CHARS) : content).replace(/\r\n?/g, "\n");
  const lines = text.split("\n").map(expandTabs);
  const blocks = parseBlocks(lines);
  return (
    <div className={cx(styles.md, className)}>
      {renderBlocks(blocks, "md")}
      {truncated && (
        <p className={styles.truncated}>
          Informe truncado para mostrarlo ({content.length.toLocaleString("es-ES")} caracteres).
        </p>
      )}
    </div>
  );
}
