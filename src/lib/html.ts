/**
 * Moodle guarda campos como el resumen del curso como HTML (p. ej.
 * "<p>Texto...</p>"). Estas utilidades permiten mostrar/editar ese
 * contenido como texto plano en la Plataforma (sin exponer las etiquetas
 * al usuario) y reconvertirlo a HTML simple al guardar, para que Moodle lo
 * siga interpretando correctamente.
 */

export function stripHtml(html?: string | null): string {
  return (html || "")
    .replace(/<\/p>\s*<p>/gi, "\n\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** Convierte texto plano (como lo escribe el usuario) a HTML simple con párrafos, para guardar en Moodle. */
export function textToHtml(text?: string | null): string {
  const t = (text || "").trim();
  if (!t) return "";
  return t
    .split(/\n{2,}/)
    .map((para) => `<p>${escapeHtml(para).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Conversión sencilla de markdown a HTML, para el contenido que generan los
 * agentes docentes (encabezados, negritas, cursivas, listas, párrafos) — no
 * es un parser completo de markdown, cubre solo lo que la IA suele producir
 * en estas respuestas.
 */
export function markdownToHtml(md: string): string {
  const lines = (md || "").replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let para: string[] = [];

  const closeLists = () => {
    if (inUl) { out.push("</ul>"); inUl = false; }
    if (inOl) { out.push("</ol>"); inOl = false; }
  };
  const flushPara = () => {
    if (para.length) { out.push(`<p>${inline(para.join(" "))}</p>`); para = []; }
  };
  const inline = (s: string) =>
    escapeHtml(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  for (const raw of lines) {
    const line = raw.trim();
    const h = line.match(/^(#{1,4})\s+(.*)/);
    const ulItem = line.match(/^[-*]\s+(.*)/);
    const olItem = line.match(/^\d+[.)]\s+(.*)/);

    if (!line) { flushPara(); closeLists(); continue; }
    if (h) {
      flushPara(); closeLists();
      const level = Math.min(h[1].length + 1, 6); // empieza en h2 dentro de la página
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
    } else if (ulItem) {
      flushPara();
      if (!inUl) { closeLists(); out.push("<ul>"); inUl = true; }
      out.push(`<li>${inline(ulItem[1])}</li>`);
    } else if (olItem) {
      flushPara();
      if (!inOl) { closeLists(); out.push("<ol>"); inOl = true; }
      out.push(`<li>${inline(olItem[1])}</li>`);
    } else {
      closeLists();
      para.push(line);
    }
  }
  flushPara();
  closeLists();
  return out.join("\n");
}
