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
import { Card } from "@/components/ui";
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
      color:
        key === "unrated" ? "#94a3b8" : SEVERITY_CHART_COLORS[key as HazardSeverity],
    }))
    .filter((d) => d.value > 0);

  return (
    <>
      <Card>
        <h2 className="mb-2 text-sm font-semibold text-ink">Records by type</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={typeData}>
              <XAxis dataKey="name" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} width={24} />
              <Tooltip cursor={{ fill: "#f1f5f4" }} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {typeData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-ink">Review status</h2>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={75} paddingAngle={2}>
                {statusData.map((d) => (
                  <Cell key={d.name} fill={d.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-ink">Hazards by severity</h2>
        <div className="h-56">
          {severityData.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted">
              No hazard records yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={severityData} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <YAxis type="category" dataKey="name" tickLine={false} axisLine={false} fontSize={12} width={64} />
                <Tooltip cursor={{ fill: "#f1f5f4" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]}>
                  {severityData.map((d) => (
                    <Cell key={d.name} fill={d.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>
    </>
  );
}
