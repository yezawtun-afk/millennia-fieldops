"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import {
  SEVERITY_CHART_COLORS,
  SEVERITY_LABELS,
  STATUS_LABELS,
  TYPE_CHART_COLORS,
  TYPE_LABELS,
} from "@/lib/format";
import type { HazardSeverity, RecordStatus, RecordType } from "@/lib/types";

const STATUS_COLORS: Record<RecordStatus, string> = {
  pending: "#f59e0b",
  approved: "#16a34a",
  rejected: "#dc2626",
};

export function DashboardCharts({
  byType,
  byStatus,
  bySeverity,
}: {
  byType: Record<RecordType, number>;
  byStatus: Record<RecordStatus, number>;
  bySeverity: Record<string, number>;
}) {
  const typeData = (Object.keys(byType) as RecordType[]).map((key) => ({
    name: TYPE_LABELS[key],
    value: byType[key],
    color: TYPE_CHART_COLORS[key],
  }));

  const statusData = (Object.keys(byStatus) as RecordStatus[]).map((key) => ({
    name: STATUS_LABELS[key],
    value: byStatus[key],
    color: STATUS_COLORS[key],
  }));

  const severityData = (["low", "medium", "high", "critical", "unrated"] as const)
    .map((key) => ({
      name: key === "unrated" ? "Unrated" : SEVERITY_LABELS[key as HazardSeverity],
      value: bySeverity[key] ?? 0,
      color: key === "unrated" ? "#94a3b8" : SEVERITY_CHART_COLORS[key as HazardSeverity],
    }))
    .filter((d) => d.value > 0);

  return (
    <>
      <ChartCard title="Records by type">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={typeData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip cursor={{ fill: "rgba(15,46,34,0.05)" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {typeData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Hazard severity">
        {severityData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-muted">
            No hazards recorded yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={severityData}
                dataKey="value"
                nameKey="name"
                innerRadius="55%"
                outerRadius="80%"
                paddingAngle={2}
              >
                {severityData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </ChartCard>

      <ChartCard title="Review status">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={statusData} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
            <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
            <Tooltip cursor={{ fill: "rgba(15,46,34,0.05)" }} />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {statusData.map((d) => (
                <Cell key={d.name} fill={d.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>
    </>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">{title}</h2>
      <div style={{ height: 220 }}>{children}</div>
    </div>
  );
}
