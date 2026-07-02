import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin, getSummary, listManagedUsers, type SummaryRow } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin-summary")({
  head: () => ({ meta: [{ title: "Sammanställning – Admin" }] }),
  component: AdminSummaryPage,
});

function fmtHours(ms: number) { return (ms / 3600000).toFixed(2); }
function fmtKr(n: number) { return n.toLocaleString("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

function AdminSummaryPage() {
  const checkAdmin = useServerFn(isAdmin);
  const fetchSummary = useServerFn(getSummary);
  const fetchUsers = useServerFn(listManagedUsers);

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin({ data: undefined }) });

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));
  const [fromTime, setFromTime] = useState("00:00");
  const [toTime, setToTime] = useState("00:00");
  const [userId, setUserId] = useState<string>("all");
  const [clientId, setClientId] = useState<string>("all");
  const [projectId, setProjectId] = useState<string>("all");

  const usersQ = useQuery({
    queryKey: ["managed-users"],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: () => fetchUsers({ data: undefined }),
  });

  const clientsQ = useQuery({
    queryKey: ["clients"],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: async () => {
      const { data, error } = await (supabase.from("clients" as any) as any)
        .select("id, name").order("name");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const projectsQ = useQuery({
    queryKey: ["projects-admin"],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects").select("id, name, client_id").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as { id: string; name: string; client_id: string | null }[];
    },
  });

  const filteredProjects = useMemo(() => {
    const all = projectsQ.data ?? [];
    if (clientId === "all") return all;
    return all.filter((p) => p.client_id === clientId);
  }, [projectsQ.data, clientId]);

  const summaryQ = useQuery({
    queryKey: ["admin-summary", from, to, fromTime, toTime, userId, clientId, projectId],
    enabled: !!adminQ.data?.isAdmin && !!from && !!to,
    queryFn: () => fetchSummary({
      data: {
        from, to, fromTime, toTime,
        userId: userId === "all" ? null : userId,
        clientId: clientId === "all" ? null : clientId,
        projectId: projectId === "all" ? null : projectId,
      },
    }),
  });

  function exportCsv() {
    if (!summaryQ.data) return;
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push("Sektion,Etikett,Underetikett,Normal h,OB1 h,OB2 h,OB3 h,Totalt h,Lön kr,Debitering kr,Antal poster");
    // Note: kept CSV shape stable; new totals visible in UI.
    const dump = (section: string, rows: SummaryRow[]) => {
      for (const r of rows) {
        lines.push([
          esc(section),
          esc(r.label),
          esc(r.sublabel ?? ""),
          fmtHours(r.normalMs ?? 0),
          fmtHours(r.ob1Ms ?? 0),
          fmtHours(r.ob2Ms ?? 0),
          fmtHours(r.ob3Ms ?? 0),
          fmtHours(r.ms),
          (r.amount ?? 0).toFixed(2),
          (r.billing ?? 0).toFixed(2),
          String(r.count),
        ].join(","));
      }
    };
    dump("Kund", summaryQ.data.perClient);
    dump("Projekt", summaryQ.data.perProject);
    dump("Användare", summaryQ.data.perUser);
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const timeSuffix = (fromTime !== "00:00" || toTime !== "00:00") ? `_${fromTime}-${toTime}` : "";
    a.download = `sammanstallning-${from}_${to}${timeSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const totalMs = summaryQ.data?.totalMs ?? 0;
  const s = summaryQ.data;

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Sammanställning</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-6">
        {adminQ.isLoading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Laddar…</Card>
        ) : !adminQ.data?.isAdmin ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            Endast administratörer har åtkomst.
          </Card>
        ) : (
          <>
            <Card className="space-y-3 p-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs">Från</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Till</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Från kl</Label>
                  <Input type="time" value={fromTime} onChange={(e) => setFromTime(e.target.value || "00:00")} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Till kl</Label>
                  <Input type="time" value={toTime} onChange={(e) => setToTime(e.target.value || "00:00")} />
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Användare</Label>
                  <Select value={userId} onValueChange={setUserId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla användare</SelectItem>
                      {usersQ.data?.map((u) => (
                        <SelectItem key={u.user_id} value={u.user_id}>{u.email ?? u.user_id}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Kund</Label>
                  <Select value={clientId} onValueChange={(v) => { setClientId(v); setProjectId("all"); }}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla kunder</SelectItem>
                      {clientsQ.data?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Projekt</Label>
                  <Select value={projectId} onValueChange={setProjectId}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alla projekt</SelectItem>
                      {filteredProjects.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="text-sm">
                  Total tid:{" "}
                  <span className="font-mono font-semibold tabular-nums">{fmtHours(totalMs)} h</span>
                  {s && (
                    <span className="text-muted-foreground"> · {s.totalCount} poster</span>
                  )}
                </div>
                <Button onClick={exportCsv} variant="outline" size="sm" disabled={!summaryQ.data}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
              </div>
              {s && (
                <>
                  <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-4">
                    <Stat label="Normal" value={`${fmtHours(s.totalNormalMs)} h`} />
                    <Stat label="OB1" value={`${fmtHours(s.totalOb1Ms)} h`} />
                    <Stat label="OB2" value={`${fmtHours(s.totalOb2Ms)} h`} />
                    <Stat label="OB3" value={`${fmtHours(s.totalOb3Ms)} h`} />
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-md bg-muted/40 p-3 text-xs sm:grid-cols-4">
                    <Stat label="Bruttolön" value={`${fmtKr(s.totalAmount)} kr`} />
                    <Stat label="Netto (efter skatt)" value={`${fmtKr(s.totalNet)} kr`} />
                    <Stat label="Arbetsgivarkostnad" value={`${fmtKr(s.totalEmployerCost)} kr`} />
                    <Stat label="Debitering kund" value={`${fmtKr(s.totalBilling)} kr`} />
                  </div>
                </>
              )}
            </Card>

            <SummarySection title="Per kund" rows={summaryQ.data?.perClient ?? []} loading={summaryQ.isLoading} totalMs={totalMs} showBilling showEmployerCost />
            <SummarySection title="Per projekt" rows={summaryQ.data?.perProject ?? []} loading={summaryQ.isLoading} totalMs={totalMs} showSwatch showBilling showEmployerCost />
            <SummarySection title="Per användare" rows={summaryQ.data?.perUser ?? []} loading={summaryQ.isLoading} totalMs={totalMs} showAmount showEmployerCost showNet />
          </>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="font-mono text-sm font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function SummarySection({ title, rows, loading, totalMs, showSwatch, showAmount, showBilling }: {
  title: string; rows: SummaryRow[]; loading: boolean; totalMs: number; showSwatch?: boolean; showAmount?: boolean; showBilling?: boolean;
}) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-sm font-medium text-muted-foreground">{title}</h2>
      <Card className="divide-y p-0">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Laddar…</div>
        ) : rows.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Inga poster.</div>
        ) : (
          rows.map((r) => {
            const pct = totalMs > 0 ? (r.ms / totalMs) * 100 : 0;
            return (
              <div key={r.key} className="space-y-1 px-4 py-3">
                <div className="flex items-center gap-2">
                  {showSwatch && (
                    <div className="h-3 w-3 rounded-full" style={{ background: r.color ?? "var(--muted-foreground)" }} />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{r.label}</div>
                    {r.sublabel && <div className="text-xs text-muted-foreground">{r.sublabel}</div>}
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-sm font-semibold tabular-nums">{fmtHours(r.ms)} h</div>
                    <div className="text-xs text-muted-foreground">{pct.toFixed(1)}% · {r.count} poster</div>
                    {showAmount && r.amount !== undefined && (
                      <div className="text-xs font-medium text-foreground">Lön: {fmtKr(r.amount)} kr</div>
                    )}
                    {showBilling && r.billing !== undefined && r.billing > 0 && (
                      <div className="text-xs font-medium text-foreground">Debitering: {fmtKr(r.billing)} kr</div>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>Normal {fmtHours(r.normalMs ?? 0)} h</span>
                  <span>OB1 {fmtHours(r.ob1Ms ?? 0)} h</span>
                  <span>OB2 {fmtHours(r.ob2Ms ?? 0)} h</span>
                  <span>OB3 {fmtHours(r.ob3Ms ?? 0)} h</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })
        )}
      </Card>
    </section>
  );
}