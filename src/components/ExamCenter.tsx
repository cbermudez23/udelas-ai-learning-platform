"use client";

import { useEffect, useState } from "react";
import { FileCheck, Loader2, Sparkles, CheckCircle2, XCircle } from "lucide-react";

interface Question {
  id: string;
  questionText: string;
  options: string[];
  correctOption: number;
  explanation: string | null;
}
interface ExamData {
  id: string;
  title: string;
  topic: string;
  questions: Question[];
}

type Tab = "generar" | "tomar" | "resultado";

export default function ExamCenter({ courses }: { courses: { id: string; name: string }[] }) {
  const [tab, setTab] = useState<Tab>("generar");
  const [topic, setTopic] = useState("");
  const [numQuestions, setNumQuestions] = useState(5);
  const [courseId, setCourseId] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [exams, setExams] = useState<ExamData[]>([]);
  const [activeExam, setActiveExam] = useState<ExamData | null>(null);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    score: number;
    detail: { questionId: string; isCorrect: boolean; correctOption: number; explanation: string | null }[];
  } | null>(null);

  useEffect(() => {
    refreshExams();
  }, []);

  async function refreshExams() {
    const res = await fetch("/api/exams/generate");
    const data = await res.json();
    if (data.exams) setExams(data.exams);
  }

  async function handleGenerate() {
    if (!topic.trim()) return;
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/exams/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, numQuestions, courseId: courseId || undefined })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Error al generar el examen.");
        return;
      }
      await refreshExams();
      setActiveExam(data.exam);
      setAnswers({});
      setResult(null);
      setTab("tomar");
    } finally {
      setGenerating(false);
    }
  }

  function selectExam(exam: ExamData) {
    setActiveExam(exam);
    setAnswers({});
    setResult(null);
    setTab("tomar");
  }

  async function submitExam() {
    if (!activeExam) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/exams/${activeExam.id}/attempt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers })
      });
      const data = await res.json();
      if (res.ok) {
        setResult({ score: data.score, detail: data.detail });
        setTab("resultado");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="tabs flex gap-1 bg-[var(--bg-secondary)] p-1 rounded-lg">
        {(["generar", "tomar", "resultado"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-center text-[12px] rounded-md transition-colors ${
              tab === t
                ? "bg-white font-medium border border-[var(--border-tertiary)]"
                : "text-[var(--text-secondary)]"
            }`}
          >
            {t === "generar" ? "Generar" : t === "tomar" ? "Tomar examen" : "Resultado"}
          </button>
        ))}
      </div>

      {tab === "generar" && (
        <div className="card space-y-3">
          <div className="flex items-center gap-2 text-[13px] font-medium">
            <Sparkles className="w-4 h-4 text-[var(--clr-brand2)]" /> Generar examen con IA
          </div>
          <div>
            <label className="text-[11px] font-medium text-[var(--text-secondary)]">Tema</label>
            <input
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              placeholder="Ej. Redes neuronales artificiales"
              className="mt-1 w-full text-[13px] px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none focus:border-[var(--clr-brand2)]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                Número de preguntas
              </label>
              <input
                type="number"
                min={3}
                max={10}
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="mt-1 w-full text-[13px] px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none focus:border-[var(--clr-brand2)]"
              />
            </div>
            <div>
              <label className="text-[11px] font-medium text-[var(--text-secondary)]">
                Curso (opcional)
              </label>
              <select
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
                className="mt-1 w-full text-[13px] px-3 py-2 rounded-lg border border-[var(--border-secondary)] outline-none focus:border-[var(--clr-brand2)]"
              >
                <option value="">Sin curso específico</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {error && <div className="text-[11px] text-red-600">{error}</div>}
          <button
            onClick={handleGenerate}
            disabled={generating || !topic.trim()}
            className="flex items-center gap-2 bg-[var(--clr-brand2)] hover:bg-brand text-white text-[13px] font-medium px-4 py-2 rounded-lg disabled:opacity-60"
          >
            {generating && <Loader2 className="w-4 h-4 animate-spin" />}
            Generar examen
          </button>
        </div>
      )}

      {tab === "tomar" && (
        <div className="grid grid-cols-3 gap-3">
          <div className="card">
            <div className="text-[12px] font-medium mb-2">Exámenes disponibles</div>
            <div className="space-y-1.5">
              {exams.map((e) => (
                <button
                  key={e.id}
                  onClick={() => selectExam(e)}
                  className={`w-full text-left text-[11px] px-2.5 py-2 rounded-lg border ${
                    activeExam?.id === e.id
                      ? "border-[var(--clr-brand2)] bg-[#EEF3FF]"
                      : "border-[var(--border-tertiary)] hover:bg-[var(--bg-secondary)]"
                  }`}
                >
                  <div className="font-medium">{e.title}</div>
                  <div className="text-[var(--text-tertiary)]">{e.questions.length} preguntas</div>
                </button>
              ))}
              {exams.length === 0 && (
                <div className="text-[11px] text-[var(--text-tertiary)]">
                  Aún no hay exámenes generados.
                </div>
              )}
            </div>
          </div>

          <div className="col-span-2 space-y-2.5">
            {!activeExam && (
              <div className="card text-[12px] text-[var(--text-tertiary)]">
                Selecciona un examen de la lista para comenzar.
              </div>
            )}
            {activeExam &&
              activeExam.questions.map((q, idx) => (
                <div key={q.id} className="card">
                  <div className="text-[13px] font-medium mb-2.5">
                    {idx + 1}. {q.questionText}
                  </div>
                  <div className="space-y-1">
                    {q.options.map((opt, oi) => (
                      <label
                        key={oi}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md cursor-pointer text-[12px] hover:bg-[var(--bg-secondary)] ${
                          answers[q.id] === oi ? "bg-[#EEF3FF]" : ""
                        }`}
                      >
                        <input
                          type="radio"
                          name={q.id}
                          checked={answers[q.id] === oi}
                          onChange={() => setAnswers((a) => ({ ...a, [q.id]: oi }))}
                        />
                        {opt}
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            {activeExam && (
              <button
                onClick={submitExam}
                disabled={submitting || Object.keys(answers).length < activeExam.questions.length}
                className="flex items-center gap-2 bg-[var(--clr-brand2)] hover:bg-brand text-white text-[13px] font-medium px-4 py-2 rounded-lg disabled:opacity-60"
              >
                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Entregar examen
              </button>
            )}
          </div>
        </div>
      )}

      {tab === "resultado" && (
        <div className="card">
          {!result ? (
            <div className="text-[12px] text-[var(--text-tertiary)]">
              Toma un examen para ver aquí tu resultado.
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <FileCheck className="w-5 h-5 text-[var(--clr-brand2)]" />
                <div className="text-[16px] font-medium">Puntaje: {result.score} / 100</div>
              </div>
              <div className="space-y-2">
                {result.detail.map((d, i) => (
                  <div
                    key={d.questionId}
                    className="flex items-start gap-2 text-[12px] p-2 rounded-lg bg-[var(--bg-secondary)]"
                  >
                    {d.isCorrect ? (
                      <CheckCircle2 className="w-4 h-4 text-[#22A05B] shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="w-4 h-4 text-[#C84040] shrink-0 mt-0.5" />
                    )}
                    <div>
                      <div>Pregunta {i + 1}</div>
                      {d.explanation && (
                        <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
                          {d.explanation}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
