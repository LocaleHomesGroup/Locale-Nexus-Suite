import { PdfDoc, pathBounds, type PdfFont, type Rgb } from "@/lib/pdf";
import { HOMES_ARCH, LOCALE_HOMES_LOGO } from "@/lib/brand-marks";
import { money, type QuoteDoc } from "./quote-doc";

/**
 * The estimate as a Locale Homes PDF: the Homes logo in silver on a charcoal
 * band, the quote number framed in the Homes arch in Haven, headings in Libre
 * Baskerville and everything else in Manrope (the Locale stylesheet), then the
 * client, the home, the price and the variations. Loaded on demand, so the
 * writer and the fonts only download when someone generates a quote.
 */

const CHARCOAL: Rgb = [50, 50, 50];
const GRANITE: Rgb = [115, 115, 115];
const INK_SOFT: Rgb = [104, 104, 104];
const SILVER: Rgb = [242, 242, 242];
const HAVEN: Rgb = [156, 227, 219];
const HAVEN_50: Rgb = [240, 251, 249];
const HAVEN_100: Rgb = [221, 246, 242];
const HAVEN_700: Rgb = [22, 116, 107];
const HAIRLINE: Rgb = [228, 228, 228];
const ON_CHARCOAL: Rgb = [196, 196, 196];

/** The brand faces, served from /public/fonts/pdf (both OFL). */
const FONT_FILES: Record<PdfFont, { url: string; name: string }> = {
  regular: { url: "/fonts/pdf/Manrope-Regular.ttf", name: "Manrope-Regular" },
  bold: { url: "/fonts/pdf/Manrope-SemiBold.ttf", name: "Manrope-SemiBold" },
  heading: { url: "/fonts/pdf/LibreBaskerville-Bold.ttf", name: "LibreBaskerville-Bold" },
  accent: { url: "/fonts/pdf/LibreBaskerville-Italic.ttf", name: "LibreBaskerville-Italic" },
};

let fontsOnce: Promise<Partial<Record<PdfFont, Uint8Array>>> | null = null;

/** Fetch the four faces once a session. A face that fails to load falls back to Helvetica. */
function loadFonts() {
  fontsOnce ??= Promise.all(
    (Object.keys(FONT_FILES) as PdfFont[]).map(async (f) => {
      try {
        const res = await fetch(FONT_FILES[f].url);
        if (!res.ok) return [f, null] as const;
        return [f, new Uint8Array(await res.arrayBuffer())] as const;
      } catch {
        return [f, null] as const;
      }
    }),
  ).then((pairs) => Object.fromEntries(pairs.filter(([, b]) => b)) as Partial<Record<PdfFont, Uint8Array>>);
  return fontsOnce;
}

const LOGO_BOUNDS = pathBounds([...LOCALE_HOMES_LOGO]);

export interface QuotePdf {
  blob: Blob;
  pages: number;
  /** False when a brand font couldn't load and Helvetica stood in. */
  branded: boolean;
}

