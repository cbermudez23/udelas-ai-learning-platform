"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface ExamAttemptPoint {
  label: string; // fecha corta, ej. "07/09"
  score: number;
  examTitle: string;
}

export default function ExamProgressChart({ attempts }: { attempts: ExamAttemptPoint[] }) {
  if (attempts.length < 2) {
    return (
      <div className="text-[11px] text-[var(--text-tertiary)]">
        Toma al menos dos exámenes IA para ver tu evolución en un gráfico.
      </div>
    );
  }
  return (
    <div style={{ width: "100%", height: 200 }}>
      <ResponsiveContainer>
        <LineChart data={attempts} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
          <XAxis dataKey="label" tick={{ fontSize: 10 }} />
          <YAxis domain={[0, 100]} tick={{ fontSize: 10 }} />
          <Tooltip
            formatter={(value: number) => [`${value}%`, "Calificación"]}
            labelFormatter={(_, payload) => payload?.[0]?.payload?.examTitle || ""}
            contentStyle={{ fontSize: 11, borderRadius: 8 }}
          />
          <Line type="monotone" dataKey="score" stroke="#0055AA" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
