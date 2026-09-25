// src/app/api/courses/import/route.ts
// Recibe un archivo (DOCX o PDF), extrae el texto y llama a Claude
// para obtener un JSON con la estructura completa del curso.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import Anthropic from "@anthropic-ai/sdk";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface CourseActivity {
  type: "page" | "forum" | "quiz" | "assign" | "label" | "url" | "folder";
  name: string;
  intro: string;           // Descripción breve visible en Moodle
  content?: string;        // HTML para pages/labels
  grade?: number;          // Puntos para quizzes y assigns
  forumType?: "general" | "news" | "blog";
  isGraded?: boolean;
  completionRequired?: boolean;
}

export interface CourseSection {
  name: string;
  summary: string;
  activities: CourseActivity[];
}

export interface CourseStructure {
  fullname: string;
  shortname: string;
  summary: string;
  format: "topics" | "weeks";
  lang: string;
  durationWeeks: number;
  totalHours: number;
  sections: CourseSection[];
  evaluationPlan: Array<{
    activity: string;
    weight: number;  // porcentaje
    evidence: string;
  }>;
}

// ─── Extracción de texto del archivo ──────────────────────────────────────────

async function extractText(file: File): Promise<string> {
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const mime = file.type;

  if (
    mime === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    file.name.endsWith(".docx")
  ) {
    // mammoth está disponible en el proyecto (ya se usa en la biblioteca)
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }

  if (mime === "application/pdf" || file.name.endsWith(".pdf")) {
    // unpdf también está disponible
    const { extractText: pdfExtract, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await pdfExtract(pdf, { mergePages: true });
    return String(text ?? "");
  }

  if (mime === "text/plain" || file.name.endsWith(".txt") || file.name.endsWith(".md")) {
    return buffer.toString("utf-8");
  }

  throw new Error(`Formato no soportado: ${file.name}. Use DOCX, PDF o TXT.`);
}

// ─── Prompt para Claude ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un experto en diseño instruccional para plataformas LMS universitarias (Moodle).
Tu tarea es analizar la propuesta de curso que se te proporciona y devolver un JSON estructurado
con toda la información necesaria para crear el curso completo en Moodle.

REGLAS ESTRICTAS:
1. Responde SOLO con JSON válido, sin texto adicional, sin bloques de código.
2. El JSON debe seguir exactamente el schema definido.
3. El shortname debe ser único, sin espacios, en mayúsculas con guiones (ej: GENERO-UDELAS-2026).
4. Las sections siguen la estructura de bloques MAVU: Bloque 0 (identidad), Bloque 1 (bienvenida),
   Bloque 2 (planificación/guía), Bloque 3 (módulos/contenidos), Bloque 4 (evaluación),
   Bloque 5 (cierre).
5. El total de weights en evaluationPlan debe sumar exactamente 100.
6. Para activities de tipo "quiz" o "assign" que son evaluadas, incluye grade con el valor en puntos
   (igual al weight).
7. El HTML en content y intro debe ser HTML válido, sin scripts.
8. Máximo 6 secciones (bloques MAVU 0-5).
9. Cada sección puede tener máximo 8 actividades.

SCHEMA JSON ESPERADO:
{
  "fullname": "string",
  "shortname": "string",
  "summary": "string (HTML)",
  "format": "topics",
  "lang": "es",
  "durationWeeks": number,
  "totalHours": number,
  "sections": [
    {
      "name": "string",
      "summary": "string (HTML)",
      "activities": [
        {
          "type": "page|forum|quiz|assign|label|url|folder",
          "name": "string",
          "intro": "string (HTML breve)",
          "content": "string (HTML, solo para page y label)",
          "grade": number (solo para quiz y assign evaluados),
          "forumType": "general|news|blog (solo para forum)",
          "isGraded": boolean,
          "completionRequired": boolean
        }
      ]
    }
  ],
  "evaluationPlan": [
    { "activity": "string", "weight": number, "evidence": "string" }
  ]
}`;

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // Auth: solo admins
  const session = await getServerSession(authOptions);
  if (!session || session.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  let documentText: string;

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No se recibió ningún archivo" }, { status: 400 });
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "El archivo no debe superar 10 MB" }, { status: 400 });
    }

    documentText = await extractText(file);

    if (documentText.trim().length < 100) {
      return NextResponse.json(
        { error: "El documento parece estar vacío o no se pudo leer correctamente" },
        { status: 400 }
      );
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Error al leer el archivo";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // Llamar a Claude para parsear la estructura
  try {
    const settings = await getSettings();
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    const response = await client.messages.create({
      model: settings.anthropicModel,
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analiza este documento de propuesta de curso y devuelve el JSON estructurado:\n\n${documentText.slice(0, 40000)}`,
        },
      ],
    });

    const rawJson = response.content[0].type === "text" ? response.content[0].text : "";

    let structure: CourseStructure;
    try {
      // Claude a veces envuelve en ```json ... ``` aunque se le pide que no
      const cleaned = rawJson.replace(/^```json\s*|```\s*$/g, "").trim();
      structure = JSON.parse(cleaned) as CourseStructure;
    } catch {
      console.error("JSON inválido de Claude:", rawJson.slice(0, 500));
      return NextResponse.json(
        { error: "La IA no pudo extraer la estructura del documento. Intenta con un archivo más claro." },
        { status: 422 }
      );
    }

    // Validación básica
    if (!structure.fullname || !structure.sections?.length) {
      return NextResponse.json(
        { error: "El documento no tiene suficiente información para crear un curso" },
        { status: 422 }
      );
    }

    return NextResponse.json({ success: true, structure });
  } catch (e: unknown) {
    console.error("Error llamando a Claude:", e);
    return NextResponse.json(
      { error: "Error al analizar el documento con IA. Verifica la configuración del proveedor." },
      { status: 500 }
    );
  }
}
