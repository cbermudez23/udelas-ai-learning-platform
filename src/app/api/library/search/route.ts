import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateChatCompletion, AIConfigError } from "@/lib/ai";
import { searchChunks, materialsContextText } from "@/lib/library";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { query, courseId } = await req.json();
  if (!query || typeof query !== "string") {
    return NextResponse.json({ error: "Debes indicar una búsqueda." }, { status: 400 });
  }

  // Los administradores buscan en todo; el resto, en sus cursos (+ documentos institucionales)
  let courseIds: string[] | null = null;
  if (session.user.role !== "ADMIN") {
    const enr = await prisma.enrollment.findMany({ where: { userId: session.user.id }, select: { courseId: true } });
    courseIds = enr.map((e) => e.courseId);
  }
  if (courseId) courseIds = [courseId];

  const hits = await searchChunks(query, courseIds, 8);

  let synthesis: string | null = null;
  if (hits.length > 0) {
    try {
      synthesis = await generateChatCompletion(
        [
          {
            role: "system",
            content:
              "Eres el asistente de la Biblioteca IA de UDELAS. Responde la consulta basándote ÚNICAMENTE en los materiales proporcionados, citando la fuente entre corchetes, ej. [Material 1]. Si los materiales no contienen la respuesta, dilo honestamente. Responde en español, de forma breve y clara."
          },
          { role: "user", content: `Consulta: "${query}"\n\nMateriales:\n${materialsContextText(hits)}` }
        ],
        { maxTokens: 600 }
      );
    } catch (err) {
      if (!(err instanceof AIConfigError)) console.error(err);
    }
  }

  return NextResponse.json({ hits, synthesis });
}
