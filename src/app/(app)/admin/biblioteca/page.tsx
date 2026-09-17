import { prisma } from "@/lib/prisma";
import InstitutionalLibrary from "@/components/admin/InstitutionalLibrary";
import KnowledgeBaseIngestion from "@/components/admin/KnowledgeBaseIngestion";

export const dynamic = "force-dynamic";

export default async function AdminBiblioteca() {
  const docs = await prisma.libraryDocument.findMany({
    where: { courseId: null, moodleModuleId: null },
    include: { _count: { select: { chunks: true } } },
    orderBy: { createdAt: "desc" }
  });
  const rows = docs.map((d) => ({ id: d.id, title: d.title, type: d.type, tags: d.tags, fileName: d.moodleFileName, chunks: d._count.chunks, createdAt: d.createdAt.toISOString() }));
  const moodleCount = await prisma.libraryDocument.count({ where: { moodleModuleId: { not: null } } });
  return (
    <div className="space-y-3">
      <KnowledgeBaseIngestion />
      <InstitutionalLibrary docs={rows} moodleCount={moodleCount} />
    </div>
  );
}
