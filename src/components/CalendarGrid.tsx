"use client";

import { useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

export interface CalEvent {
  id: string;
  title: string;
  detail: string | null;
  date: string; // ISO
  colorTag: string;
}

const COLOR_BG: Record<string, string> = {
  blue: "#EEF3FF",
  amber: "#FDF3E3",
  green: "#E4F5EC",
  red: "#FDEAEA"
};
const COLOR_DOT: Record<string, string> = {
  blue: "#0055AA",
  amber: "#E8A020",
  green: "#22A05B",
  red: "#C84040"
};

export default function CalendarGrid({ events }: { events: CalEvent[] }) {
  const today = new Date();
  const days = useMemo(() => {
    const start = startOfMonth(today);
    const end = endOfMonth(today);
    return eachDayOfInterval({ start, end });
  }, []);
  const leadingBlanks = getDay(startOfMonth(today));

  const eventsByDay = (d: Date) => events.filter((e) => isSameDay(new Date(e.date), d));

  return (
    <div className="grid grid-cols-4 gap-4">
      <div className="col-span-3 card">
        <div className="text-[13px] font-medium mb-3 capitalize">
          {format(today, "MMMM yyyy", { locale: es })}
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] text-[var(--text-tertiary)] mb-1">
          {["D", "L", "M", "M", "J", "V", "S"].map((d, i) => (
            <div key={i}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`b${i}`} />
          ))}
          {days.map((d) => {
            const dayEvents = eventsByDay(d);
            const isToday = isSameDay(d, today);
            return (
              <div
                key={d.toISOString()}
                className="aspect-square rounded-md p-1 text-[11px] flex flex-col items-center justify-start gap-0.5"
                style={{
                  background: isToday
                    ? "var(--clr-brand2)"
                    : dayEvents[0]
                    ? COLOR_BG[dayEvents[0].colorTag]
                    : "transparent",
                  color: isToday ? "#fff" : "inherit",
                  fontWeight: isToday || dayEvents.length ? 500 : 400
                }}
                title={dayEvents.map((e) => e.title).join(", ")}
              >
                <span>{format(d, "d")}</span>
                {dayEvents.length > 0 && !isToday && (
                  <div className="flex gap-0.5">
                    {dayEvents.slice(0, 3).map((e) => (
                      <span
                        key={e.id}
                        className="w-1 h-1 rounded-full"
                        style={{ background: COLOR_DOT[e.colorTag] }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="text-[13px] font-medium mb-3">Próximas actividades</div>
        <div className="space-y-2">
          {events
            .filter((e) => new Date(e.date) >= new Date(today.toDateString()))
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
            .slice(0, 6)
            .map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 p-1.5 rounded-md bg-[var(--bg-secondary)]"
              >
                <div
                  className="w-8 h-8 rounded-md flex flex-col items-center justify-center shrink-0"
                  style={{ background: COLOR_BG[e.colorTag] }}
                >
                  <div className="text-[12px] font-medium" style={{ color: COLOR_DOT[e.colorTag] }}>
                    {format(new Date(e.date), "d")}
                  </div>
                  <div className="text-[7px]" style={{ color: COLOR_DOT[e.colorTag] }}>
                    {format(new Date(e.date), "MMM", { locale: es }).toUpperCase()}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] font-medium">{e.title}</div>
                  {e.detail && (
                    <div className="text-[10px] text-[var(--text-tertiary)]">{e.detail}</div>
                  )}
                </div>
              </div>
            ))}
          {events.length === 0 && (
            <div className="text-[11px] text-[var(--text-tertiary)]">
              No hay actividades registradas.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
