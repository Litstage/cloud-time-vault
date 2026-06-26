import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Power } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/admin.functions";
import { WEEKDAY_LABELS_SV, type ObRule } from "@/lib/ob";

export const Route = createFileRoute("/_authenticated/admin-ob")({
  head: () => ({ meta: [{ title: "OB-regler – Admin" }] }),
  component: AdminObPage,
});

// Swedish week order (Mon..Sun) but JS getDay (0=Sun..6=Sat)
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];

function AdminObPage() {
  const checkAdmin = useServerFn(isAdmin);
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin({ data: undefined }) });
  const qc = useQueryClient();

  const rulesQ = useQuery({
    queryKey: ["ob-rules"],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: async (): Promise<ObRule[]> => {
      const { data, error } = await (supabase.from("ob_rules" as any) as any)
        .select("*").order("level").order("weekday").order("start_time");
      if (error) throw error;
      return (data ?? []) as ObRule[];
    },
  });

  const [name, setName] = useState("");
  const [level, setLevel] = useState<"1" | "2" | "3">("1");
  const [weekday, setWeekday] = useState<string>("1");
  const [start, setStart] = useState("18:00");
  const [end, setEnd] = useState("23:00");

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase.from("ob_rules" as any) as any).insert({
        name: name.trim() || `OB${level}`,
        level: Number(level),
        weekday: Number(weekday),
        start_time: start,
        end_time: end,
        active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ob-rules"] });
      toast.success("Regel tillagd");
      setName("");
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const toggleMut = useMutation({
    mutationFn: async (r: ObRule) => {
      const { error } = await (supabase.from("ob_rules" as any) as any)
        .update({ active: !r.active }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ob-rules"] }),
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("ob_rules" as any) as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ob-rules"] });
      toast.success("Regel borttagen");
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const rules = rulesQ.data ?? [];
  const sorted = [...rules].sort((a, b) => {
    if (a.level !== b.level) return a.level - b.level;
    const ai = WEEK_ORDER.indexOf(a.weekday);
    const bi = WEEK_ORDER.indexOf(b.weekday);
    if (ai !== bi) return ai - bi;
    return a.start_time.localeCompare(b.start_time);
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">OB-regler</h1>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-6 px-4 pt-6">
        {adminQ.isLoading ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Laddar…</Card>
        ) : !adminQ.data?.isAdmin ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Endast administratörer har åtkomst.</Card>
        ) : (
          <>
            <Card className="space-y-3 p-4">
              <h2 className="text-sm font-medium">Lägg till regel</h2>
              <p className="text-xs text-muted-foreground">
                Definiera när en OB-nivå gäller (veckodag + tidsintervall). Om sluttid är ≤ starttid spänner intervallet över midnatt.
                OB-procentpåslag per användare sätts på användaren i Admin.
              </p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1">
                  <Label className="text-xs">Namn</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="t.ex. Kvällstid vardag" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nivå</Label>
                  <Select value={level} onValueChange={(v) => setLevel(v as "1" | "2" | "3")}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">OB1</SelectItem>
                      <SelectItem value="2">OB2</SelectItem>
                      <SelectItem value="3">OB3</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Veckodag</Label>
                  <Select value={weekday} onValueChange={setWeekday}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {WEEK_ORDER.map((d) => (
                        <SelectItem key={d} value={String(d)}>{WEEKDAY_LABELS_SV[d]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-xs">Från</Label>
                    <Input type="time" value={start} onChange={(e) => setStart(e.target.value)} />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Till</Label>
                    <Input type="time" value={end} onChange={(e) => setEnd(e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={() => createMut.mutate()} disabled={createMut.isPending}>
                  <Plus className="mr-2 h-4 w-4" /> Lägg till
                </Button>
              </div>
            </Card>

            {[1, 2, 3].map((lvl) => {
              const list = sorted.filter((r) => r.level === lvl);
              return (
                <section key={lvl} className="space-y-2">
                  <h2 className="px-1 text-sm font-medium text-muted-foreground">OB{lvl} ({list.length})</h2>
                  <Card className="divide-y p-0">
                    {list.length === 0 ? (
                      <div className="p-6 text-center text-sm text-muted-foreground">Inga regler.</div>
                    ) : list.map((r) => (
                      <div key={r.id} className={`flex items-center gap-3 px-4 py-3 ${!r.active ? "opacity-50" : ""}`}>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium">{r.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {WEEKDAY_LABELS_SV[r.weekday]} · {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                            {!r.active && " · inaktiv"}
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => toggleMut.mutate(r)} title={r.active ? "Inaktivera" : "Aktivera"}>
                          <Power className="h-4 w-4" />
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => {
                          if (confirm("Ta bort regeln?")) deleteMut.mutate(r.id);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </Card>
                </section>
              );
            })}
          </>
        )}
      </main>
    </div>
  );
}