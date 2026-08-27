import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Calendar as CalendarIcon } from "lucide-react";
import CalendarGrid from "@/components/CalendarGrid";

export default async function CalendarioPage() {
  const session = await getServerSession(authOptions);
  const events = await prisma.calendarEvent.findMany({
    where: { userId: session!.user.id },
    orderBy: { date: "asc" }
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[13px] font-medium">
        <CalendarIcon className="w-4 h-4 text-[var(--clr-brand2)]" /> Calendario
      </div>
      <CalendarGrid
        events={events.map((e) => ({
          id: e.id,
          title: e.title,
          detail: e.detail,
          date: e.date.toISOString(),
          colorTag: e.colorTag
        }))}
      />
    </div>
  );
}
