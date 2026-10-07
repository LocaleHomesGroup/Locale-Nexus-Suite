/**
 * A small PDF writer: A4 pages, embedded TrueType fonts (or the built-in
 * Helvetica faces as a fallback), text with tracking, filled or stroked
 * rounded rectangles, rules, SVG path data and clipping. Enough to print a
 * branded document without adding a dependency.
 *
 *   const doc = new PdfDoc({ title: "Estimate HS-1043", fonts: { regular: manropeBytes } });
 *   doc.text("Final build price", 40, 120, { font: "bold", size: 12 });
 *   doc.text(aud(427898), doc.width - 40, 120, { font: "bold", size: 12, align: "right" });
 *   downloadBlob(doc.toBlob(), "HS-1043.pdf");
 *
 * Coordinates are points from the TOP-left corner; `y` for text is the
 * baseline. Text is WinAnsi-encoded (Latin-1 plus curly quotes, dashes, the
 * bullet and the euro); anything else prints as "?".
 */

/** Four type roles, after the Locale stylesheet: body, sub-heading, heading, accent. */
export type PdfFont = "regular" | "bold" | "heading" | "accent";
/** 0–255 per channel. */
export type Rgb = readonly [number, number, number];

export interface TextOptions {
  font?: PdfFont;
  size?: number;
  color?: Rgb;
  align?: "left" | "right" | "center";
  /** Extra space between characters, in points (caps labels). */
  tracking?: number;
}

const FONTS: PdfFont[] = ["regular", "bold", "heading", "accent"];
const RESOURCE: Record<PdfFont, string> = { regular: "F1", bold: "F2", heading: "F3", accent: "F4" };
const BUILTIN: Record<PdfFont, string> = {
  regular: "Helvetica",
  bold: "Helvetica-Bold",
  heading: "Helvetica-Bold",
  accent: "Helvetica-Oblique",
};

/* ── Encoding ──────────────────────────────────────────────────────────── */

/** WinAnsi codes 128–159 and the Unicode character each stands for. */
const WIN_HIGH: Record<number, number> = {
  128: 0x20ac, 130: 0x201a, 131: 0x0192, 132: 0x201e, 133: 0x2026, 134: 0x2020, 135: 0x2021, 136: 0x02c6,
  137: 0x2030, 138: 0x0160, 139: 0x2039, 140: 0x0152, 142: 0x017d, 145: 0x2018, 146: 0x2019, 147: 0x201c,
  148: 0x201d, 149: 0x2022, 150: 0x2013, 151: 0x2014, 152: 0x02dc, 153: 0x2122, 154: 0x0161, 155: 0x203a,
  156: 0x0153, 158: 0x017e, 159: 0x0178,
};
const UNI_TO_WIN = new Map(Object.entries(WIN_HIGH).map(([code, uni]) => [uni, Number(code)]));
const unicodeOf = (code: number) => WIN_HIGH[code] ?? code;

/** Stand-ins for characters WinAnsi lacks. */
const SWAP: Record<string, string> = { "−": "-", " ": " ", " ": " ", "‑": "-" };

/** A string as WinAnsi codes; anything WinAnsi can't carry becomes "?". */
function encode(s: string): number[] {
  const out: number[] = [];
  for (const raw of s) {
    const ch = SWAP[raw] ?? raw;
    const u = ch.codePointAt(0) ?? 63;
    if ((u >= 32 && u <= 126) || (u >= 160 && u <= 255)) out.push(u);
    else out.push(UNI_TO_WIN.get(u) ?? 63);
  }
  return out;
}

/** A PDF string literal of WinAnsi codes, escaped to plain ASCII. */
function literal(codes: number[]): string {
  let out = "(";
  for (const c of codes) {
    if (c === 40 || c === 41 || c === 92) out += `\\${String.fromCharCode(c)}`;
    else if (c >= 32 && c <= 126) out += String.fromCharCode(c);
    else out += `\\${c.toString(8).padStart(3, "0")}`;
  }
  return `${out})`;
}

/* ── Built-in metrics (the fallback) ───────────────────────────────────── */

/** Helvetica advance widths (1/1000 em) for ASCII 32–126, from the Adobe AFM. */
const HELV = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 278, 278, 584, 584, 584, 556, 1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556, 333, 556, 556, 500, 556, 556, 278, 556,
  556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
];

