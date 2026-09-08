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
