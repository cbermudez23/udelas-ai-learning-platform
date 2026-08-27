import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "No autenticado" }, { status: 401 });

  const { answers } = await req.json(); // { [questionId]: selectedIndex }

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    include: { questions: true }
  });
  if (!exam) return NextResponse.json({ error: "Examen no encontrado" }, { status: 404 });

  let correct = 0;
  const detail = exam.questions.map((q) => {
    const selected = answers?.[q.id];
    const isCorrect = selected === q.correctOption;
    if (isCorrect) correct += 1;
    return {
      questionId: q.id,
      selected,
      correctOption: q.correctOption,
      isCorrect,
      explanation: q.explanation
    };
  });

  const score = Math.round((correct / exam.questions.length) * 1000) / 10;

  const attempt = await prisma.examAttempt.create({
    data: {
      examId: exam.id,
      userId: session.user.id,
      score,
      totalItems: exam.questions.length,
      answers: answers ?? {}
    }
  });

  return NextResponse.json({ attempt, score, detail });
}
