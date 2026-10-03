"use client";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ChartDatum } from "./types";

export default function ChartCanvas({ data }: { data: ChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgb(var(--line))" />
        <XAxis dataKey="label" tick={{ fontSize: 12, fill: "rgb(var(--ink-muted))" }} interval={0} stroke="rgb(var(--line))" />
        <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "rgb(var(--ink-muted))" }} stroke="rgb(var(--line))" />
        <Tooltip
          cursor={{ fill: "rgb(var(--primary-soft))" }}
          contentStyle={{ background: "rgb(var(--surface))", border: "1px solid rgb(var(--line))", borderRadius: 8, color: "rgb(var(--ink))" }}
          labelStyle={{ color: "rgb(var(--ink))" }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {data.map((d) => (
            <Cell key={d.key} fill={d.color} style={{ fill: d.color }} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
