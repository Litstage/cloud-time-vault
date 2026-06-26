import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { isAdmin, claimFirstAdmin, getAllTimeEntries, type AdminEntry } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin – Tidskoll" }] }),
  component: AdminPage,
});

function formatHours(ms: number) {
  return (ms / 3600000).toFixed(2);
}

function AdminPage() {
  const checkAdmin = useServerFn(isAdmin);
  const claim = useServerFn(claimFirstAdmin);
  const fetchAll = useServerFn(getAllTimeEntries);

  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
    .toISOString()
    .slice(0, 10);
  const [from, setFrom] = useState(firstOfMonth);
  const [to, setTo] = useState(today.toISOString().slice(0, 10));

  const adminQ = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin({ data: undefined }),
  });

  const entriesQ = useQuery({
    queryKey: ["admin-entries", from, to],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: () =>
      fetchAll({
        data: {
          from: new Date(`${from}T00:00:00`).toISOString(),
          to: new Date(
            new Date(`${to}T00:00:00`).getTime() + 24 * 3600 * 1000,
          ).toISOString(),
        },
      }),
  });

  const claimMut = useMutation({
    mutationFn: () => claim({ data: undefined }),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success("Du är nu admin");
        adminQ.refetch();
      } else {
        toast.error("Det finns redan en admin – be admin tilldela dig rollen");
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const rows = entriesQ.data ?? [];

  const totals = useMemo(() => {
    const perUser = new Map<string, { email: string | null; ms: number }>();
    let total = 0;
    for (const r of rows) {
      if (!r.end_time) continue;
      const ms = new Date(r.end_time).getTime() - new Date(r.start_time).getTime();
      total += ms;
      const prev = perUser.get(r.user_id);
      perUser.set(r.user_id, {
        email: r.user_email,
        ms: (prev?.ms ?? 0) + ms,
      });
    }
    return {
      total,
      perUser: Array.from(perUser.entries()).sort((a, b) => b[1].ms - a[1].ms),
    };
  }, [rows]);

  function exportCsv() {
    const header = ["Användare", "Datum", "Start", "Slut", "Timmar", "Projekt", "Beskrivning"];
    const lines = [header.join(",")];
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    for (const r of rows) {
      if (!r.end_time) continue;
      const start = new Date(r.start_time);
      const end = new Date(r.end_time);
      const hours = ((end.getTime() - start.getTime()) / 3600000).toFixed(2);
      lines.push(
        [
          esc(r.user_email ?? r.user_id),
          esc(start.toLocaleDateString("sv-SE")),
          esc(start.toLocaleTimeString("sv-SE")),
          esc(end.toLocaleTimeString("sv-SE")),
          hours,
          esc(r.project_name ?? ""),
          esc(r.description ?? ""),
        ].join(","),
      );
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tidskoll-admin-${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Admin</h1>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-6">
        {adminQ.isLoading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Laddar…</Card>
        ) : !adminQ.data?.isAdmin ? (
          <Card className="space-y-3 p-6 text-center">
            <ShieldCheck className="mx-auto h-8 w-8 text-muted-foreground" />
            <div className="text-sm text-muted-foreground">
              Du saknar adminbehörighet. Om ingen admin är satt än kan du göra dig själv till den
              första administratören.
            </div>
            <Button onClick={() => claimMut.mutate()} disabled={claimMut.isPending}>
              Bli första admin
            </Button>
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Från</Label>
                  <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Till</Label>
                  <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="text-sm">
                  Total tid:{" "}
                  <span className="font-mono font-semibold tabular-nums">
                    {formatHours(totals.total)} h
                  </span>
                </div>
                <Button onClick={exportCsv} variant="outline" size="sm" disabled={!rows.length}>
                  <Download className="mr-2 h-4 w-4" /> CSV
                </Button>
              </div>
            </Card>

            <section className="space-y-2">
              <h2 className="px-1 text-sm font-medium text-muted-foreground">Per användare</h2>
              <Card className="divide-y p-0">
                {totals.perUser.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    Inga poster i intervallet.
                  </div>
                ) : (
                  totals.perUser.map(([uid, v]) => (
                    <div key={uid} className="flex items-center justify-between px-4 py-3">
                      <div className="truncate text-sm">{v.email ?? uid}</div>
                      <div className="font-mono text-sm tabular-nums">{formatHours(v.ms)} h</div>
                    </div>
                  ))
                )}
              </Card>
            </section>

            <section className="space-y-2">
              <h2 className="px-1 text-sm font-medium text-muted-foreground">
                Alla poster ({rows.length})
              </h2>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Användare</th>
                      <th className="px-3 py-2">Datum</th>
                      <th className="px-3 py-2">Projekt</th>
                      <th className="px-3 py-2">Beskrivning</th>
                      <th className="px-3 py-2 text-right">Timmar</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rows.map((r) => {
                      const ms = r.end_time
                        ? new Date(r.end_time).getTime() - new Date(r.start_time).getTime()
                        : 0;
                      return (
                        <tr key={r.id}>
                          <td className="px-3 py-2 truncate max-w-[10rem]">{r.user_email ?? r.user_id}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {new Date(r.start_time).toLocaleDateString("sv-SE")}
                          </td>
                          <td className="px-3 py-2">
                            {r.project_color && (
                              <span style={{ color: r.project_color }}>● </span>
                            )}
                            {r.project_name ?? "—"}
                          </td>
                          <td className="px-3 py-2 truncate max-w-[14rem]">
                            {r.description ?? ""}
                          </td>
                          <td className="px-3 py-2 text-right font-mono tabular-nums">
                            {r.end_time ? formatHours(ms) : "–"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}