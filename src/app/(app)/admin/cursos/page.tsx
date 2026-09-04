import { prisma } from "@/lib/prisma";
import CoursesTable from "@/components/admin/CoursesTable";

export const dynamic = "force-dynamic";

export default async function AdminCursos() {
  const courses = await prisma.course.findMany({
    orderBy: [{ source: "desc" }, { name: "asc" }],
    include: { _count: { select: { enrollments: true, contents: true, assignments: true } } }
  });
  const rows = courses.map((c) => ({
    id: c.id, name: c.name, shortName: c.shortName, category: c.category, professorName: c.professorName,
    source: c.source, moodleUrl: c.moodleUrl, lastSyncedAt: c.lastSyncedAt?.toISOString() || null,
    enrollments: c._count.enrollments, contents: c._count.contents, assignments: c._count.assignments
  }));
  return <CoursesTable courses={rows} />;
}
