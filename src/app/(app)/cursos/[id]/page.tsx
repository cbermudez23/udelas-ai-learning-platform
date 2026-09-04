import Link from "next/link";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ArrowLeft, ExternalLink, FileText, Link2, MessageSquare, ClipboardList, HelpCircle, Folder, BookOpen, Video, File } from "lucide-react";

export const dynamic = "force-dynamic";

const MOD_LABEL: Record<string, string> = {
  resource: "Archivo",
  page: "Página",
  url: "Enlace",
  forum: "Foro",
  assign: "Tarea",
  quiz: "Cuestionario",
  folder: "Carpeta",
  book: "Libro",
  label: "Nota",
  lesson: "Lección",
  h5pactivity: "H5P",
  glossary: "Glosario",
  wiki: "Wiki",
  choice: "Consulta",
  feedback: "Encuesta",
  scorm: "SCORM",
  lti: "Herramienta externa",
  bigbluebuttonbn: "Videoconferencia"
};

function ModIcon({ mod }: { mod: string }) {
  const cls = "w-3.5 h-3.5 text-[var(--clr-brand2)] shrink-0";
  switch (mod) {
    case "url": return <Link2 className={cls} />;
    case "forum": return <MessageSquare className={cls} />;
    case "assign": return <ClipboardList className={cls} />;
    case "quiz": return <HelpCircle className={cls} />;
    case "folder": return <Folder className={cls} />;
    case "book": case "page": return <BookOpen className={cls} />;
    case "bigbluebuttonbn": return <Video className={cls} />;
    case "resource": return <File className={cls} />;
    default: return <FileText className={cls} />;
  }
}

export default async function CursoDetallePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  const enrollment = await prisma.enrollment.findUnique({
    where: { userId_courseId: { userId: session!.user.id, courseId: params.id } },
    include: {
      course: {
        include: {
          contents: { orderBy: [{ sectionOrder: "asc" }, { order: "asc" }] },
          assignments: { orderBy: { dueDate: "asc" } }
        }
      },
      grades: { orderBy: { createdAt: "asc" } }
    }
  });
  if (!enrollment) notFound();

  const { course } = enrollment;
  const now = new Date();

  // Agrupar contenidos por sección (respetando el orden de Moodle)
  const sections: { order: number; name: string; items: typeof course.contents }[] = [];
  for (const c of course.contents) {
    let s = sections.find((x) => x.order === c.sectionOrder);
    if (!s) { s = { order: c.sectionOrder, name: c.sectionName, items: [] }; sections.push(s); }
    s.items.push(c);
  }

  return (
    <div className="space-y-4">
      <Link href="/cursos" className="inline-flex items-center gap-1 text-[11px] text-[var(--text-tertiary)] hover:text-[var(--clr-brand2)]">
        <ArrowLeft className="w-3.5 h-3.5" /> Mis cursos
      </Link>

      <div className="card">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-[10px] font-medium text-[var(--clr-brand2)] bg-[#EEF3FF] inline-block px-2 py-0.5 rounded-full mb-1">
              {course.category}
            </div>
            <h1 className="text-[15px] font-semibold">{course.name}</h1>
            <div className="text-[11px] text-[var(--text-tertiary)] mt-0.5">
              {course.professorName}
              {course.shortName ? ` · ${course.shortName}` : ""}
              {enrollment.roleInCourse === "teacher" ? " · Eres docente de este curso" : ""}
            </div>
            {course.summary && <p className="text-[11px] mt-2 text-[var(--text-secondary)]">{course.summary}</p>}
          </div>
          {course.moodleUrl && (
            <a
              href={course.moodleUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1.5 rounded-md bg-[var(--clr-brand2)] text-white hover:opacity-90 shrink-0"
            >
              Abrir en Moodle <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </div>
        <div className="mt-3">
          <div className="flex justify-between text-[11px] mb-1">
            <span>Progreso</span>
            <span className="font-medium">{enrollment.progressPercent}%</span>
          </div>
          <div className="prog-bar">
            <div className="prog-fill" style={{ width: `${enrollment.progressPercent}%` }} />
          </div>
        </div>
        {course.lastSyncedAt && (
          <div className="text-[10px] text-[var(--text-tertiary)] mt-2">
            Sincronizado desde Moodle: {course.lastSyncedAt.toLocaleString("es-PA")}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2 space-y-3">
          <div className="text-[13px] font-medium">Contenidos del curso</div>
          {sections.length === 0 && (
            <div className="card text-[11px] text-[var(--text-tertiary)]">Este curso aún no tiene contenidos sincronizados.</div>
          )}
          {sections.map((s) => (
            <div key={s.order} className="card">
              <div className="text-[12px] font-semibold mb-2">{s.name}</div>
              <ul className="space-y-1.5">
                {s.items.map((c) =>
                  c.modName === "label" ? (
                    <li key={c.id} className="text-[11px] text-[var(--text-secondary)] pl-5">{c.description || c.name}</li>
                  ) : (
                    <li key={c.id} className="flex items-start gap-2 text-[11px]">
                      <ModIcon mod={c.modName} />
                      <div className="min-w-0">
                        {c.url ? (
                          <a href={c.url} target="_blank" rel="noreferrer" className="font-medium hover:text-[var(--clr-brand2)]">
                            {c.name}
                          </a>
                        ) : (
                          <span className="font-medium">{c.name}</span>
                        )}
                        <span className="text-[var(--text-tertiary)]"> · {MOD_LABEL[c.modName] || c.modName}</span>
                        {c.description && <div className="text-[10px] text-[var(--text-tertiary)] line-clamp-2">{c.description}</div>}
                      </div>
                    </li>
                  )
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="space-y-3">
          <div className="text-[13px] font-medium">Tareas</div>
          <div className="card space-y-2">
            {course.assignments.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)]">Sin tareas.</div>}
            {course.assignments.map((a) => {
              const late = a.dueDate && a.dueDate < now;
              return (
                <div key={a.id} className="text-[11px]">
                  {a.url ? (
                    <a href={a.url} target="_blank" rel="noreferrer" className="font-medium hover:text-[var(--clr-brand2)]">{a.name}</a>
                  ) : (
                    <span className="font-medium">{a.name}</span>
                  )}
                  <div className={`text-[10px] ${late ? "text-[#B91C1C]" : "text-[var(--text-tertiary)]"}`}>
                    {a.dueDate ? `Entrega: ${a.dueDate.toLocaleString("es-PA", { dateStyle: "medium", timeStyle: "short" })}` : "Sin fecha de entrega"}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="text-[13px] font-medium">Calificaciones</div>
          <div className="card space-y-1.5">
            {enrollment.grades.length === 0 && <div className="text-[11px] text-[var(--text-tertiary)]">Sin notas aún.</div>}
            {enrollment.grades.map((g) => (
              <div key={g.id} className="flex justify-between text-[11px]">
                <span className={g.label === "Total del curso" ? "font-semibold" : ""}>{g.label}</span>
                <span className="font-medium">
                  {g.maxScore ? `${g.rawScore}/${g.maxScore}` : g.score}
                  <span className="text-[var(--text-tertiary)] font-normal"> ({g.score}%)</span>
                </span>
              </div>
            ))}
          </div>

          <Link href="/tutor" className="card block text-[11px] hover:shadow-md transition-shadow">
            <div className="font-medium text-[var(--clr-brand2)]">✨ Preguntar al Tutor IA sobre este curso</div>
            <div className="text-[10px] text-[var(--text-tertiary)] mt-0.5">El tutor ya conoce tus contenidos, tareas y notas.</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
