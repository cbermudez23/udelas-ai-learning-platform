"use client";
import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, FileText, ChevronDown } from "lucide-react";

interface Submission {
  moodleUserId: number;
  userId: string | null;
  name: string;
  email: string | null;
  status: string;
  gradingStatus: string;
  submittedAt: string | null;
  fileNames: string[];
  hasText: boolean;
}

interface Suggestion {
  grade: number;
  feedback: string;
  strengths: string[];
  improvements: string[];
  excerpt: string;
}

export default function GradingAssistant({ assignments }: { assignments: { id: string; name: string }[] }) {
  const [assignmentId, setAssignmentId] = useState("");
  const [loading, setLoading] = useState(false);
  const [submissions, setSubmissions] = useState<Submission[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rubricText, setRubricText] = useState("");
  const [selected, setSelected] = useState<Submission | null>(null);
  const [suggesting, setSuggesting] = useState(false);
  const [suggestion, setSuggestion] = useState<Suggestion | null>(null);
  const [editGrade, setEditGrade] = useState(0);
  const [editFeedback, setEditFeedback] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  async function loadAssignment(id: string) {
    setAssignmentId(id);
    setSubmissions(null);
    setSelected(null);
    setSuggestion(null);
    setError(null);
    if (!id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/assignments/${id}/submissions`);
      const d = await res.json();
      if (!res.ok) setError(d.error || "Error al cargar entregas");
      else setSubmissions(d.submissions);
    } catch (e: any) { setError(e.message); } finally { setLoading(false); }
  }

  async function suggest(sub: Submission) {
    setSelected(sub); setSuggestion(null); setError(null); setSuggesting(true);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/suggest-grade`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodleUserId: sub.moodleUserId, rubricText: rubricText.trim() || undefined })
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || "Error al generar sugerencia");
      else { setSuggestion(d.suggestion); setEditGrade(d.suggestion.grade); setEditFeedback(d.suggestion.feedback); }
    } catch (e: any) { setError(e.message); } finally { setSuggesting(false); }
  }

  async function saveToMoodle() {
    if (!selected) return;
    setSaving(true); setError(null);
    try {
      const res = await fetch(`/api/assignments/${assignmentId}/save-grade`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ moodleUserId: selected.moodleUserId, grade: editGrade, feedback: editFeedback })
      });
      const d = await res.json();
      if (!res.ok) setError(d.error || "Error al guardar en Moodle");
      else {
        setSavedIds((s) => new Set(s).add(selected.moodleUserId));
        setSubmissions((list) => list?.map((s) => s.moodleUserId === selected.moodleUserId ? { ...s, gradingStatus: "graded" } : s) ?? null);
      }
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  const input = "text-[11px] border border-[var(--border-tertiary)] rounded-md px-2.5 py-1.5 bg-white w-full";

  return (
    <div className="card">
      <div className="flex items-center gap-2 text-[12px] font-medium mb-2">
        <Sparkles className="w-4 h-4 text-[var(--clr-brand2)]" /> Calificación asistida por IA
      </div>
      <div className="text-[11px] text-[var(--text-secondary)] mb-3">
        La IA lee el archivo que entregó el estudiante y sugiere una nota y retroalimentación. Revisa y edita antes de guardar — la calificación final se escribe directamente en Moodle.
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
        <div>
          <label className="block text-[11px] font-medium mb-1">Tarea</label>
          <select value={assignmentId} onChange={(e) => loadAssignment(e.target.value)} className={input}>
            <option value="">Selecciona una tarea…</option>
            {assignments.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-medium mb-1">Rúbrica (opcional — pega la generada por el Agente)</label>
          <input value={rubricText} onChange={(e) => setRubricText(e.target.value)} placeholder="Criterios de evaluación…" className={input} />
        </div>
      </div>

      {error && <div className="text-[11px] text-[#B91C1C] mb-2">{error}</div>}
      {loading && <div className="text-[11px] text-[var(--text-tertiary)] inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cargando entregas desde Moodle…</div>}

      {submissions && submissions.length === 0 && (
        <div className="text-[11px] text-[var(--text-tertiary)]">Aún no hay entregas para esta tarea en Moodle.</div>
      )}

      {submissions && submissions.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            {submissions.map((s) => (
              <button
                key={s.moodleUserId}
                onClick={() => s.hasText && suggest(s)}
                disabled={!s.hasText}
                className={`w-full text-left px-2.5 py-2 rounded-lg border text-[11px] ${
                  selected?.moodleUserId === s.moodleUserId ? "border-[var(--clr-brand2)] bg-[#EEF3FF]" : "border-[var(--border-tertiary)] hover:bg-[var(--bg-secondary)]"
                } ${!s.hasText ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate">{s.name}</span>
                  {(savedIds.has(s.moodleUserId) || s.gradingStatus === "graded") && <span className="shrink-0 text-[10px] text-[#166534] inline-flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> Calificado</span>}
                </div>
                <div className="text-[10px] text-[var(--text-tertiary)] truncate">
                  {s.fileNames.length > 0 ? <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" />{s.fileNames.join(", ")}</span> : s.hasText ? "Texto en línea" : "Sin archivo legible"}
                  {s.submittedAt && ` · ${new Date(s.submittedAt).toLocaleDateString("es-PA")}`}
                </div>
              </button>
            ))}
          </div>

          <div>
            {!selected && <div className="card text-[11px] text-[var(--text-tertiary)]">Elige un estudiante para generar la sugerencia.</div>}
            {suggesting && <div className="card text-[11px] text-[var(--text-tertiary)] inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Leyendo la entrega y generando sugerencia…</div>}
            {selected && suggestion && !suggesting && (
              <div className="card space-y-2.5">
                <div className="text-[11px] font-medium">{selected.name}</div>
                <details className="text-[10px] text-[var(--text-tertiary)]">
                  <summary className="cursor-pointer inline-flex items-center gap-1"><ChevronDown className="w-3 h-3" /> Fragmento leído por la IA (verifica que sea correcto)</summary>
                  <div className="mt-1 p-2 bg-[var(--bg-secondary)] rounded whitespace-pre-wrap">{suggestion.excerpt}…</div>
                </details>

                <div>
                  <label className="block text-[11px] font-medium mb-1">Nota (0-100)</label>
                  <input type="number" min={0} max={100} value={editGrade} onChange={(e) => setEditGrade(Number(e.target.value))} className={input + " max-w-[100px]"} />
                </div>
                <div>
                  <label className="block text-[11px] font-medium mb-1">Retroalimentación para el estudiante</label>
                  <textarea value={editFeedback} onChange={(e) => setEditFeedback(e.target.value)} rows={3} className={input} />
                </div>
                {suggestion.strengths.length > 0 && (
                  <div className="text-[11px]"><span className="font-medium text-[#166534]">Fortalezas: </span>{suggestion.strengths.join("; ")}</div>
                )}
                {suggestion.improvements.length > 0 && (
                  <div className="text-[11px]"><span className="font-medium text-[#B45309]">A mejorar: </span>{suggestion.improvements.join("; ")}</div>
                )}
                <button
                  onClick={saveToMoodle}
                  disabled={saving}
                  className="w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg bg-[var(--clr-brand2)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  {saving ? "Guardando en Moodle…" : "Guardar calificación en Moodle"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
