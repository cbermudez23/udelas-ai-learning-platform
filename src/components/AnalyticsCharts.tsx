"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  Legend
} from "recharts";

interface CourseProgress {
  name: string;
  progress: number;
}
interface GradeAvg {
  name: string;
  promedio: number;
}
interface AgentUsage {
  name: string;
  value: number;
}

const PIE_COLORS = ["#0055AA", "#E8A020", "#22A05B", "#5530A0", "#A03030", "#8A5A10"];

export default function AnalyticsCharts({
  courseProgress,
  gradeAverages,
  agentUsage
}: {
  courseProgress: CourseProgress[];
  gradeAverages: GradeAvg[];
  agentUsage: AgentUsage[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="card">
        <div className="text-[12px] font-medium mb-2">Progreso por curso (%)</div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={courseProgress}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="progress" fill="#0055AA" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="text-[12px] font-medium mb-2">Promedio de calificaciones</div>
        <div style={{ width: "100%", height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={gradeAverages}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={50} />
              <YAxis tick={{ fontSize: 10 }} domain={[0, 100]} />
              <Tooltip />
              <Bar dataKey="promedio" fill="#E8A020" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card col-span-2">
        <div className="text-[12px] font-medium mb-2">Uso del Tutor IA y Agentes docentes</div>
        <div style={{ width: "100%", height: 240 }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={agentUsage}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={{ fontSize: 11 }}
              >
                {agentUsage.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