/** Helvetica-Bold advance widths for ASCII 32–126. */
const HELV_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556,
  556, 556, 333, 333, 584, 584, 584, 611, 975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556, 333, 556, 611, 556, 611, 556, 333, 611,
  611, 278, 278, 556, 278, 889, 611, 611, 611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
];

/** Widths for WinAnsi 32–255 from an ASCII table; the rest at a typical advance. */
function builtinWidths(ascii: number[], bold: boolean): number[] {
  const high: Record<number, number> = { 133: 1000, 145: bold ? 278 : 222, 146: bold ? 278 : 222, 147: bold ? 500 : 333, 148: bold ? 500 : 333, 149: 350, 150: 556, 151: 1000, 160: 278, 183: 278, 215: 584 };
  return Array.from({ length: 224 }, (_, i) => {
    const code = i + 32;
    return code <= 126 ? ascii[code - 32] : (high[code] ?? 556);
  });
}

/* ── TrueType ──────────────────────────────────────────────────────────── */

interface Metrics {
  /** WinAnsi 32–255, in 1/1000 em. */
  widths: number[];
  bbox: [number, number, number, number];
  ascent: number;
  descent: number;
  capHeight: number;
  italicAngle: number;
}

/** Read what the font descriptor and text measuring need from a TrueType file. */
function readTrueType(bytes: Uint8Array): Metrics {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tables: Record<string, number> = {};
  for (let i = 0; i < v.getUint16(4); i++) {
    const o = 12 + 16 * i;
    tables[String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3])] = v.getUint32(o + 8);
  }
  const { head, hhea, hmtx, cmap, post } = tables;
  const os2 = tables["OS/2"];
  const upm = v.getUint16(head + 18);
  const k = (x: number) => Math.round((x * 1000) / upm);
  const metrics = v.getUint16(hhea + 34);
  const advance = (g: number) => v.getUint16(hmtx + 4 * Math.min(g, metrics - 1));

  let sub = -1;
  for (let i = 0; i < v.getUint16(cmap + 2); i++) {
    const rec = cmap + 4 + 8 * i;
    const platform = v.getUint16(rec);
    const encoding = v.getUint16(rec + 2);
    const at = cmap + v.getUint32(rec + 4);
    if (v.getUint16(at) === 4 && ((platform === 3 && encoding === 1) || platform === 0)) {
      sub = at;
      if (platform === 3) break;
    }
  }
  const glyph = (u: number): number => {
    if (sub < 0) return 0;
    const segX2 = v.getUint16(sub + 6);
    const ends = sub + 14;
    const starts = ends + segX2 + 2;
    const deltas = starts + segX2;
    const ranges = deltas + segX2;
    for (let s = 0; s < segX2 / 2; s++) {
      if (u > v.getUint16(ends + 2 * s)) continue;
      const start = v.getUint16(starts + 2 * s);
      if (u < start) return 0;
      const delta = v.getInt16(deltas + 2 * s);
      const ro = v.getUint16(ranges + 2 * s);
      if (ro === 0) return (u + delta) & 0xffff;
      const g = v.getUint16(ranges + 2 * s + ro + 2 * (u - start));
      return g ? (g + delta) & 0xffff : 0;
    }
    return 0;
  };

  const ascent = v.getInt16(hhea + 4);
  return {
    widths: Array.from({ length: 224 }, (_, i) => k(advance(glyph(unicodeOf(i + 32))))),
    bbox: [k(v.getInt16(head + 36)), k(v.getInt16(head + 38)), k(v.getInt16(head + 40)), k(v.getInt16(head + 42))],
    ascent: k(ascent),
    descent: k(v.getInt16(hhea + 6)),
    capHeight: k(os2 != null && v.getUint16(os2) >= 2 ? v.getInt16(os2 + 88) : ascent * 0.7),
    italicAngle: v.getInt32(post + 4) / 65536,
  };
}

/* ── SVG paths ─────────────────────────────────────────────────────────── */

type Seg = { op: "M" | "L" | "C" | "Z"; pts: number[] };

