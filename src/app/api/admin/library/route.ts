import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { extractText, replaceChunks, SUPPORTED_EXT, MAX_TEXT } from "@/lib/library";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const TYPES = ["reglamento", "guia", "politica", "manual", "articulo", "libro", "otro"];

/** POST multipart: file, title, type, tags → crea un documento institucional (sin curso) e indexa su texto. */
export async function POST(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Solo administradores" }, { status: 403 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const title = String(form.get("title") || "").trim();
  const type = String(form.get("type") || "otro");
  const tags = String(form.get("tags") || "").split(",").map((t) => t.trim().toLowerCase()).filter(Boolean);
  if (!file || !title) return NextResponse.json({ error: "Faltan el archivo o el título." }, { status: 400 });
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (!SUPPORTED_EXT.has(ext)) return NextResponse.json({ error: `Formato .${ext} no soportado. Usa PDF, Word (.docx), texto, Markdown o HTML.` }, { status: 400 });
  if (file.size > 20 * 1024 * 1024) return NextResponse.json({ error: "El archivo supera 20 MB." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  let text = "";
  try {
    text = (await extractText(buffer, file.name, file.type)).trim();
  } catch (e: any) {
    return NextResponse.json({ error: `No se pudo extraer el texto: ${e.message}` }, { status: 400 });
  }
  if (!text) return NextResponse.json({ error: "El archivo no contiene texto extraíble (¿es un PDF escaneado?). El OCR llegará en la siguiente versión." }, { status: 400 });

  const doc = await prisma.libraryDocument.create({
    data: {
      title, type: TYPES.includes(type) ? type : "otro", tags, content: text.slice(0, MAX_TEXT),
      moodleFileName: file.name, mimeType: file.type || null, fileSize: file.size,
      status: "indexed", indexedAt: new Date()
    }
  });
  const chunks = await replaceChunks(doc.id, text);
  return NextResponse.json({ ok: true, id: doc.id, chunks });
}

/** DELETE { id } */
export async function DELETE(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Solo administradores" }, { status: 403 });
  const { id } = await req.json().catch(() => ({}));
  if (!id) return NextResponse.json({ error: "Falta id" }, { status: 400 });
  await prisma.libraryDocument.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
