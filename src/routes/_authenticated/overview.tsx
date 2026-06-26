import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, ChevronRight, ArrowLeft } from "lucide-react";
import { ApprovalGate } from "@/components/approval-gate";

export const Route = createFileRoute("/_authenticated/overview")({
  head: () => ({ meta: [{ title: "Månadsöversikt – Tidskoll" }] }),
  component: () => (
    <ApprovalGate>
      <OverviewPage />
    </ApprovalGate>
  ),
});

type Entry = {
  id: string;
  start_time: string;
  end_time: string | null;
  project_id: string | null;
  projects?: { name: string; color: string } | null;
};

function formatHours(ms: number) {
  return (ms / 3600000).toFixed(2);
}

function OverviewPage() {
  const today = new Date();
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));

  const start = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth(), 1), [cursor]);
  const end = useMemo(() => new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1), [cursor]);

  const entriesQ = useQuery({
    queryKey: ["entries-month", start.toISOString()],
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("id, start_time, end_time, project_id, projects(name, color)")
        .gte("start_time", start.toISOString())
        .lt("start_time", end.toISOString())
        .not("end_time", "is", null)
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Entry[];
    },
  });

  const { perDay, perProject, total } = useMemo(() => {
    const perDay = new Map<string, number>();
    const perProject = new Map<string, { name: string; color: string; ms: number }>();
    let total = 0;
    for (const e of entriesQ.data ?? []) {
      if (!e.end_time) continue;
      const ms = new Date(e.end_time).getTime() - new Date(e.start_time).getTime();
      total += ms;
      const day = new Date(e.start_time).toISOString().slice(0, 10);
      perDay.set(day, (perDay.get(day) ?? 0) + ms);
      const key = e.project_id ?? "none";
      const name = e.projects?.name ?? "Inget projekt";
      const color = e.projects?.color ?? "#94a3b8";
      const prev = perProject.get(key);
      perProject.set(key, { name, color, ms: (prev?.ms ?? 0) + ms });
    }
    return { perDay, perProject, total };
  }, [entriesQ.data]);

  const daysInMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(cursor.getFullYear(), cursor.getMonth(), i + 1);
    const key = d.toISOString().slice(0, 10);
    return { date: d, key, ms: perDay.get(key) ?? 0 };
  });
  const maxMs = Math.max(1, ...days.map((d) => d.ms));
  const projectList = Array.from(perProject.values()).sort((a, b) => b.ms - a.ms);

  const monthLabel = cursor.toLocaleDateString("sv-SE", { month: "long", year: "numeric" });

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="icon">
              <Link to="/"><ArrowLeft className="h-5 w-5" /></Link>
            </Button>
            <h1 className="text-lg font-semibold tracking-tight">Månadsöversikt</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6">
        <Card className="flex items-center justify-between p-3">
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}>
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-sm font-medium capitalize">{monthLabel}</div>
          <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}>
            <ChevronRight className="h-5 w-5" />
          </Button>
        </Card>

        <Card className="p-5 text-center">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Total tid</div>
          <div className="mt-1 font-mono text-4xl font-semibold tabular-nums">{formatHours(total)} h</div>
        </Card>

        <section className="space-y-2">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">Per projekt</h2>
          <Card className="divide-y p-0">
            {projectList.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">Inga poster den här månaden.</div>
            ) : projectList.map((p) => (
              <div key={p.name} className="flex items-center gap-3 px-4 py-3">
                <div className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                <div className="flex-1 truncate text-sm font-medium">{p.name}</div>
                <div className="text-xs text-muted-foreground">{((p.ms / total) * 100 || 0).toFixed(0)}%</div>
                <div className="w-20 text-right font-mono text-sm tabular-nums">{formatHours(p.ms)} h</div>
              </div>
            ))}
          </Card>
        </section>

        <section className="space-y-2">
          <h2 className="px-1 text-sm font-medium text-muted-foreground">Per dag</h2>
          <Card className="divide-y p-0">
            {days.map((d) => {
              const weekday = d.date.toLocaleDateString("sv-SE", { weekday: "short" });
              const isToday = d.key === new Date().toISOString().slice(0, 10);
              return (
                <div key={d.key} className="flex items-center gap-3 px-4 py-2">
                  <div className="w-10 shrink-0 text-xs text-muted-foreground">
                    <span className={isToday ? "font-semibold text-foreground" : ""}>{d.date.getDate()}</span>
                    <span className="ml-1">{weekday}</span>
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(d.ms / maxMs) * 100}%` }}
                    />
                  </div>
                  <div className="w-16 text-right font-mono text-xs tabular-nums">
                    {d.ms ? `${formatHours(d.ms)} h` : "–"}
                  </div>
                </div>
              );
            })}
          </Card>
        </section>
      </main>
    </div>
  );
}