/** SVG path data (M L H V C Z, absolute or relative) as absolute moves, lines and curves. */
function parsePath(d: string): Seg[] {
  const tokens = d.match(/[MLHVCZmlhvcz]|-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?/g) ?? [];
  const segs: Seg[] = [];
  let i = 0;
  let cmd = "";
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[A-Za-z]/.test(tokens[i])) cmd = tokens[i++];
    const rel = cmd === cmd.toLowerCase();
    const ox = rel ? x : 0;
    const oy = rel ? y : 0;
    switch (cmd.toUpperCase()) {
      case "M":
        x = ox + num();
        y = oy + num();
        sx = x;
        sy = y;
        segs.push({ op: "M", pts: [x, y] });
        cmd = rel ? "l" : "L"; // further pairs are lines
        break;
      case "L":
        x = ox + num();
        y = oy + num();
        segs.push({ op: "L", pts: [x, y] });
        break;
      case "H":
        x = ox + num();
        segs.push({ op: "L", pts: [x, y] });
        break;
      case "V":
        y = oy + num();
        segs.push({ op: "L", pts: [x, y] });
        break;
      case "C": {
        const p = [ox + num(), oy + num(), ox + num(), oy + num(), ox + num(), oy + num()];
        x = p[4];
        y = p[5];
        segs.push({ op: "C", pts: p });
        break;
      }
      case "Z":
        x = sx;
        y = sy;
        segs.push({ op: "Z", pts: [] });
        cmd = ""; // Z takes no numbers: a stray one is skipped below
        break;
      default:
        i++; // unsupported command: skip a token rather than loop forever
    }
  }
  return segs;
}

/** The bounds of a set of SVG paths, from their points (close enough to crop a logo's whitespace). */
export function pathBounds(ds: string[]): { x: number; y: number; w: number; h: number } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const d of ds)
    for (const s of parsePath(d))
      for (let i = 0; i < s.pts.length; i += 2) {
        x0 = Math.min(x0, s.pts[i]);
        x1 = Math.max(x1, s.pts[i]);
        y0 = Math.min(y0, s.pts[i + 1]);
        y1 = Math.max(y1, s.pts[i + 1]);
      }
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/* ── The document ──────────────────────────────────────────────────────── */

const n = (v: number) => (Math.round(v * 100) / 100).toString();
const rgb = (c: Rgb) => c.map((v) => n(v / 255)).join(" ");

const enc = new TextEncoder();

export class PdfDoc {
  readonly width = 595.28;
  readonly height = 841.89;
  private pages: string[][] = [];
  private index = -1;
  private readonly title: string;
  private readonly embedded: Partial<Record<PdfFont, { bytes: Uint8Array; metrics: Metrics; name: string }>> = {};
  private readonly widths: Record<PdfFont, number[]>;

  /**
   * `fonts` are TrueType files for any of the four roles; a role without one
   * falls back to Helvetica. `names` are their PostScript names.
   */
  constructor({
    title = "Document",
    fonts = {},
    names = {},
  }: { title?: string; fonts?: Partial<Record<PdfFont, Uint8Array>>; names?: Partial<Record<PdfFont, string>> } = {}) {
    this.title = title;
    for (const f of FONTS) {
      const bytes = fonts[f];
      if (!bytes) continue;
      try {
        this.embedded[f] = { bytes, metrics: readTrueType(bytes), name: (names[f] ?? `Font-${f}`).replace(/[^A-Za-z0-9-]/g, "") };
      } catch {
        // An unreadable file falls back to Helvetica for that role.
      }
    }
    const fallback = (f: PdfFont) => builtinWidths(f === "regular" || f === "accent" ? HELV : HELV_BOLD, !(f === "regular" || f === "accent"));
    this.widths = Object.fromEntries(FONTS.map((f) => [f, this.embedded[f]?.metrics.widths ?? fallback(f)])) as Record<PdfFont, number[]>;
    this.addPage();
  }

  get pageCount() {
    return this.pages.length;
  }

  addPage() {
    this.pages.push([]);
    this.index = this.pages.length - 1;
  }

  /** Draw on an earlier page again (page footers once the count is known). */
  setPage(i: number) {
    this.index = Math.max(0, Math.min(this.pages.length - 1, i));
  }

  private op(s: string) {
    this.pages[this.index].push(s);
  }

  measure(text: string, font: PdfFont = "regular", size = 10, tracking = 0): number {
    const codes = encode(text);
    const w = codes.reduce((sum, c) => sum + (this.widths[font][c - 32] ?? 556), 0);
    return (w / 1000) * size + tracking * Math.max(0, codes.length - 1);
  }

