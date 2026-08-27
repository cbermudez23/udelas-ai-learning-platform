import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateChatCompletion, AIConfigError } from "@/lib/ai";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { query } = await req.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Debes indicar una búsqueda." }, { status: 400 });
  }

  const terms = query.trim().split(/\s+/).slice(0, 6);

  const documents = await prisma.libraryDocument.findMany({
    where: {
      OR: terms.flatMap((t) => [
        { title: { contains: t, mode: "insensitive" as const } },
        { content: { contains: t, mode: "insensitive" as const } },
        { tags: { has: t.toLowerCase() } }
      ])
    },
    take: 8
  });

  let synthesis: string | null = null;
  if (documents.length > 0) {
    try {
      const context = documents
        .map((d, i) => `[Doc ${i + 1}] ${d.title} (${d.type})\n${d.content.slice(0, 800)}`)
        .join("\n\n");

      synthesis = await generateChatCompletion(
        [
          {
            role: "system",
            content:
              "Eres el asistente de la Biblioteca Institucional Inteligente de UDELAS. Responde la consulta del usuario basándote ÚNICAMENTE en los documentos institucionales proporcionados. Cita el documento entre corchetes, ej. [Doc 1]. Si los documentos no contienen la respuesta, dilo honestamente. Responde en español, de forma breve y clara."
          },
          { role: "user", content: `Consulta: "${query}"\n\nDocumentos institucionales:\n${context}` }
        ],
        { maxTokens: 500 }
      );
    } catch (err) {
      if (!(err instanceof AIConfigError)) console.error(err);
      // Si la IA no está configurada, se devuelven igualmente los resultados de búsqueda.
    }
  }

  return NextResponse.json({ documents, synthesis });
}
