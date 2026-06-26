import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Pencil, Trash2, Save, X, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin-projects")({
  head: () => ({ meta: [{ title: "Projekt & kunder – Admin" }] }),
  component: AdminProjectsPage,
});

const COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#84cc16", "#10b981",
  "#06b6d4", "#3b82f6", "#6366f1", "#a855f7", "#ec4899",
];

type Client = { id: string; name: string; note: string | null };
type Project = {
  id: string;
  name: string;
  color: string;
  client_id: string | null;
  client: string | null;
  start_date: string | null;
  end_date: string | null;
};

function ymdToDate(s: string | null): Date | undefined {
  if (!s) return undefined;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return isNaN(d.getTime()) ? undefined : d;
}
function dateToYmd(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function isValidYmdOrEmpty(s: string): boolean {
  if (!s.trim()) return true;
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(new Date(s).getTime());
}
function fmtRange(s: string | null, e: string | null): string {
  if (!s && !e) return "—";
  if (s && e) return `${s} → ${e}`;
  if (s) return `från ${s}`;
  return `→ ${e}`;
}

function DateField({ value, onChange, valid }: { value: string; onChange: (v: string) => void; valid: boolean }) {
  const d = ymdToDate(value);
  return (
    <div className="flex gap-2">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ÅÅÅÅ-MM-DD (valfritt)"
        inputMode="numeric"
        className={cn("flex-1", !valid && "border-destructive")}
      />
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" aria-label="Öppna kalender">
            <CalendarIcon className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end">
          <Calendar
            mode="single"
            selected={d}
            onSelect={(picked) => picked && onChange(dateToYmd(picked))}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <Button variant="ghost" size="icon" onClick={() => onChange("")} aria-label="Rensa">
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function AdminProjectsPage() {
  const checkAdmin = useServerFn(isAdmin);
  const qc = useQueryClient();
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin({ data: undefined }) });

  const clientsQ = useQuery({
    queryKey: ["clients"],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await (supabase.from("clients" as any) as any)
        .select("id, name, note")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Client[];
    },
  });

  const projectsQ = useQuery({
    queryKey: ["projects-admin"],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, color, client_id, client, start_date, end_date")
        .order("name");
      if (error) throw error;
      return (data ?? []) as unknown as Project[];
    },
  });

  // Clients
  const [newClientName, setNewClientName] = useState("");
  const [newClientNote, setNewClientNote] = useState("");
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editClientNote, setEditClientNote] = useState("");

  const addClient = useMutation({
    mutationFn: async (v: { name: string; note: string }) => {
      const { error } = await (supabase.from("clients" as any) as any).insert({
        name: v.name.trim(),
        note: v.note.trim() || null,
      });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      setNewClientName(""); setNewClientNote("");
      toast.success("Kund tillagd");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateClient = useMutation({
    mutationFn: async (v: { id: string; name: string; note: string }) => {
      const { error } = await (supabase.from("clients" as any) as any)
        .update({ name: v.name.trim(), note: v.note.trim() || null })
        .eq("id", v.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["projects-admin"] });
      setEditingClient(null);
      toast.success("Kund uppdaterad");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteClient = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase.from("clients" as any) as any).delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["projects-admin"] });
      toast.success("Kund borttagen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Projects
  const [newProjName, setNewProjName] = useState("");
  const [newProjClient, setNewProjClient] = useState<string>("none");
  const [newProjColor, setNewProjColor] = useState(COLORS[5]);
  const [newProjStart, setNewProjStart] = useState("");
  const [newProjEnd, setNewProjEnd] = useState("");
  const [editingProj, setEditingProj] = useState<Project | null>(null);
  const [editProjName, setEditProjName] = useState("");
  const [editProjClient, setEditProjClient] = useState<string>("none");
  const [editProjColor, setEditProjColor] = useState(COLORS[5]);
  const [editProjStart, setEditProjStart] = useState("");
  const [editProjEnd, setEditProjEnd] = useState("");

  const addProject = useMutation({
    mutationFn: async () => {
      if (!newProjName.trim()) throw new Error("Namn krävs");
      if (!isValidYmdOrEmpty(newProjStart)) throw new Error("Ogiltigt startdatum");
      if (!isValidYmdOrEmpty(newProjEnd)) throw new Error("Ogiltigt slutdatum");
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("Inte inloggad");
      const clientId = newProjClient === "none" ? null : newProjClient;
      const clientName = clientId ? clientsQ.data?.find((c) => c.id === clientId)?.name ?? null : null;
      const { error } = await supabase.from("projects").insert({
        user_id: u.user.id,
        name: newProjName.trim(),
        color: newProjColor,
        client_id: clientId,
        client: clientName,
        start_date: newProjStart.trim() || null,
        end_date: newProjEnd.trim() || null,
      } as any);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-admin"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setNewProjName(""); setNewProjClient("none"); setNewProjColor(COLORS[5]);
      setNewProjStart(""); setNewProjEnd("");
      toast.success("Projekt tillagt");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProject = useMutation({
    mutationFn: async () => {
      if (!editingProj) return;
      if (!isValidYmdOrEmpty(editProjStart)) throw new Error("Ogiltigt startdatum");
      if (!isValidYmdOrEmpty(editProjEnd)) throw new Error("Ogiltigt slutdatum");
      const clientId = editProjClient === "none" ? null : editProjClient;
      const clientName = clientId ? clientsQ.data?.find((c) => c.id === clientId)?.name ?? null : null;
      const { error } = await supabase
        .from("projects")
        .update({
          name: editProjName.trim(),
          color: editProjColor,
          client_id: clientId,
          client: clientName,
          start_date: editProjStart.trim() || null,
          end_date: editProjEnd.trim() || null,
        } as any)
        .eq("id", editingProj.id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-admin"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditingProj(null);
      toast.success("Projekt uppdaterat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw new Error(error.message);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["projects-admin"] });
      qc.invalidateQueries({ queryKey: ["projects"] });
      toast.success("Projekt borttaget");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function startEditProject(p: Project) {
    setEditingProj(p);
    setEditProjName(p.name);
    setEditProjClient(p.client_id ?? "none");
    setEditProjColor(p.color);
    setEditProjStart(p.start_date ?? "");
    setEditProjEnd(p.end_date ?? "");
  }
  function startEditClient(c: Client) {
    setEditingClient(c);
    setEditClientName(c.name);
    setEditClientNote(c.note ?? "");
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Projekt & kunder</h1>
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
            {/* Kunder */}
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-medium text-muted-foreground">
                Kunder ({clientsQ.data?.length ?? 0})
              </h2>
              <Card className="space-y-3 p-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input placeholder="Kundnamn" value={newClientName} onChange={(e) => setNewClientName(e.target.value)} />
                  <Input placeholder="Anteckning (valfritt)" value={newClientNote} onChange={(e) => setNewClientNote(e.target.value)} />
                </div>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    disabled={!newClientName.trim() || addClient.isPending}
                    onClick={() => addClient.mutate({ name: newClientName, note: newClientNote })}
                  >
                    <Plus className="mr-1 h-4 w-4" /> Lägg till kund
                  </Button>
                </div>
              </Card>
              <Card className="divide-y p-0">
                {clientsQ.data?.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Inga kunder.</div>
                ) : (
                  clientsQ.data?.map((c) => (
                    <div key={c.id} className="flex flex-wrap items-center gap-2 px-4 py-3">
                      {editingClient?.id === c.id ? (
                        <>
                          <Input className="h-8 flex-1 min-w-[140px]" value={editClientName} onChange={(e) => setEditClientName(e.target.value)} />
                          <Input className="h-8 flex-1 min-w-[140px]" value={editClientNote} onChange={(e) => setEditClientNote(e.target.value)} placeholder="Anteckning" />
                          <Button size="sm" onClick={() => updateClient.mutate({ id: c.id, name: editClientName, note: editClientNote })} disabled={updateClient.isPending}>
                            <Save className="mr-1 h-4 w-4" /> Spara
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingClient(null)}>
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium">{c.name}</div>
                            {c.note && <div className="text-xs text-muted-foreground">{c.note}</div>}
                          </div>
                          <Button size="icon" variant="ghost" onClick={() => startEditClient(c)} title="Redigera">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            title="Ta bort"
                            onClick={() => { if (confirm(`Ta bort ${c.name}?`)) deleteClient.mutate(c.id); }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))
                )}
              </Card>
            </section>

            {/* Projekt */}
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-medium text-muted-foreground">
                Projekt ({projectsQ.data?.length ?? 0})
              </h2>
              <Card className="space-y-3 p-4">
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  <Input placeholder="Projektnamn" value={newProjName} onChange={(e) => setNewProjName(e.target.value)} />
                  <Select value={newProjClient} onValueChange={setNewProjClient}>
                    <SelectTrigger><SelectValue placeholder="Kund" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Ingen kund</SelectItem>
                      {clientsQ.data?.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs">Färg:</Label>
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setNewProjColor(c)}
                      className={`h-7 w-7 rounded-full ring-offset-2 transition ${newProjColor === c ? "ring-2 ring-foreground" : ""}`}
                      style={{ background: c }}
                      aria-label={c}
                    />
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button size="sm" disabled={!newProjName.trim() || addProject.isPending} onClick={() => addProject.mutate()}>
                    <Plus className="mr-1 h-4 w-4" /> Lägg till projekt
                  </Button>
                </div>
              </Card>
              <Card className="divide-y p-0">
                {projectsQ.data?.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Inga projekt.</div>
                ) : (
                  projectsQ.data?.map((p) => {
                    const clientName = clientsQ.data?.find((c) => c.id === p.client_id)?.name ?? p.client;
                    const isEd = editingProj?.id === p.id;
                    return (
                      <div key={p.id} className="space-y-2 px-4 py-3">
                        {isEd ? (
                          <div className="space-y-2">
                            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                              <Input value={editProjName} onChange={(e) => setEditProjName(e.target.value)} placeholder="Namn" />
                              <Select value={editProjClient} onValueChange={setEditProjClient}>
                                <SelectTrigger><SelectValue placeholder="Kund" /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="none">Ingen kund</SelectItem>
                                  {clientsQ.data?.map((c) => (
                                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              {COLORS.map((c) => (
                                <button
                                  key={c}
                                  type="button"
                                  onClick={() => setEditProjColor(c)}
                                  className={`h-7 w-7 rounded-full ring-offset-2 transition ${editProjColor === c ? "ring-2 ring-foreground" : ""}`}
                                  style={{ background: c }}
                                  aria-label={c}
                                />
                              ))}
                            </div>
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditingProj(null)}>Avbryt</Button>
                              <Button size="sm" onClick={() => updateProject.mutate()} disabled={updateProject.isPending}>
                                <Save className="mr-1 h-4 w-4" /> Spara
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <div className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                            <div className="min-w-0 flex-1">
                              <div className="text-sm font-medium">{p.name}</div>
                              <div className="text-xs text-muted-foreground">{clientName ?? "Ingen kund"}</div>
                            </div>
                            <Button size="icon" variant="ghost" onClick={() => startEditProject(p)} title="Redigera">
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive hover:text-destructive"
                              title="Ta bort"
                              onClick={() => { if (confirm(`Ta bort ${p.name}?`)) deleteProject.mutate(p.id); }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}