export async function quotePdf(q: QuoteDoc): Promise<QuotePdf> {
  const fonts = await loadFonts();
  const names = Object.fromEntries(Object.entries(FONT_FILES).map(([f, v]) => [f, v.name])) as Record<PdfFont, string>;
  const doc = new PdfDoc({ title: `Locale Homes estimate ${q.no} · ${q.client}`, fonts, names });

  const W = doc.width;
  const H = doc.height;
  const M = 48;
  const CW = W - 2 * M;
  const BOTTOM = H - 80;
  let y = 0;

  const logo = (x: number, top: number, height: number, fill: Rgb) => {
    const scale = height / LOGO_BOUNDS.h;
    for (const d of LOCALE_HOMES_LOGO) doc.path(d, { x, y: top, scale, ox: LOGO_BOUNDS.x, oy: LOGO_BOUNDS.y, fill });
    return LOGO_BOUNDS.w * scale;
  };

  /** A later page: a slim header with the charcoal logo, so a loose page still says whose it is. */
  const continuation = () => {
    doc.addPage();
    logo(M, 30, 24, CHARCOAL);
    doc.text(`${q.no} · ${q.client}`, W - M, 48, { size: 8, color: GRANITE, align: "right" });
    doc.line(M, 66, W - M, 66, { color: HAIRLINE });
    y = 92;
  };

  const ensure = (h: number) => {
    if (y + h > BOTTOM) continuation();
  };

  /** A section heading: the short Haven rule from the logo, then tracked caps. */
  const heading = (label: string, x = M) => {
    doc.rect(x, y, 20, 2.2, { fill: HAVEN });
    doc.text(label.toUpperCase(), x, y + 15, { font: "bold", size: 7.5, tracking: 1.1, color: CHARCOAL });
    y += 28;
  };

  /* ── Page 1: the band ─────────────────────────────────────────────── */

  doc.rect(0, 0, W, 150, { fill: CHARCOAL });
  logo(M, 46, 52, SILVER);

  // The Homes arch rises out of the band and frames the quote number.
  const archW = 124;
  const archScale = archW / HOMES_ARCH.width;
  const archX = W - M - archW;
  const archTop = 24;
  const cx = archX + archW / 2;
  doc.clip(0, 0, W, 150, () =>
    doc.path(HOMES_ARCH.d, { x: archX, y: archTop, scale: archScale, stroke: HAVEN, lineWidth: 1.1 }),
  );
  doc.text("HOME ESTIMATE", cx, 80, { font: "bold", size: 6.5, tracking: 1.4, color: HAVEN, align: "center" });
  doc.text(q.no, cx, 104, { font: "heading", size: 17, color: SILVER, align: "center" });
  doc.text(q.date, cx, 121, { size: 8, color: ON_CHARCOAL, align: "center" });
  doc.text(`Valid until ${q.validUntil}`, cx, 134, { size: 6.8, color: ON_CHARCOAL, align: "center" });

  /* ── Who it's for ─────────────────────────────────────────────────── */

  y = 192;
  doc.text("Prepared for", M, y, { font: "accent", size: 11, color: GRANITE });
  doc.text("PREPARED BY", W - M, y - 2, { font: "bold", size: 6.8, tracking: 1.1, color: GRANITE, align: "right" });
  doc.text(q.preparedBy, W - M, y + 13, { size: 10, color: CHARCOAL, align: "right" });
  doc.text("Locale Homes", W - M, y + 26, { size: 8.5, color: GRANITE, align: "right" });
  y += 26;
  for (const line of doc.wrap(q.client, CW - 170, "heading", 21)) {
    doc.text(line, M, y, { font: "heading", size: 21, color: CHARCOAL });
    y += 25;
  }
  if (q.address) {
    for (const line of doc.wrap(q.address, CW - 170, "regular", 10)) {
      doc.text(line, M, y - 6, { size: 10, color: GRANITE });
      y += 13;
    }
  }

  /* ── The figure ───────────────────────────────────────────────────── */

  y += 8;
  doc.rect(M, y, CW, 66, { fill: HAVEN_50, stroke: HAVEN, lineWidth: 0.9, radius: 10 });
  doc.text("FINAL BUILD PRICE", M + 20, y + 27, { font: "bold", size: 7.5, tracking: 1.2, color: HAVEN_700 });
  doc.text("Base build, site costs and variations", M + 20, y + 44, { size: 9, color: GRANITE });
  doc.text(money(q.final), W - M - 20, y + 43, { font: "heading", size: 25, color: CHARCOAL, align: "right" });
  y += 96;

  /* ── The client and the home, side by side ────────────────────────── */

  const colW = (CW - 28) / 2;
  const rows = (x: number, top: number, list: [string, string][]) => {
    let at = top;
    for (const [label, value] of list) {
      const lines = doc.wrap(value, colW - 84, "regular", 9.5);
      doc.text(label, x, at, { size: 8.5, color: GRANITE });
      lines.forEach((l, i) => doc.text(l, x + 84, at + i * 12.5, { size: 9.5, color: CHARCOAL }));
      at += lines.length * 12.5 + 6;
    }
    return at;
  };
  const top = y;
  heading("The client");
  const leftEnd = rows(M, y, q.clientRows);
  y = top;
  heading("Your home", M + colW + 28);
  const rightEnd = rows(M + colW + 28, y, q.homeRows);
  y = Math.max(leftEnd, rightEnd) + 18;

  /* ── Price breakdown ──────────────────────────────────────────────── */

  ensure(80 + q.price.length * 28);
  heading("Price breakdown");
  q.price.forEach((row, i) => {
    // The base row says what it buys (HomeScope's "Base building price includes").
    const notes = [...(i === 0 ? doc.wrap(q.includes.join("  ·  "), CW - 120, "regular", 8) : []), ...(row.note ? [row.note] : [])];
    doc.text(row.label, M, y + 10, { size: 10, color: CHARCOAL });
    notes.forEach((t, j) => doc.text(t, M, y + 23 + j * 10.5, { size: 8, color: GRANITE }));
    const sign = row.sign === "+" ? "+" : row.sign === "−" ? "–" : "";
    doc.text(`${sign}${money(row.amount)}`, W - M, y + 10, { font: "bold", size: 10, color: CHARCOAL, align: "right" });
    y += 22 + notes.length * 10.5;
    doc.line(M, y - 4, W - M, y - 4, { color: HAIRLINE, width: 0.6 });
  });
  doc.rect(M, y + 2, CW, 30, { fill: HAVEN_100, radius: 6 });
  doc.text("Final build price", M + 12, y + 21, { font: "bold", size: 10.5, color: CHARCOAL });
  doc.text(money(q.final), W - M - 12, y + 22, { font: "heading", size: 13, color: CHARCOAL, align: "right" });
  y += 56;

  /* ── Site cost variations ─────────────────────────────────────────── */

  if (q.siteLines) {
    ensure(50 + Math.max(1, q.siteLines.length) * 22);
    heading("Site cost variations");
    if (!q.siteLines.length) {
      doc.text("No site cost variations on this estimate.", M, y, { size: 9.5, color: GRANITE });
      y += 22;
    }
    for (const l of q.siteLines) {
      doc.text(l.label, M, y + 8, { size: 9.5, color: CHARCOAL });
      if (l.note) doc.text(l.note, M + doc.measure(l.label, "regular", 9.5) + 8, y + 8, { size: 8, color: GRANITE });
      doc.text(money(l.amount), W - M, y + 8, { font: "bold", size: 9.5, color: CHARCOAL, align: "right" });
      y += 20;
      doc.line(M, y - 5, W - M, y - 5, { color: HAIRLINE, width: 0.6 });
    }
    if (q.titleNote) {
      for (const line of doc.wrap(q.titleNote, CW, "regular", 8)) {
        ensure(12);
        doc.text(line, M, y + 6, { size: 8, color: GRANITE });
        y += 11;
      }
    }
    y += 18;
  }

  /* ── Selected variations ──────────────────────────────────────────── */

  if (q.lines) {
    const typeX = W - M - 196;
    const qtyR = W - M - 92;
    const descW = typeX - 14 - (M + 10);
    const tableHead = () => {
      doc.rect(M, y, CW, 20, { fill: SILVER, radius: 4 });
      const hy = y + 13;
      doc.text("DESCRIPTION", M + 10, hy, { font: "bold", size: 6.8, tracking: 0.9, color: INK_SOFT });
      doc.text("TYPE", typeX, hy, { font: "bold", size: 6.8, tracking: 0.9, color: INK_SOFT });
      doc.text("QTY", qtyR, hy, { font: "bold", size: 6.8, tracking: 0.9, color: INK_SOFT, align: "right" });
      doc.text("AMOUNT", W - M - 10, hy, { font: "bold", size: 6.8, tracking: 0.9, color: INK_SOFT, align: "right" });
      y += 28;
    };
    ensure(90);
    heading("Selected variations");
    if (!q.lines.length) {
      doc.text("No variations selected.", M, y, { size: 9.5, color: GRANITE });
      y += 24;
    } else {
      tableHead();
      for (const l of q.lines) {
        const lines = doc.wrap(l.description, descW, "regular", 9);
        const h = Math.max(lines.length * 11.5, 22) + 8;
        if (y + h > BOTTOM) {
          continuation();
          tableHead();
        }
        lines.forEach((t, i) => doc.text(t, M + 10, y + 4 + i * 11.5, { size: 9, color: CHARCOAL }));
        doc.text(l.type, typeX, y + 4, { size: 8.5, color: CHARCOAL });
        doc.text([l.pricing, l.boltOn ? "Bolt-on" : ""].filter(Boolean).join(" · "), typeX, y + 15, { size: 7.5, color: GRANITE });
        doc.text(String(l.qty), qtyR, y + 4, { size: 9, color: CHARCOAL, align: "right" });
        doc.text(`${l.type === "Credit" ? "–" : "+"}${money(l.amount)}`, W - M - 10, y + 4, {
          font: "bold",
          size: 9,
          color: CHARCOAL,
          align: "right",
        });
        y += h;
        doc.line(M, y - 7, W - M, y - 7, { color: HAIRLINE, width: 0.6 });
      }
      y += 12;
    }
  }

  /* ── Notes and next steps ─────────────────────────────────────────── */

  if (q.notes) {
    const lines = doc.wrap(q.notes, CW, "regular", 9.5);
    ensure(40 + Math.min(lines.length, 6) * 13);
    heading("Notes from your consultant");
    y += 8;
    for (const line of lines) {
      ensure(14);
      doc.text(line, M, y, { size: 9.5, color: CHARCOAL });
      y += 13;
    }
    y += 16;
  }

  const intro = doc.wrap(q.nextSteps.intro, CW - 36, "regular", 9);
  const boxH = 40 + intro.length * 12 + q.nextSteps.bullets.length * 13;
  ensure(boxH + 10);
  doc.rect(M, y, CW, boxH, { fill: SILVER, radius: 8 });
  doc.text("Next steps", M + 18, y + 24, { font: "heading", size: 11.5, color: CHARCOAL });
  let ny = y + 42;
  for (const line of intro) {
    doc.text(line, M + 18, ny, { size: 9, color: CHARCOAL });
    ny += 12;
  }
  ny += 3;
  for (const b of q.nextSteps.bullets) {
    doc.rect(M + 19, ny - 5, 4, 4, { fill: HAVEN_700, radius: 2 });
    doc.text(b, M + 30, ny, { size: 9, color: CHARCOAL });
    ny += 13;
  }

  /* ── Footers, now the page count is known ─────────────────────────── */

  const total = doc.pageCount;
  const disclaimer = doc.wrap(q.disclaimer, CW - 120, "regular", 7);
  for (let p = 0; p < total; p++) {
    doc.setPage(p);
    doc.line(M, H - 60, W - M, H - 60, { color: HAVEN, width: 0.9 });
    doc.text("LOCALE HOMES", M, H - 45, { font: "bold", size: 6.5, tracking: 1.3, color: CHARCOAL });
    disclaimer.slice(0, 2).forEach((l, i) => doc.text(l, M, H - 34 + i * 9, { size: 7, color: GRANITE }));
    doc.text(`${q.no} · Page ${p + 1} of ${total}`, W - M, H - 45, { size: 7.5, color: GRANITE, align: "right" });
  }

  return { blob: doc.toBlob(), pages: total, branded: Object.keys(fonts).length === 4 };
}
