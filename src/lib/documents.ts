/**
 * Generación de documentos de la Plataforma (PDF y Word) con identidad UDELAS.
 * Ambos formatos comparten un modelo de bloques sencillo derivado de Markdown.
 */
import PDFDocument from "pdfkit";
import {
  Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, WidthType, AlignmentType,
  ShadingType, LevelFormat, Footer, PageNumber
} from "docx";

export type Block =
  | { type: "h1" | "h2" | "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "hr" }
  | { type: "kv"; items: { label: string; value: string }[] };

const BRAND = "#0055aa";
const BRAND_HEX = "0055AA";

// ---------------------------------------------------------------------------
// Markdown → bloques
// ---------------------------------------------------------------------------
export function markdownToBlocks(md: string): Block[] {
  const lines = md.replace(/\r/g, "").split("\n");
  const blocks: Block[] = [];
  let para: string[] = [];
  let list: { type: "ul" | "ol"; items: string[] } | null = null;
  let table: string[][] | null = null;

  const flushPara = () => { if (para.length) { blocks.push({ type: "p", text: para.join(" ") }); para = []; } };
  const flushList = () => { if (list) { blocks.push(list); list = null; } };
  const flushTable = () => {
    if (table && table.length) {
      const [headers, ...rows] = table;
      blocks.push({ type: "table", headers, rows });
    }
    table = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) { flushPara(); flushList(); flushTable(); continue; }
    const h = /^(#{1,3})\s+(.*)$/.exec(line);
    if (h) { flushPara(); flushList(); flushTable(); blocks.push({ type: h[1].length === 1 ? "h1" : h[1].length === 2 ? "h2" : "h3", text: h[2] }); continue; }
    if (/^(-{3,}|\*{3,})$/.test(line.trim())) { flushPara(); flushList(); flushTable(); blocks.push({ type: "hr" }); continue; }
    if (/^\|/.test(line.trim())) {
      flushPara(); flushList();
      const cells = line.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
      if (cells.every((c) => /^:?-{2,}:?$/.test(c))) continue; // separador
      table = table || [];
      table.push(cells);
      continue;
    }
    const ul = /^\s*[-*•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara(); flushTable();
      const type = ul ? "ul" : "ol";
      if (!list || list.type !== type) { flushList(); list = { type, items: [] }; }
      list.items.push((ul || ol)![1]);
      continue;
    }
    flushList(); flushTable();
    para.push(line.trim());
  }
  flushPara(); flushList(); flushTable();
  return blocks;
}

/** Quita marcas de Markdown en línea para PDF. Devuelve segmentos con negrita. */
function inlineSegments(text: string): { text: string; bold: boolean }[] {
  const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
  return parts.map((s) => s.startsWith("**") && s.endsWith("**")
    ? { text: s.slice(2, -2), bold: true }
    : { text: s.replace(/`([^`]+)`/g, "$1").replace(/\*([^*]+)\*/g, "$1"), bold: false });
}
function plain(text: string) { return inlineSegments(text).map((s) => s.text).join(""); }

export interface DocMeta {
  title: string;
  subtitle?: string;
  author?: string;
  course?: string;
  date?: Date;
}

// ---------------------------------------------------------------------------
// PDF
// ---------------------------------------------------------------------------
export async function blocksToPdf(meta: DocMeta, blocks: Block[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ bufferPages: true, size: "LETTER", margins: { top: 64, bottom: 64, left: 56, right: 56 }, info: { Title: meta.title, Author: meta.author || "UDELAS AI Learning Platform" } });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const W = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const date = (meta.date || new Date()).toLocaleDateString("es-PA", { year: "numeric", month: "long", day: "numeric" });

    // Cabecera institucional
    doc.rect(0, 0, doc.page.width, 46).fill(BRAND);
    doc.fillColor("#FFFFFF").font("Helvetica-Bold").fontSize(11).text("UDELAS AI Learning Platform", 56, 15);
    doc.font("Helvetica").fontSize(8).text("Universidad Especializada de las Américas", 56, 29);
    doc.fillColor("#000000");
    doc.y = 70;

    doc.font("Helvetica-Bold").fontSize(18).fillColor(BRAND).text(meta.title, { width: W });
    if (meta.subtitle) doc.font("Helvetica").fontSize(11).fillColor("#444444").text(meta.subtitle, { width: W });
    const metaLine = [meta.course ? `Curso: ${meta.course}` : null, meta.author ? `Elaborado por: ${meta.author}` : null, `Fecha: ${date}`].filter(Boolean).join("   ·   ");
    doc.moveDown(0.3).font("Helvetica").fontSize(8.5).fillColor("#777777").text(metaLine, { width: W });
    doc.moveDown(0.4);
    doc.moveTo(56, doc.y).lineTo(56 + W, doc.y).lineWidth(0.8).strokeColor(BRAND).stroke();
    doc.moveDown(0.8).fillColor("#000000");

    const ensure = (h: number) => { if (doc.y + h > doc.page.height - doc.page.margins.bottom) doc.addPage(); };
    const writeInline = (text: string, size: number, opts: any = {}) => {
      const segs = inlineSegments(text);
      doc.fontSize(size);
      segs.forEach((s, i) => {
        doc.font(s.bold ? "Helvetica-Bold" : "Helvetica").text(s.text, { continued: i < segs.length - 1, width: W, ...opts });
      });
    };

    for (const b of blocks) {
      switch (b.type) {
        case "h1": ensure(40); doc.moveDown(0.5); doc.font("Helvetica-Bold").fontSize(14).fillColor(BRAND).text(plain(b.text), { width: W }); doc.fillColor("#000000").moveDown(0.3); break;
        case "h2": ensure(32); doc.moveDown(0.4); doc.font("Helvetica-Bold").fontSize(12).fillColor("#222222").text(plain(b.text), { width: W }); doc.fillColor("#000000").moveDown(0.2); break;
        case "h3": ensure(28); doc.moveDown(0.3); doc.font("Helvetica-Bold").fontSize(10.5).fillColor("#333333").text(plain(b.text), { width: W }); doc.fillColor("#000000").moveDown(0.15); break;
        case "p": ensure(24); writeInline(b.text, 10, { align: "justify", lineGap: 2 }); doc.moveDown(0.5); break;
        case "hr": ensure(12); doc.moveDown(0.2); doc.moveTo(56, doc.y).lineTo(56 + W, doc.y).lineWidth(0.5).strokeColor("#CCCCCC").stroke(); doc.moveDown(0.5); break;
        case "ul":
        case "ol":
          b.items.forEach((it, i) => {
            ensure(18);
            const marker = b.type === "ul" ? "•" : `${i + 1}.`;
            const y = doc.y;
            doc.font("Helvetica").fontSize(10).text(marker, 56 + 6, y, { width: 18, lineBreak: false });
            doc.x = 56 + 24; doc.y = y;
            writeInline(it, 10, { width: W - 24, lineGap: 1.5 });
            doc.x = 56;
            doc.moveDown(0.15);
          });
          doc.moveDown(0.4);
          break;
        case "kv":
          b.items.forEach((kv) => {
            ensure(16);
            const y = doc.y;
            doc.font("Helvetica-Bold").fontSize(9.5).fillColor("#555555").text(kv.label, 56, y, { width: 150, lineBreak: false });
            doc.font("Helvetica").fontSize(9.5).fillColor("#000000").text(kv.value, 56 + 156, y, { width: W - 156 });
            doc.x = 56;
          });
          doc.moveDown(0.5);
          break;
        case "table": {
          const cols = b.headers.length || 1;
          const colW = W / cols;
          const rowH = (cells: string[], bold = false) => {
            doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
            return Math.max(...cells.map((c) => doc.heightOfString(plain(c), { width: colW - 8 }))) + 8;
          };
          const drawRow = (cells: string[], head = false, shade = false) => {
            const h = rowH(cells, head);
            ensure(h);
            const y = doc.y;
            if (head) doc.rect(56, y, W, h).fill(BRAND);
            else if (shade) doc.rect(56, y, W, h).fill("#F3F4F6");
            doc.fillColor(head ? "#FFFFFF" : "#000000").font(head ? "Helvetica-Bold" : "Helvetica").fontSize(8.5);
            cells.forEach((c, i) => doc.text(plain(c), 56 + i * colW + 4, y + 4, { width: colW - 8 }));
            doc.rect(56, y, W, h).lineWidth(0.4).strokeColor("#DDDDDD").stroke();
            doc.fillColor("#000000");
            doc.x = 56; doc.y = y + h;
          };
          doc.moveDown(0.2);
          drawRow(b.headers, true);
          b.rows.forEach((r, i) => drawRow(r.length < cols ? [...r, ...Array(cols - r.length).fill("")] : r.slice(0, cols), false, i % 2 === 1));
          doc.moveDown(0.6);
          break;
        }
      }
    }

    // Pie de página en todas las páginas.
    // Se anula temporalmente el margen inferior: al escribir dentro de esa
    // franja, PDFKit interpreta por defecto que "no cabe" y agrega una
    // página en blanco solo para el pie. Anulando el margen evitamos ese
    // salto automático.
    const range = doc.bufferedPageRange();
    const bottomMargin = doc.page.margins.bottom;
    for (let i = range.start; i < range.start + range.count; i++) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0;
      doc.font("Helvetica").fontSize(7.5).fillColor("#888888")
        .text(`Generado por UDELAS AI Learning Platform · ${date} · Página ${i + 1} de ${range.count}`, 56, doc.page.height - 40, { width: W, align: "center", lineBreak: false });
      doc.page.margins.bottom = bottomMargin;
    }
    doc.end();
  });
}

// ---------------------------------------------------------------------------
// Word
// ---------------------------------------------------------------------------
export async function blocksToDocx(meta: DocMeta, blocks: Block[]): Promise<Buffer> {
  const runs = (t: string) => inlineSegments(t).map((s) => new TextRun({ text: s.text, bold: s.bold }));
  const date = (meta.date || new Date()).toLocaleDateString("es-PA", { year: "numeric", month: "long", day: "numeric" });
  const children: (Paragraph | Table)[] = [
    new Paragraph({ children: [new TextRun({ text: "UDELAS AI Learning Platform · Universidad Especializada de las Américas", size: 16, color: "888888" })] }),
    new Paragraph({ children: [new TextRun({ text: meta.title, bold: true, size: 36, color: BRAND_HEX })], spacing: { before: 200, after: 80 } })
  ];
  if (meta.subtitle) children.push(new Paragraph({ children: [new TextRun({ text: meta.subtitle, size: 22, color: "444444" })], spacing: { after: 80 } }));
  children.push(new Paragraph({ children: [new TextRun({ text: [meta.course ? `Curso: ${meta.course}` : null, meta.author ? `Elaborado por: ${meta.author}` : null, `Fecha: ${date}`].filter(Boolean).join("   ·   "), size: 17, color: "777777" })], spacing: { after: 240 }, border: { bottom: { color: BRAND_HEX, size: 6, style: "single", space: 4 } } }));

  for (const b of blocks) {
    switch (b.type) {
      case "h1": children.push(new Paragraph({ text: plain(b.text), heading: HeadingLevel.HEADING_1 })); break;
      case "h2": children.push(new Paragraph({ text: plain(b.text), heading: HeadingLevel.HEADING_2 })); break;
      case "h3": children.push(new Paragraph({ text: plain(b.text), heading: HeadingLevel.HEADING_3 })); break;
      case "p": children.push(new Paragraph({ children: runs(b.text), spacing: { after: 120 }, alignment: AlignmentType.JUSTIFIED })); break;
      case "hr": children.push(new Paragraph({ border: { bottom: { color: "CCCCCC", size: 4, style: "single", space: 1 } }, spacing: { after: 120 } })); break;
      case "ul": b.items.forEach((it) => children.push(new Paragraph({ children: runs(it), numbering: { reference: "bullets", level: 0 }, spacing: { after: 60 } }))); break;
      case "ol": b.items.forEach((it) => children.push(new Paragraph({ children: runs(it), numbering: { reference: "numbers", level: 0 }, spacing: { after: 60 } }))); break;
      case "kv": b.items.forEach((kv) => children.push(new Paragraph({ children: [new TextRun({ text: `${kv.label}: `, bold: true }), new TextRun(kv.value)], spacing: { after: 60 } }))); break;
      case "table": {
        const cols = Math.max(1, b.headers.length);
        const total = 9360;
        const w = Math.floor(total / cols);
        const widths = Array(cols).fill(w);
        const cell = (t: string, head = false, shade = false) => new TableCell({
          width: { size: w, type: WidthType.DXA },
          shading: head ? { type: ShadingType.CLEAR, fill: BRAND_HEX, color: "auto" } : shade ? { type: ShadingType.CLEAR, fill: "F3F4F6", color: "auto" } : undefined,
          margins: { top: 60, bottom: 60, left: 90, right: 90 },
          children: [new Paragraph({ children: [new TextRun({ text: plain(t), bold: head, color: head ? "FFFFFF" : undefined, size: 18 })] })]
        });
        children.push(new Table({
          width: { size: total, type: WidthType.DXA }, columnWidths: widths,
          rows: [
            new TableRow({ tableHeader: true, children: b.headers.map((h) => cell(h, true)) }),
            ...b.rows.map((r, i) => new TableRow({ children: Array.from({ length: cols }, (_, ci) => cell(r[ci] || "", false, i % 2 === 1)) }))
          ]
        }));
        children.push(new Paragraph({ spacing: { after: 120 } }));
        break;
      }
    }
  }

  const doc = new Document({
    creator: "UDELAS AI Learning Platform",
    title: meta.title,
    styles: {
      default: { document: { run: { font: "Calibri", size: 21 } } },
      paragraphStyles: [
        { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 28, bold: true, color: BRAND_HEX }, paragraph: { spacing: { before: 240, after: 120 }, outlineLevel: 0 } },
        { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 24, bold: true, color: "222222" }, paragraph: { spacing: { before: 200, after: 100 }, outlineLevel: 1 } },
        { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true, run: { size: 22, bold: true, color: "333333" }, paragraph: { spacing: { before: 160, after: 80 }, outlineLevel: 2 } }
      ]
    },
    numbering: {
      config: [
        { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] },
        { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 270 } } } }] }
      ]
    },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1200, bottom: 1100, left: 1300, right: 1300 } } },
      footers: { default: new Footer({ children: [new Paragraph({ children: [new TextRun({ text: `Generado por UDELAS AI Learning Platform · ${date} · Página `, size: 15, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], size: 15, color: "888888" })], alignment: AlignmentType.CENTER })] }) },
      children
    }]
  });
  return Buffer.from(await Packer.toBuffer(doc));
}
