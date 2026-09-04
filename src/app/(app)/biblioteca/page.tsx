import { Library, ExternalLink, FileText, BookOpen, AlertCircle, Clock } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import LibrarySearch from "@/components/LibrarySearch";
import ReindexButton from "@/components/ReindexButton";

export const dynamic = "force-dynamic";

const TYPE_LABEL: Record<string, string> = { pdf: "PDF", docx: "Word", page: "Página", book: "Libro", texto: "Texto", reglamento: "Reglamento", libro: "Libro", articulo: "Artículo", guia: "Guía" };

export default async function BibliotecaPage() {
  const session = await getServerSession(authOptions);
  const isStaff = ["ADMIN", "PROFESSOR"].includes(session!.user.role);

  const where = session!.user.role === "ADMIN"
    ? {}
    : { OR: [{ courseId: null }, { course: { enrollments: { some: { userId: session!.user.id } } } }] };

  const docs = await prisma.libraryDocument.findMany({
    where,
    include: { course: { select: { id: true, name: true } }, _count: { select: { chunks: true } } },
    orderBy: [{ courseId: "asc" }, { title: "asc" }]
  });

  const groups = new Map<string, { name: string; docs: typeof docs }>();
  for (const d of docs) {
    const key = d.course?.id || "__inst__";
    if (!groups.has(key)) groups.set(key, { name: d.course?.name || "Documentos institucionales", docs: [] });
    groups.get(key)!.docs.push(d);
  }
  const pending = docs.filter((d) => d.status === "pending").length;
  const errors = docs.filter((d) => d.status === "error").length;
  const indexed = docs.filter((d) => d.status === "indexed").length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-medium">
          <Library className="w-4 h-4 text-[var(--clr-brand2)]" /> Biblioteca IA
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[var(--text-tertiary)]">{indexed} documento(s) listos{pending ? ` · ${pending} pendiente(s)` : ""}{errors ? ` · ${errors} con error` : ""}</span>
          {isStaff && (pending > 0 || errors > 0) && <ReindexButton retryErrors={errors > 0} />}
        </div>
      </div>

      <LibrarySearch />

      {groups.size === 0 && (
        <div className="card text-[11px] text-[var(--text-tertiary)]">
          Aún no hay materiales. Los archivos (PDF, Word, texto), páginas y libros que los docentes suban a Moodle aparecerán aquí automáticamente tras la sincronización.
        </div>
      )}

      {[...groups.values()].map((g) => (
        <div key={g.name} className="card">
          <div className="text-[12px] font-semibold mb-2 flex items-center gap-2"><BookOpen className="w-3.5 h-3.5 text-[var(--clr-brand2)]" /> {g.name}</div>
          <ul className="space-y-1.5">
            {g.docs.map((d) => (
              <li key={d.id} className="flex items-start gap-2 text-[11px]">
                <FileText className="w-3.5 h-3.5 text-[var(--clr-brand2)] shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium">{d.title}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[#EEF3FF] text-[var(--clr-brand2)]">{TYPE_LABEL[d.type] || d.type}</span>
                    {d.status === "indexed" && <span className="text-[10px] text-[var(--text-tertiary)]">{d._count.chunks} fragmento(s)</span>}
                    {d.status === "pending" && <span className="text-[10px] text-[#B45309] inline-flex items-center gap-1"><Clock className="w-3 h-3" /> Pendiente de indexar</span>}
                    {d.status === "unsupported" && <span className="text-[10px] text-[var(--text-tertiary)] inline-flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Solo enlace (formato no indexable)</span>}
                    {d.status === "error" && <span className="text-[10px] text-[#B91C1C] inline-flex items-center gap-1" title={d.error || ""}><AlertCircle className="w-3 h-3" /> Error al indexar</span>}
                  </div>
                  {d.status === "indexed" && d.content && <div className="text-[10px] text-[var(--text-tertiary)] line-clamp-2 mt-0.5">{d.content.slice(0, 220)}</div>}
                  {d.status === "error" && d.error && <div className="text-[10px] text-[#B91C1C] mt-0.5">{d.error}</div>}
                </div>
                {d.moodleUrl && (
                  <a href={d.moodleUrl} target="_blank" rel="noreferrer" className="text-[10px] text-[var(--clr-brand2)] inline-flex items-center gap-1 shrink-0 hover:underline">
                    Moodle <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
