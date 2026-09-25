// src/app/(app)/admin/importar-curso/page.tsx
// Página admin: Importar curso desde documento (DOCX / PDF / TXT)
// Flujo: Subir archivo → IA analiza → Vista previa editable → Crear en Moodle

"use client";

import { useState, useRef } from "react";
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, ExternalLink, ChevronDown, ChevronRight, Trash2, Plus } from "lucide-react";
import type { CourseStructure, CourseSection, CourseActivity } from "@/app/api/courses/import/route";
import type { BuildResult } from "@/app/api/courses/build/route";

// ─── Tipos de estado ──────────────────────────────────────────────────────────
type Step = "upload" | "analyzing" | "preview" | "building" | "done" | "error";

// ─── Componente principal ─────────────────────────────────────────────────────
export default function ImportarCursoPage() {
  const [step, setStep]       = useState<Step>("upload");
  const [file, setFile]       = useState<File | null>(null);
  const [structure, setStructure] = useState<CourseStructure | null>(null);
  const [buildResult, setBuildResult] = useState<BuildResult | null>(null);
  const [errorMsg, setErrorMsg]       = useState("");
  const [categoryId, setCategoryId]   = useState(1);
  const [startDate, setStartDate]     = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7)); // próximo lunes
    return d.toISOString().split("T")[0];
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0, 1, 2, 3]));

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f) setFile(f);
  }

  async function handleAnalyze() {
    if (!file) return;
    setStep("analyzing");
    setErrorMsg("");

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/api/courses/import", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? "Error al analizar el documento");
        setStep("error");
        return;
      }
      setStructure(data.structure as CourseStructure);
      setStep("preview");
    } catch {
      setErrorMsg("Error de red. Verifica tu conexión.");
      setStep("error");
    }
  }

  async function handleBuild() {
    if (!structure) return;
    setStep("building");

    try {
      const res = await fetch("/api/courses/build", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ structure, categoryId, startDate }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? "Error al crear el curso en Moodle");
        setStep("error");
        return;
      }
      setBuildResult(data as BuildResult);
      setStep("done");
    } catch {
      setErrorMsg("Error de red al crear el curso en Moodle.");
      setStep("error");
    }
  }

  function updateSection(idx: number, patch: Partial<CourseSection>) {
    if (!structure) return;
    const sections = [...structure.sections];
    sections[idx] = { ...sections[idx], ...patch };
    setStructure({ ...structure, sections });
  }

  function updateActivity(sIdx: number, aIdx: number, patch: Partial<CourseActivity>) {
    if (!structure) return;
    const sections = [...structure.sections];
    const activities = [...sections[sIdx].activities];
    activities[aIdx] = { ...activities[aIdx], ...patch };
    sections[sIdx] = { ...sections[sIdx], activities };
    setStructure({ ...structure, sections });
  }

  function removeActivity(sIdx: number, aIdx: number) {
    if (!structure) return;
    const sections = [...structure.sections];
    sections[sIdx].activities = sections[sIdx].activities.filter((_, i) => i !== aIdx);
    setStructure({ ...structure, sections });
  }

  function toggleSection(idx: number) {
    setExpandedSections(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  // ─── ICONOS POR TIPO DE ACTIVIDAD ─────────────────────────────────────────
  const ACTIVITY_ICONS: Record<string, string> = {
    page:   "📄",
    forum:  "💬",
    quiz:   "✍️",
    assign: "📝",
    label:  "🏷️",
    url:    "🔗",
    folder: "📁",
  };

  const ACTIVITY_LABELS: Record<string, string> = {
    page:   "Página",
    forum:  "Foro",
    quiz:   "Cuestionario",
    assign: "Tarea",
    label:  "Etiqueta",
    url:    "URL",
    folder: "Carpeta",
  };

  // ─── RENDER ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          📄 Importar Curso desde Documento
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Sube un documento (DOCX, PDF o TXT) con la propuesta del curso.
          La IA analizará la estructura y creará el curso completo en Moodle automáticamente.
        </p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2 text-xs font-medium">
        {[
          { key: "upload",   label: "1. Subir" },
          { key: "preview",  label: "2. Revisar" },
          { key: "done",     label: "3. Crear" },
        ].map(({ key, label }, i) => {
          const active =
            (key === "upload"  && ["upload","analyzing"].includes(step)) ||
            (key === "preview" && step === "preview") ||
            (key === "done"    && ["building","done"].includes(step));
          const done =
            (key === "upload"  && !["upload","analyzing"].includes(step)) ||
            (key === "preview" && ["building","done"].includes(step));

          return (
            <div key={key} className="flex items-center gap-2">
              {i > 0 && <div className="w-8 h-px bg-gray-300 dark:bg-gray-600" />}
              <span className={`px-3 py-1 rounded-full ${
                done   ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" :
                active ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
                         "bg-gray-100 text-gray-400 dark:bg-gray-800"
              }`}>
                {done ? "✓ " : ""}{label}
              </span>
            </div>
          );
        })}
      </div>

      {/* ── PASO 1: UPLOAD ─────────────────────────────────────────────────── */}
      {(step === "upload" || step === "analyzing") && (
        <div className="space-y-4">
          <div
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors
              ${file ? "border-blue-400 bg-blue-50 dark:bg-blue-950/20" : "border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/10"}`}
            onDragOver={e => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".docx,.pdf,.txt,.md"
              onChange={e => e.target.files?.[0] && setFile(e.target.files[0])}
            />
            {file ? (
              <div className="flex flex-col items-center gap-2">
                <FileText className="w-10 h-10 text-blue-500" />
                <p className="font-medium text-blue-700 dark:text-blue-300">{file.name}</p>
                <p className="text-xs text-gray-500">{(file.size / 1024).toFixed(0)} KB — clic para cambiar</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400">
                <Upload className="w-10 h-10" />
                <p className="font-medium">Arrastra tu archivo aquí o haz clic para seleccionar</p>
                <p className="text-xs">DOCX, PDF o TXT — máximo 10 MB</p>
              </div>
            )}
          </div>

          {/* Configuración inicial */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Categoría en Moodle (ID numérico)
              </label>
              <input
                type="number"
                min={1}
                value={categoryId}
                onChange={e => setCategoryId(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Fecha de inicio del curso
              </label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
              />
            </div>
          </div>

          <button
            onClick={handleAnalyze}
            disabled={!file || step === "analyzing"}
            className="w-full py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition"
          >
            {step === "analyzing" ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Analizando con IA…</>
            ) : (
              <><FileText className="w-4 h-4" /> Analizar documento</>
            )}
          </button>
        </div>
      )}

      {/* ── PASO 2: VISTA PREVIA EDITABLE ──────────────────────────────────── */}
      {step === "preview" && structure && (
        <div className="space-y-4">
          {/* Datos generales */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5 space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Datos generales del curso</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-gray-500">Nombre completo</label>
                <input
                  value={structure.fullname}
                  onChange={e => setStructure({ ...structure, fullname: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Nombre corto (shortname)</label>
                <input
                  value={structure.shortname}
                  onChange={e => setStructure({ ...structure, shortname: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 font-mono bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Duración (semanas)</label>
                <input
                  type="number"
                  value={structure.durationWeeks}
                  onChange={e => setStructure({ ...structure, durationWeeks: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">Total de horas</label>
                <input
                  type="number"
                  value={structure.totalHours}
                  onChange={e => setStructure({ ...structure, totalHours: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2 text-sm mt-1 bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600"
                />
              </div>
            </div>
          </div>

          {/* Secciones */}
          <div className="space-y-2">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Estructura del curso — {structure.sections.length} bloques
            </h2>

            {structure.sections.map((section, sIdx) => (
              <div
                key={sIdx}
                className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden"
              >
                {/* Header de sección */}
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800"
                  onClick={() => toggleSection(sIdx)}
                >
                  {expandedSections.has(sIdx)
                    ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
                  <input
                    value={section.name}
                    onClick={e => e.stopPropagation()}
                    onChange={e => updateSection(sIdx, { name: e.target.value })}
                    className="flex-1 text-sm font-medium bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none text-gray-900 dark:text-white"
                  />
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {section.activities.length} actividades
                  </span>
                </div>

                {/* Actividades */}
                {expandedSections.has(sIdx) && (
                  <div className="border-t border-gray-100 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-700">
                    {section.activities.map((act, aIdx) => (
                      <div key={aIdx} className="flex items-center gap-3 px-4 py-2">
                        <span className="text-base flex-shrink-0" title={ACTIVITY_LABELS[act.type]}>
                          {ACTIVITY_ICONS[act.type] ?? "📌"}
                        </span>
                        <div className="flex-1 min-w-0">
                          <input
                            value={act.name}
                            onChange={e => updateActivity(sIdx, aIdx, { name: e.target.value })}
                            className="w-full text-sm bg-transparent border-b border-transparent focus:border-blue-400 focus:outline-none text-gray-800 dark:text-gray-200"
                          />
                          <div className="flex items-center gap-3 mt-0.5">
                            <span className="text-xs text-gray-400 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">
                              {ACTIVITY_LABELS[act.type]}
                            </span>
                            {act.grade != null && (
                              <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                                {act.grade} pts
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => removeActivity(sIdx, aIdx)}
                          className="text-gray-300 hover:text-red-400 transition flex-shrink-0"
                          title="Eliminar actividad"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}

                    {/* Agregar actividad */}
                    <div className="px-4 py-2">
                      <button
                        onClick={() => updateSection(sIdx, {
                          activities: [...section.activities, {
                            type: "page", name: "Nueva actividad", intro: "", completionRequired: false
                          }]
                        })}
                        className="flex items-center gap-1 text-xs text-blue-500 hover:text-blue-700"
                      >
                        <Plus className="w-3 h-3" /> Agregar actividad
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Plan de evaluación */}
          {structure.evaluationPlan?.length > 0 && (
            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 dark:text-white mb-3">Plan de evaluación</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-200 dark:border-gray-700">
                    <th className="text-left pb-2">Actividad</th>
                    <th className="text-right pb-2 w-16">Peso</th>
                  </tr>
                </thead>
                <tbody>
                  {structure.evaluationPlan.map((ep, i) => (
                    <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                      <td className="py-1.5 text-gray-700 dark:text-gray-300">{ep.activity}</td>
                      <td className="py-1.5 text-right font-medium text-blue-600 dark:text-blue-400">
                        {ep.weight}%
                      </td>
                    </tr>
                  ))}
                  <tr className="text-sm font-semibold">
                    <td className="pt-2">Total</td>
                    <td className="pt-2 text-right">
                      {structure.evaluationPlan.reduce((s, e) => s + e.weight, 0)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          {/* Resumen */}
          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-4 text-sm text-blue-800 dark:text-blue-300">
            <p className="font-medium mb-1">Resumen de lo que se creará en Moodle:</p>
            <ul className="list-disc list-inside space-y-0.5 text-blue-700 dark:text-blue-400">
              <li>{structure.sections.length} secciones (bloques MAVU)</li>
              <li>{structure.sections.reduce((s, sec) => s + sec.activities.length, 0)} actividades en total</li>
              <li>Cuestionarios y enlaces (URL) se crean manualmente en Moodle después</li>
              <li>Inicio: {new Date(startDate).toLocaleDateString("es-PA", { dateStyle: "long" })}</li>
            </ul>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => { setStep("upload"); setStructure(null); }}
              className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              ← Volver
            </button>
            <button
              onClick={handleBuild}
              className="flex-[2] py-3 rounded-xl font-semibold bg-green-600 text-white hover:bg-green-700 flex items-center justify-center gap-2"
            >
              🚀 Crear curso en Moodle
            </button>
          </div>
        </div>
      )}

      {/* ── PASO 3: BUILDING ───────────────────────────────────────────────── */}
      {step === "building" && (
        <div className="text-center py-16 space-y-3">
          <Loader2 className="w-10 h-10 animate-spin text-blue-500 mx-auto" />
          <p className="text-gray-600 dark:text-gray-400 font-medium">Creando el curso en Moodle…</p>
          <p className="text-xs text-gray-400">Esto puede tomar unos segundos.</p>
        </div>
      )}

      {/* ── RESULTADO FINAL ─────────────────────────────────────────────────── */}
      {step === "done" && buildResult && (
        <div className="space-y-4">
          <div className={`rounded-xl p-5 border ${
            buildResult.errors.length === 0
              ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800"
              : "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800"
          }`}>
            <div className="flex items-center gap-3 mb-3">
              <CheckCircle2 className={`w-6 h-6 ${buildResult.errors.length === 0 ? "text-green-500" : "text-yellow-500"}`} />
              <h2 className={`font-semibold ${buildResult.errors.length === 0 ? "text-green-800 dark:text-green-300" : "text-yellow-800 dark:text-yellow-300"}`}>
                {buildResult.errors.length === 0 ? "¡Curso creado exitosamente!" : "Curso creado con algunas advertencias"}
              </h2>
            </div>
            <div className="text-sm space-y-1 text-gray-700 dark:text-gray-300">
              <p>✅ {buildResult.activitiesCreated} actividades creadas</p>
              {buildResult.errors.length > 0 && (
                <p>⚠️ {buildResult.errors.length} actividades con error (ver abajo)</p>
              )}
            </div>
          </div>

          {buildResult.errors.length > 0 && (
            <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-4 space-y-1">
              <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Errores:</p>
              {buildResult.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-600 dark:text-red-400 font-mono">{e}</p>
              ))}
            </div>
          )}

          <div className="flex gap-3">
            <a
              href={buildResult.courseUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-3 rounded-xl font-semibold bg-blue-600 text-white hover:bg-blue-700 flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" /> Ver curso en Moodle
            </a>
            <button
              onClick={() => { setStep("upload"); setFile(null); setStructure(null); setBuildResult(null); }}
              className="flex-1 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              Importar otro curso
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR ──────────────────────────────────────────────────────────── */}
      {step === "error" && (
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <p className="text-red-800 dark:text-red-300 font-medium">{errorMsg}</p>
          </div>
          <button
            onClick={() => setStep("upload")}
            className="py-2 px-4 rounded-lg border border-red-300 text-red-700 dark:text-red-400 text-sm hover:bg-red-100 dark:hover:bg-red-900/20"
          >
            ← Intentar de nuevo
          </button>
        </div>
      )}
    </div>
  );
}
