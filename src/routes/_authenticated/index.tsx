import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Play, Square, Plus, Download, LogOut, FolderKanban, Trash2, MoreVertical, BarChart3, ShieldCheck, CalendarIcon, ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { toast } from "sonner";
import { ApprovalGate } from "@/components/approval-gate";
import { isAdmin as isAdminFn } from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Tidskoll – Tidsregistrering" }] }),
  component: () => (
    <ApprovalGate>
      <HomePage />
    </ApprovalGate>
  ),
});

type Project = { id: string; name: string; client: string | null; color: string };
type Entry = {
  id: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  project_id: string | null;
  projects?: { name: string; color: string } | null;
};

function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function getIsoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function HomePage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [now, setNow] = useState(() => Date.now());
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState<string>("none");
  const [manualOpen, setManualOpen] = useState(false);
  const [projectsOpen, setProjectsOpen] = useState(false);
  const [range, setRange] = useState<"day" | "week" | "month">("day");
  const [filterDate, setFilterDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const checkAdmin = useServerFn(isAdminFn);
  const adminQ = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin({ data: undefined }),
    staleTime: 60_000,
  });
  const userIsAdmin = Boolean(adminQ.data?.isAdmin);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const projectsQ = useQuery({
    queryKey: ["projects"],
    queryFn: async (): Promise<Project[]> => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const entriesQ = useQuery({
    queryKey: ["entries"],
    queryFn: async (): Promise<Entry[]> => {
      const { data, error } = await supabase
        .from("time_entries")
        .select("id, description, start_time, end_time, project_id, projects(name, color)")
        .order("start_time", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as Entry[];
    },
  });

  const running = entriesQ.data?.find((e) => !e.end_time) ?? null;

  async function startTimer() {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("time_entries").insert({
      user_id: u.user.id,
      description: description || null,
      project_id: projectId === "none" ? null : projectId,
      start_time: new Date().toISOString(),
    });
    if (error) return toast.error(error.message);
    setDescription("");
    qc.invalidateQueries({ queryKey: ["entries"] });
  }

  async function stopTimer() {
    if (!running) return;
    const { error } = await supabase
      .from("time_entries")
      .update({ end_time: new Date().toISOString() })
      .eq("id", running.id);
    if (error) return toast.error(error.message);
    toast.success("Tid sparad");
    qc.invalidateQueries({ queryKey: ["entries"] });
  }

  async function deleteEntry(id: string) {
    const { error } = await supabase.from("time_entries").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["entries"] });
  }

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  function exportCsv() {
    const rows = entriesQ.data ?? [];
    const header = ["Datum", "Start", "Slut", "Varaktighet (h)", "Projekt", "Beskrivning"];
    const lines = [header.join(",")];
    for (const r of rows) {
      if (!r.end_time) continue;
      const start = new Date(r.start_time);
      const end = new Date(r.end_time);
      const hours = ((end.getTime() - start.getTime()) / 3600000).toFixed(2);
      const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
      lines.push([
        esc(start.toLocaleDateString("sv-SE")),
        esc(start.toLocaleTimeString("sv-SE")),
        esc(end.toLocaleTimeString("sv-SE")),
        hours,
        esc(r.projects?.name ?? ""),
        esc(r.description ?? ""),
      ].join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `tidskoll-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>();
    const start = new Date(filterDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    if (range === "day") {
      end.setDate(end.getDate() + 1);
    } else if (range === "week") {
      const dow = (start.getDay() + 6) % 7;
      start.setDate(start.getDate() - dow);
      end.setTime(start.getTime());
      end.setDate(end.getDate() + 7);
    } else {
      start.setDate(1);
      end.setTime(start.getTime());
      end.setMonth(end.getMonth() + 1);
    }
    for (const e of entriesQ.data ?? []) {
      if (!e.end_time) continue;
      const t = new Date(e.start_time).getTime();
      if (t < start.getTime() || t >= end.getTime()) continue;
      const day = new Date(e.start_time).toLocaleDateString("sv-SE", { weekday: "long", day: "numeric", month: "long" });
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(e);
    }
    return Array.from(map.entries());
  }, [entriesQ.data, filterDate, range]);

  const totals = useMemo(() => {
    const totals = new Map<string, number>();
    for (const [day, list] of grouped) {
      const sum = list.reduce((acc, e) => acc + (new Date(e.end_time!).getTime() - new Date(e.start_time).getTime()), 0);
      totals.set(day, sum);
    }
    return totals;
  }, [grouped]);

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight">Tidskoll</h1>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon"><MoreVertical className="h-5 w-5" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/overview"><BarChart3 className="mr-2 h-4 w-4" /> Månadsöversikt</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/admin"><ShieldCheck className="mr-2 h-4 w-4" /> Admin</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setProjectsOpen(true)}>
                <FolderKanban className="mr-2 h-4 w-4" /> Projekt
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportCsv}>
                <Download className="mr-2 h-4 w-4" /> Exportera CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={signOut}>
                <LogOut className="mr-2 h-4 w-4" /> Logga ut
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 pt-6">
        {/* Timer card */}
        <Card className="p-5">
          {running ? (
            <div className="space-y-4">
              <div className="text-center">
                <div className="text-xs uppercase tracking-wider text-muted-foreground">Pågående</div>
                <div className="mt-2 font-mono text-5xl font-semibold tabular-nums">
                  {formatDuration(now - new Date(running.start_time).getTime())}
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  {running.projects?.name ? <span style={{ color: running.projects.color }}>● </span> : null}
                  {running.description || "Ingen beskrivning"}
                </div>
              </div>
              <Button onClick={stopTimer} size="lg" variant="destructive" className="w-full">
                <Square className="mr-2 h-4 w-4 fill-current" /> Stoppa
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <Input
                placeholder="Vad jobbar du med?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
              <div className="flex gap-2">
                <Select value={projectId} onValueChange={setProjectId}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Projekt" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Inget projekt</SelectItem>
                    {projectsQ.data?.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        <span style={{ color: p.color }}>● </span>{p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={startTimer} size="lg">
                  <Play className="mr-2 h-4 w-4 fill-current" /> Start
                </Button>
              </div>
              <Button variant="outline" className="w-full" onClick={() => setManualOpen(true)}>
                <Plus className="mr-2 h-4 w-4" /> Lägg till tid manuellt
              </Button>
            </div>
          )}
        </Card>

        {/* Entries */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-medium text-muted-foreground">Poster</h2>
              <Select value={range} onValueChange={(v) => setRange(v as "day" | "week" | "month")}>
                <SelectTrigger className="h-8 w-[110px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="day">Dag</SelectItem>
                  <SelectItem value="week">Vecka</SelectItem>
                  <SelectItem value="month">Månad</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const d = new Date(filterDate);
                  if (range === "day") d.setDate(d.getDate() - 1);
                  else if (range === "week") d.setDate(d.getDate() - 7);
                  else d.setMonth(d.getMonth() - 1);
                  setFilterDate(d);
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="font-normal">
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {range === "day"
                      ? filterDate.toLocaleDateString("sv-SE", { weekday: "short", day: "numeric", month: "short" })
                      : range === "month"
                      ? filterDate.toLocaleDateString("sv-SE", { month: "long", year: "numeric" })
                      : `v.${getIsoWeek(filterDate)}`}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={filterDate}
                    onSelect={(d) => d && setFilterDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  const d = new Date(filterDate);
                  if (range === "day") d.setDate(d.getDate() + 1);
                  else if (range === "week") d.setDate(d.getDate() + 7);
                  else d.setMonth(d.getMonth() + 1);
                  setFilterDate(d);
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {entriesQ.isLoading ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">Laddar…</Card>
          ) : grouped.length === 0 ? (
            <Card className="p-8 text-center text-sm text-muted-foreground">
              Inga tidsposter i vald period.
            </Card>
          ) : (
            grouped.map(([day, list]) => (
              <div key={day} className="space-y-2">
                <div className="flex items-center justify-between px-1 text-xs">
                  <span className="font-medium capitalize text-foreground">{day}</span>
                  <span className="font-mono tabular-nums text-muted-foreground">
                    {formatDuration(totals.get(day) ?? 0)}
                  </span>
                </div>
                <Card className="divide-y overflow-hidden p-0">
                  {list.map((e) => {
                    const dur = new Date(e.end_time!).getTime() - new Date(e.start_time).getTime();
                    return (
                      <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                        <div className="h-8 w-1 rounded-full" style={{ background: e.projects?.color ?? "var(--muted-foreground)" }} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{e.description || "Ingen beskrivning"}</div>
                          <div className="text-xs text-muted-foreground">
                            {e.projects?.name ?? "Inget projekt"} · {new Date(e.start_time).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}–{new Date(e.end_time!).toLocaleTimeString("sv-SE", { hour: "2-digit", minute: "2-digit" })}
                          </div>
                        </div>
                        <div className="font-mono text-sm tabular-nums">{formatDuration(dur)}</div>
                        <Button variant="ghost" size="icon" onClick={() => deleteEntry(e.id)}>
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                </Card>
              </div>
            ))
          )}
        </section>
      </main>

      <ManualEntryDialog open={manualOpen} onOpenChange={setManualOpen} projects={projectsQ.data ?? []} />
      <ProjectsDialog open={projectsOpen} onOpenChange={setProjectsOpen} projects={projectsQ.data ?? []} isAdmin={userIsAdmin} />
    </div>
  );
}

function ManualEntryDialog({ open, onOpenChange, projects }: { open: boolean; onOpenChange: (v: boolean) => void; projects: Project[] }) {
  const qc = useQueryClient();
  const [date, setDate] = useState<Date>(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  });
  const [dateText, setDateText] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");
  const [description, setDescription] = useState("");
  const [projectId, setProjectId] = useState("none");

  function syncDate(d: Date) {
    setDate(d);
    setDateText(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
  }

  function onDateTextChange(v: string) {
    setDateText(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) {
      const parsed = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (!isNaN(parsed.getTime())) setDate(parsed);
    }
  }

  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(dateText) && !isNaN(new Date(dateText).getTime());

  function normalizeTime(v: string): string | null {
    const t = v.trim().replace(/[.,]/g, ":");
    let hStr: string | null = null;
    let miStr: string | null = null;
    const m = /^(\d{1,2}):(\d{2})$/.exec(t);
    if (m) {
      hStr = m[1];
      miStr = m[2];
    } else {
      const d = /^(\d{3,4})$/.exec(t);
      if (d) {
        const s = d[1].padStart(4, "0");
        hStr = s.slice(0, 2);
        miStr = s.slice(2);
      }
    }
    if (hStr === null || miStr === null) return null;
    const h = Number(hStr);
    const mi = Number(miStr);
    if (h < 0 || h > 23 || mi < 0 || mi > 59) return null;
    return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
  }

  const startNorm = normalizeTime(start);
  const endNorm = normalizeTime(end);

  async function save() {
    if (!dateValid) return toast.error("Ogiltigt datum");
    if (!startNorm) return toast.error("Ogiltig starttid");
    if (!endNorm) return toast.error("Ogiltig sluttid");
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const isoDay = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    const startIso = new Date(`${isoDay}T${startNorm}`).toISOString();
    let endDate = new Date(`${isoDay}T${endNorm}`);
    if (endDate.getTime() <= new Date(startIso).getTime()) {
      endDate = new Date(endDate.getTime() + 24 * 3600 * 1000);
    }
    const endIso = endDate.toISOString();
    const { error } = await supabase.from("time_entries").insert({
      user_id: u.user.id,
      description: description || null,
      project_id: projectId === "none" ? null : projectId,
      start_time: startIso,
      end_time: endIso,
    });
    if (error) return toast.error(error.message);
    toast.success("Tid tillagd");
    qc.invalidateQueries({ queryKey: ["entries"] });
    onOpenChange(false);
    setDescription("");
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-6 gap-5">
        <DialogHeader><DialogTitle className="text-xl">Lägg till tid</DialogTitle></DialogHeader>
        <div className="space-y-5">
          <div className="space-y-2">
            <Label className="text-base">Datum</Label>
            <div className="flex gap-2">
              <Input
                value={dateText}
                onChange={(e) => onDateTextChange(e.target.value)}
                placeholder="ÅÅÅÅ-MM-DD"
                inputMode="numeric"
                className={cn("h-12 text-base flex-1", !dateValid && "border-destructive")}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" aria-label="Öppna kalender">
                    <CalendarIcon className="h-5 w-5" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => d && syncDate(d)}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-base">Start</Label>
              <TimeField value={start} onChange={setStart} valid={!!startNorm} />
            </div>
            <div className="space-y-2">
              <Label className="text-base">Slut</Label>
              <TimeField value={end} onChange={setEnd} valid={!!endNorm} />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-base">Projekt</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Inget projekt</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <span style={{ color: p.color }}>● </span>{p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className="text-base">Beskrivning</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Vad gjorde du?" className="h-12 text-base" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" size="lg" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button size="lg" onClick={save}>Spara</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#6366f1", "#ec4899", "#8b5cf6"];

function TimeField({ value, onChange, valid }: { value: string; onChange: (v: string) => void; valid: boolean }) {
  const [open, setOpen] = useState(false);
  const options: string[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 15) {
      options.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return (
    <div className="flex gap-2">
      <Input
        type="text"
        inputMode="numeric"
        placeholder="HH:MM"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn("h-12 text-base flex-1 min-w-0", !valid && "border-destructive")}
      />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" size="icon" className="h-12 w-12 shrink-0" aria-label="Välj tid">
            <Clock className="h-5 w-5" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-32 p-1" align="end">
          <div className="max-h-64 overflow-y-auto">
            {options.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { onChange(t); setOpen(false); }}
                className={cn(
                  "w-full text-left px-3 py-2 rounded-md text-base hover:bg-accent",
                  value === t && "bg-accent"
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function ProjectsDialog({ open, onOpenChange, projects, isAdmin }: { open: boolean; onOpenChange: (v: boolean) => void; projects: Project[]; isAdmin: boolean }) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [client, setClient] = useState("");
  const [color, setColor] = useState(COLORS[5]);

  async function add() {
    if (!name.trim()) return;
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const { error } = await supabase.from("projects").insert({
      user_id: u.user.id,
      name: name.trim(),
      client: client.trim() || null,
      color,
    });
    if (error) return toast.error(error.message);
    setName(""); setClient("");
    qc.invalidateQueries({ queryKey: ["projects"] });
  }

  async function remove(id: string) {
    const { error } = await supabase.from("projects").delete().eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["projects"] });
    qc.invalidateQueries({ queryKey: ["entries"] });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>Projekt & kunder</DialogTitle></DialogHeader>
        <div className="space-y-4">
          {isAdmin ? (
            <div className="space-y-2">
              <Input placeholder="Projektnamn" value={name} onChange={(e) => setName(e.target.value)} />
              <Input placeholder="Kund (valfritt)" value={client} onChange={(e) => setClient(e.target.value)} />
              <div className="flex flex-wrap gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-7 w-7 rounded-full ring-offset-2 transition ${color === c ? "ring-2 ring-foreground" : ""}`}
                    style={{ background: c }}
                    aria-label={c}
                  />
                ))}
              </div>
              <Button onClick={add} className="w-full"><Plus className="mr-2 h-4 w-4" /> Lägg till projekt</Button>
            </div>
          ) : (
            <p className="rounded-md bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
              Endast administratörer kan skapa eller ta bort projekt.
            </p>
          )}
          <div className="space-y-1">
            {projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">Inga projekt ännu.</p>
            ) : projects.map((p) => (
              <div key={p.id} className="flex items-center gap-3 rounded-lg border px-3 py-2">
                <div className="h-3 w-3 rounded-full" style={{ background: p.color }} />
                <div className="flex-1">
                  <div className="text-sm font-medium">{p.name}</div>
                  {p.client && <div className="text-xs text-muted-foreground">{p.client}</div>}
                </div>
                {isAdmin && (
                  <Button variant="ghost" size="icon" onClick={() => remove(p.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}