  /** Greedy word wrap to `maxWidth`; a word longer than the line is broken mid-word. */
  wrap(text: string, maxWidth: number, font: PdfFont = "regular", size = 10): string[] {
    const lines: string[] = [];
    for (const para of text.split("\n")) {
      let line = "";
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const next = line ? `${line} ${word}` : word;
        if (this.measure(next, font, size) <= maxWidth) {
          line = next;
          continue;
        }
        if (line) lines.push(line);
        let rest = word;
        while (this.measure(rest, font, size) > maxWidth && rest.length > 1) {
          let cut = rest.length - 1;
          while (cut > 1 && this.measure(rest.slice(0, cut), font, size) > maxWidth) cut--;
          lines.push(rest.slice(0, cut));
          rest = rest.slice(cut);
        }
        line = rest;
      }
      lines.push(line);
    }
    return lines;
  }

  text(str: string, x: number, y: number, { font = "regular", size = 10, color = [50, 50, 50], align = "left", tracking = 0 }: TextOptions = {}) {
    const w = align === "left" ? 0 : this.measure(str, font, size, tracking);
    const left = align === "right" ? x - w : align === "center" ? x - w / 2 : x;
    this.op(
      `BT /${RESOURCE[font]} ${n(size)} Tf ${n(tracking)} Tc ${rgb(color)} rg ${n(left)} ${n(this.height - y)} Td ${literal(encode(str))} Tj ET`,
    );
  }

  rect(x: number, y: number, w: number, h: number, { fill, stroke, lineWidth = 0.75, radius = 0 }: { fill?: Rgb; stroke?: Rgb; lineWidth?: number; radius?: number }) {
    const ops: string[] = [];
    if (fill) ops.push(`${rgb(fill)} rg`);
    if (stroke) ops.push(`${rgb(stroke)} RG ${n(lineWidth)} w`);
    const bottom = this.height - y - h;
    const r = Math.min(radius, w / 2, h / 2);
    if (r <= 0) ops.push(`${n(x)} ${n(bottom)} ${n(w)} ${n(h)} re`);
    else {
      // Four quarter-circle Béziers (k ≈ 0.5523).
      const k = r * 0.5523;
      const right = x + w;
      const top = bottom + h;
      ops.push(
        `${n(x + r)} ${n(bottom)} m`,
        `${n(right - r)} ${n(bottom)} l`,
        `${n(right - r + k)} ${n(bottom)} ${n(right)} ${n(bottom + r - k)} ${n(right)} ${n(bottom + r)} c`,
        `${n(right)} ${n(top - r)} l`,
        `${n(right)} ${n(top - r + k)} ${n(right - r + k)} ${n(top)} ${n(right - r)} ${n(top)} c`,
        `${n(x + r)} ${n(top)} l`,
        `${n(x + r - k)} ${n(top)} ${n(x)} ${n(top - r + k)} ${n(x)} ${n(top - r)} c`,
        `${n(x)} ${n(bottom + r)} l`,
        `${n(x)} ${n(bottom + r - k)} ${n(x + r - k)} ${n(bottom)} ${n(x + r)} ${n(bottom)} c`,
        "h",
      );
    }
    ops.push(fill && stroke ? "B" : fill ? "f" : "S");
    this.op(ops.join(" "));
  }

  line(x1: number, y1: number, x2: number, y2: number, { color = [220, 220, 220], width = 0.75 }: { color?: Rgb; width?: number } = {}) {
    this.op(`${rgb(color)} RG ${n(width)} w ${n(x1)} ${n(this.height - y1)} m ${n(x2)} ${n(this.height - y2)} l S`);
  }

  /**
   * SVG path data, scaled by `scale` and placed so the path's (ox, oy) lands
   * at (x, y). Filled (non-zero, as SVG fills) and/or stroked.
   */
  path(
    d: string,
    { x, y, scale = 1, ox = 0, oy = 0, fill, stroke, lineWidth = 1 }: { x: number; y: number; scale?: number; ox?: number; oy?: number; fill?: Rgb; stroke?: Rgb; lineWidth?: number },
  ) {
    const px = (v: number) => n(x + (v - ox) * scale);
    const py = (v: number) => n(this.height - (y + (v - oy) * scale));
    const ops: string[] = [];
    if (fill) ops.push(`${rgb(fill)} rg`);
    if (stroke) ops.push(`${rgb(stroke)} RG ${n(lineWidth)} w`);
    for (const s of parsePath(d)) {
      if (s.op === "M") ops.push(`${px(s.pts[0])} ${py(s.pts[1])} m`);
      else if (s.op === "L") ops.push(`${px(s.pts[0])} ${py(s.pts[1])} l`);
      else if (s.op === "C")
        ops.push(`${px(s.pts[0])} ${py(s.pts[1])} ${px(s.pts[2])} ${py(s.pts[3])} ${px(s.pts[4])} ${py(s.pts[5])} c`);
      else ops.push("h");
    }
    ops.push(fill && stroke ? "B" : fill ? "f" : "S");
    this.op(ops.join(" "));
  }

  /** Draw inside a rectangle only: everything `draw` adds is clipped to it. */
  clip(x: number, y: number, w: number, h: number, draw: () => void) {
    this.op(`q ${n(x)} ${n(this.height - y - h)} ${n(w)} ${n(h)} re W n`);
    draw();
    this.op("Q");
  }

  /** The finished file. */
  toBlob(): Blob {
    const objects: (string | { dict: string; data: Uint8Array })[] = [];
    let next = 1;
    const reserve = () => next++;

    const catalog = reserve();
    const pagesId = reserve();
    const fontIds = Object.fromEntries(FONTS.map((f) => [f, reserve()])) as Record<PdfFont, number>;
    for (const f of FONTS) {
      const e = this.embedded[f];
      if (!e) {
        objects[fontIds[f]] = `<< /Type /Font /Subtype /Type1 /BaseFont /${BUILTIN[f]} /Encoding /WinAnsiEncoding >>`;
        continue;
      }
      const descriptor = reserve();
      const file = reserve();
      const m = e.metrics;
      const italic = m.italicAngle !== 0;
      objects[fontIds[f]] =
        `<< /Type /Font /Subtype /TrueType /BaseFont /${e.name} /FirstChar 32 /LastChar 255 ` +
        `/Widths [${m.widths.join(" ")}] /FontDescriptor ${descriptor} 0 R /Encoding /WinAnsiEncoding >>`;
      objects[descriptor] =
        `<< /Type /FontDescriptor /FontName /${e.name} /Flags ${32 + (italic ? 64 : 0)} /FontBBox [${m.bbox.join(" ")}] ` +
        `/ItalicAngle ${n(m.italicAngle)} /Ascent ${m.ascent} /Descent ${m.descent} /CapHeight ${m.capHeight} /StemV 80 /FontFile2 ${file} 0 R >>`;
      objects[file] = { dict: `<< /Length ${e.bytes.length} /Length1 ${e.bytes.length} >>`, data: e.bytes };
    }

    const fontRes = FONTS.map((f) => `/${RESOURCE[f]} ${fontIds[f]} 0 R`).join(" ");
    const pageIds: number[] = [];
    for (const ops of this.pages) {
      const page = reserve();
      const content = reserve();
      pageIds.push(page);
      const stream = enc.encode(ops.join("\n"));
      objects[page] =
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${n(this.width)} ${n(this.height)}] ` +
        `/Resources << /Font << ${fontRes} >> >> /Contents ${content} 0 R >>`;
      objects[content] = { dict: `<< /Length ${stream.length} >>`, data: stream };
    }
    objects[catalog] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objects[pagesId] = `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${pageIds.length} >>`;
    const info = reserve();
    objects[info] = `<< /Title ${literal(encode(this.title))} /Producer (Locale Launchpad) /Creator (Locale Homes) >>`;

    // Every dictionary is ASCII, so byte offsets are string lengths plus binary lengths.
    const parts: (string | Uint8Array)[] = ["%PDF-1.4\n%âãÏÓ\n"];
    let offset = 15;
    const offsets: number[] = [];
    const push = (p: string | Uint8Array) => {
      parts.push(p);
      offset += typeof p === "string" ? p.length : p.length;
    };
    for (let id = 1; id < next; id++) {
      offsets[id] = offset;
      const o = objects[id];
      if (typeof o === "string") push(`${id} 0 obj\n${o}\nendobj\n`);
      else {
        push(`${id} 0 obj\n${o.dict}\nstream\n`);
        push(o.data);
        push("\nendstream\nendobj\n");
      }
    }
    const xref = offset;
    let tail = `xref\n0 ${next}\n0000000000 65535 f \n`;
    for (let id = 1; id < next; id++) tail += `${String(offsets[id]).padStart(10, "0")} 00000 n \n`;
    tail += `trailer\n<< /Size ${next} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
    push(tail);

    // Strings hold only ASCII except the binary-marker comment, whose four
    // characters are written as single Latin-1 bytes.
    const bytes = parts.map((p) => (typeof p === "string" ? Uint8Array.from(p, (c) => c.charCodeAt(0)) : p));
    return new Blob(bytes as BlobPart[], { type: "application/pdf" });
  }
}

/** Save a blob under a file name (the browser's download). */
export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
