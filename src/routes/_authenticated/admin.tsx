import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Download, ShieldCheck, Check, X, Trash2, Shield, ShieldOff, RotateCcw, UserPlus, Pencil, Plus, CalendarIcon, History } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import {
  isAdmin,
  claimFirstAdmin,
  getAllTimeEntries,
  listManagedUsers,
  setUserApproval,
  setUserAdmin,
  deleteManagedUser,
  createManagedUser,
  updateManagedUser,
  adminCreateTimeEntry,
  adminUpdateTimeEntry,
  adminDeleteTimeEntry,
  getAuditLog,
  type AdminEntry,
  type ManagedUser,
  type AuditLogEntry,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({ meta: [{ title: "Admin – Tidskoll" }] }),
  component: AdminPage,
});

function formatHours(ms: number) {
  return (ms / 3600000).toFixed(2);
}

function StatusBadge({ status }: { status: ManagedUser["status"] }) {
  const styles: Record<ManagedUser["status"], string> = {
    pending: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
    approved: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    rejected: "bg-destructive/15 text-destructive",
  };
  const labels: Record<ManagedUser["status"], string> = {
    pending: "Väntar",
    approved: "Godkänd",
    rejected: "Nekad",
  };
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${styles[status]}`}>
      {labels[status]}
    </span>
  );
}

function UsersSection(props: {
  users: ManagedUser[];
  loading: boolean;
  busy: boolean;
  onApprove: (u: ManagedUser) => void;
  onReject: (u: ManagedUser) => void;
  onReset: (u: ManagedUser) => void;
  onToggleAdmin: (u: ManagedUser) => void;
  onDelete: (u: ManagedUser) => void;
  onEdit: (u: ManagedUser) => void;
}) {
  const { users, loading, busy } = props;
  const pending = users.filter((u) => u.status === "pending");
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="text-sm font-medium text-muted-foreground">
          Användare ({users.length})
        </h2>
        {pending.length > 0 && (
          <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
            {pending.length} väntar på godkännande
          </span>
        )}
      </div>
      <Card className="divide-y p-0">
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Laddar…</div>
        ) : users.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Inga användare.</div>
        ) : (
          users.map((u) => (
            <div
              key={u.user_id}
              className="flex flex-wrap items-center gap-3 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-medium">{u.email ?? u.user_id}</span>
                  {u.is_admin && (
                    <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                      Admin
                    </span>
                  )}
                  <StatusBadge status={u.status} />
                </div>
                <div className="text-xs text-muted-foreground">
                  {u.phone ? <>Tel: {u.phone} · </> : null}
                  Skapad {new Date(u.created_at).toLocaleDateString("sv-SE")}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-1">
                {u.status !== "approved" && (
                  <Button
                    size="sm"
                    variant="default"
                    disabled={busy}
                    onClick={() => props.onApprove(u)}
                  >
                    <Check className="mr-1 h-4 w-4" /> Godkänn
                  </Button>
                )}
                {u.status !== "rejected" && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={busy}
                    onClick={() => props.onReject(u)}
                  >
                    <X className="mr-1 h-4 w-4" /> Neka
                  </Button>
                )}
                {u.status !== "pending" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => props.onReset(u)}
                    title="Återställ till väntande"
                  >
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => props.onEdit(u)}
                  title="Redigera"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => props.onToggleAdmin(u)}
                  title={u.is_admin ? "Ta bort admin" : "Gör till admin"}
                >
                  {u.is_admin ? (
                    <ShieldOff className="h-4 w-4" />
                  ) : (
                    <Shield className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => props.onDelete(u)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))
        )}
      </Card>
    </section>
  );
}

function AdminPage() {
  const checkAdmin = useServerFn(isAdmin);
  const claim = useServerFn(claimFirstAdmin);
  const fetchAll = useServerFn(getAllTimeEntries);
  const fetchUsers = useServerFn(listManagedUsers);
  const setApproval = useServerFn(setUserApproval);
  const setAdmin = useServerFn(setUserAdmin);
  const deleteUser = useServerFn(deleteManagedUser);
  const createUser = useServerFn(createManagedUser);
  const updateUser = useServerFn(updateManagedUser);
  const createEntryFn = useServerFn(adminCreateTimeEntry);
  const updateEntryFn = useServerFn(adminUpdateTimeEntry);
  const deleteEntryFn = useServerFn(adminDeleteTimeEntry);
  const qc = useQueryClient();

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

  const auditFn = useServerFn(getAuditLog);
  const auditQ = useQuery({
    queryKey: ["audit-log"],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: () => auditFn({ data: { limit: 200 } }),
  });

  const usersQ = useQuery({
    queryKey: ["managed-users"],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: () => fetchUsers({ data: undefined }),
  });

  const approvalMut = useMutation({
    mutationFn: (v: { userId: string; status: "pending" | "approved" | "rejected" }) =>
      setApproval({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managed-users"] });
      toast.success("Status uppdaterad");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const adminMut = useMutation({
    mutationFn: (v: { userId: string; isAdmin: boolean }) => setAdmin({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managed-users"] });
      toast.success("Adminroll uppdaterad");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (userId: string) => deleteUser({ data: { userId } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managed-users"] });
      qc.invalidateQueries({ queryKey: ["admin-entries"] });
      toast.success("Användare borttagen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newMakeAdmin, setNewMakeAdmin] = useState(false);

  const createMut = useMutation({
    mutationFn: (v: { email: string; password: string; phone: string; makeAdmin: boolean }) =>
      createUser({ data: { email: v.email, password: v.password, phone: v.phone, approve: true, makeAdmin: v.makeAdmin } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managed-users"] });
      toast.success("Användare skapad och godkänd");
      setNewEmail("");
      setNewPhone("");
      setNewPassword("");
      setNewMakeAdmin(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editPassword, setEditPassword] = useState("");

  const updateMut = useMutation({
    mutationFn: (v: { userId: string; email?: string; phone?: string; password?: string }) =>
      updateUser({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["managed-users"] });
      qc.invalidateQueries({ queryKey: ["admin-entries"] });
      toast.success("Användare uppdaterad");
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  type ProjectLite = { id: string; name: string; color: string };
  const projectsQ = useQuery({
    queryKey: ["projects"],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: async (): Promise<ProjectLite[]> => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, color")
        .order("name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const [entryDialogOpen, setEntryDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<AdminEntry | null>(null);

  const createEntryMut = useMutation({
    mutationFn: (v: {
      userId: string; projectId: string | null; description: string | null;
      date: string; start: string; end: string;
    }) => createEntryFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-entries"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
      toast.success("Tid tillagd");
      setEntryDialogOpen(false);
      setEditingEntry(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEntryMut = useMutation({
    mutationFn: (v: {
      id: string; projectId: string | null; description: string | null;
      date: string; start: string; end: string;
    }) => updateEntryFn({ data: v }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-entries"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
      toast.success("Tid uppdaterad");
      setEntryDialogOpen(false);
      setEditingEntry(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEntryMut = useMutation({
    mutationFn: (id: string) => deleteEntryFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-entries"] });
      qc.invalidateQueries({ queryKey: ["audit-log"] });
      toast.success("Tid borttagen");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(u: ManagedUser) {
    setEditing(u);
    setEditEmail(u.email ?? "");
    setEditPhone(u.phone ?? "");
    setEditPassword("");
  }

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
            <section className="space-y-2">
              <h2 className="px-1 text-sm font-medium text-muted-foreground">Skapa användare</h2>
              <Card className="space-y-3 p-4">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label className="text-xs">E-post</Label>
                    <Input
                      type="email"
                      value={newEmail}
                      onChange={(e) => setNewEmail(e.target.value)}
                      placeholder="namn@exempel.se"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Telefonnummer</Label>
                    <Input
                      type="tel"
                      value={newPhone}
                      onChange={(e) => setNewPhone(e.target.value)}
                      placeholder="+46 70 123 45 67"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Lösenord (minst 6 tecken)</Label>
                    <Input
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Tillfälligt lösenord"
                    />
                  </div>
                  <label className="flex items-center gap-2 self-end text-sm">
                    <input
                      type="checkbox"
                      checked={newMakeAdmin}
                      onChange={(e) => setNewMakeAdmin(e.target.checked)}
                    />
                    Gör till admin
                  </label>
                </div>
                <div className="flex justify-end">
                  <Button
                    onClick={() =>
                      createMut.mutate({
                        email: newEmail,
                        password: newPassword,
                        phone: newPhone,
                        makeAdmin: newMakeAdmin,
                      })
                    }
                    disabled={createMut.isPending || !newEmail || !newPassword}
                  >
                    <UserPlus className="mr-2 h-4 w-4" /> Skapa
                  </Button>
                </div>
              </Card>
            </section>

            <UsersSection
              users={usersQ.data ?? []}
              loading={usersQ.isLoading}
              onApprove={(u) => approvalMut.mutate({ userId: u.user_id, status: "approved" })}
              onReject={(u) => approvalMut.mutate({ userId: u.user_id, status: "rejected" })}
              onReset={(u) => approvalMut.mutate({ userId: u.user_id, status: "pending" })}
              onToggleAdmin={(u) => adminMut.mutate({ userId: u.user_id, isAdmin: !u.is_admin })}
              onEdit={openEdit}
              onDelete={(u) => {
                if (confirm(`Ta bort ${u.email ?? u.user_id}? Detta kan inte ångras.`)) {
                  deleteMut.mutate(u.user_id);
                }
              }}
              busy={approvalMut.isPending || adminMut.isPending || deleteMut.isPending}
            />

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
              <div className="flex items-center justify-between px-1">
                <h2 className="text-sm font-medium text-muted-foreground">
                  Alla poster ({rows.length})
                </h2>
                <Button
                  size="sm"
                  onClick={() => { setEditingEntry(null); setEntryDialogOpen(true); }}
                >
                  <Plus className="mr-1 h-4 w-4" /> Lägg till tid
                </Button>
              </div>
              <Card className="overflow-x-auto p-0">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-left text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2">Användare</th>
                      <th className="px-3 py-2">Datum</th>
                      <th className="px-3 py-2">Projekt</th>
                      <th className="px-3 py-2">Beskrivning</th>
                      <th className="px-3 py-2 text-right">Timmar</th>
                      <th className="px-3 py-2"></th>
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
                          <td className="px-3 py-2 whitespace-nowrap text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Redigera"
                              onClick={() => { setEditingEntry(r); setEntryDialogOpen(true); }}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Ta bort"
                              className="text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("Ta bort denna tidspost?")) {
                                  deleteEntryMut.mutate(r.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </section>

            <AuditLogSection entries={auditQ.data ?? []} loading={auditQ.isLoading} />
          </>
        )}
      </main>

      <EntryDialog
        open={entryDialogOpen}
        onOpenChange={(v) => { setEntryDialogOpen(v); if (!v) setEditingEntry(null); }}
        entry={editingEntry}
        users={usersQ.data ?? []}
        projects={projectsQ.data ?? []}
        onCreate={(v) => createEntryMut.mutate(v)}
        onUpdate={(v) => updateEntryMut.mutate(v)}
        saving={createEntryMut.isPending || updateEntryMut.isPending}
      />

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redigera användare</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs">E-post</Label>
                <Input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Telefonnummer</Label>
                <Input
                  type="tel"
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  placeholder="+46 70 123 45 67"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nytt lösenord (lämna tomt för oförändrat)</Label>
                <Input
                  type="text"
                  value={editPassword}
                  onChange={(e) => setEditPassword(e.target.value)}
                  placeholder="Minst 6 tecken"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Avbryt
            </Button>
            <Button
              disabled={updateMut.isPending || !editing}
              onClick={() => {
                if (!editing) return;
                const payload: { userId: string; email?: string; phone?: string; password?: string } = {
                  userId: editing.user_id,
                };
                if (editEmail.trim() && editEmail.trim() !== (editing.email ?? "")) {
                  payload.email = editEmail.trim();
                }
                if (editPhone.trim() !== (editing.phone ?? "")) {
                  payload.phone = editPhone;
                }
                if (editPassword) payload.password = editPassword;
                updateMut.mutate(payload);
              }}
            >
              Spara
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

type ProjectLite = { id: string; name: string; color: string };
type EntryFormBase = {
  projectId: string | null;
  description: string | null;
  date: string;
  start: string;
  end: string;
};

function pad2(n: number) { return String(n).padStart(2, "0"); }
function dateToYmd(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}
function dateToHm(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function normalizeTime(v: string): string | null {
  const t = v.trim().replace(/[.,]/g, ":");
  let h: string | null = null, m: string | null = null;
  const mm = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (mm) { h = mm[1]; m = mm[2]; }
  else {
    const d = /^(\d{3,4})$/.exec(t);
    if (d) { const s = d[1].padStart(4, "0"); h = s.slice(0, 2); m = s.slice(2); }
  }
  if (h === null || m === null) return null;
  const hi = Number(h), mi = Number(m);
  if (hi < 0 || hi > 23 || mi < 0 || mi > 59) return null;
  return `${pad2(hi)}:${pad2(mi)}`;
}

function EntryDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  entry: AdminEntry | null;
  users: ManagedUser[];
  projects: ProjectLite[];
  onCreate: (v: EntryFormBase & { userId: string }) => void;
  onUpdate: (v: EntryFormBase & { id: string }) => void;
  saving: boolean;
}) {
  const { open, onOpenChange, entry, users, projects, onCreate, onUpdate, saving } = props;
  const isEdit = !!entry;

  const today = new Date();
  const [userId, setUserId] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("none");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(today);
  const [dateText, setDateText] = useState(dateToYmd(today));
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("10:00");

  useEffect(() => {
    if (!open) return;
    if (entry) {
      const s = new Date(entry.start_time);
      const e = entry.end_time ? new Date(entry.end_time) : new Date(s.getTime() + 3600 * 1000);
      setUserId(entry.user_id);
      setProjectId(/* match by name */ projects.find((p) => p.name === entry.project_name)?.id ?? "none");
      setDescription(entry.description ?? "");
      setDate(s); setDateText(dateToYmd(s));
      setStart(dateToHm(s)); setEnd(dateToHm(e));
    } else {
      const d = new Date();
      setUserId(users[0]?.user_id ?? "");
      setProjectId("none"); setDescription("");
      setDate(d); setDateText(dateToYmd(d));
      setStart("09:00"); setEnd("10:00");
    }
  }, [open, entry, users, projects]);

  function syncDate(d: Date) { setDate(d); setDateText(dateToYmd(d)); }
  function onDateTextChange(v: string) {
    setDateText(v);
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
    if (m) {
      const p = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      if (!isNaN(p.getTime())) setDate(p);
    }
  }
  const dateValid = /^\d{4}-\d{2}-\d{2}$/.test(dateText) && !isNaN(new Date(dateText).getTime());
  const startNorm = normalizeTime(start);
  const endNorm = normalizeTime(end);

  function save() {
    if (!isEdit && !userId) return toast.error("Välj användare");
    if (!dateValid) return toast.error("Ogiltigt datum");
    if (!startNorm) return toast.error("Ogiltig starttid");
    if (!endNorm) return toast.error("Ogiltig sluttid");
    const base: EntryFormBase = {
      projectId: projectId === "none" ? null : projectId,
      description: description.trim() || null,
      date: dateText,
      start: startNorm,
      end: endNorm,
    };
    if (isEdit && entry) onUpdate({ ...base, id: entry.id });
    else onCreate({ ...base, userId });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-6 gap-5">
        <DialogHeader>
          <DialogTitle className="text-xl">{isEdit ? "Redigera tid" : "Lägg till tid"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1">
            <Label className="text-xs">Användare</Label>
            {isEdit ? (
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm">
                {entry?.user_email ?? entry?.user_id}
              </div>
            ) : (
              <Select value={userId} onValueChange={setUserId}>
                <SelectTrigger><SelectValue placeholder="Välj användare" /></SelectTrigger>
                <SelectContent>
                  {users.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      {u.email ?? u.user_id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Datum</Label>
            <div className="flex gap-2">
              <Input
                value={dateText}
                onChange={(e) => onDateTextChange(e.target.value)}
                placeholder="ÅÅÅÅ-MM-DD"
                inputMode="numeric"
                className={cn("flex-1", !dateValid && "border-destructive")}
              />
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="icon" aria-label="Öppna kalender">
                    <CalendarIcon className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={date} onSelect={(d) => d && syncDate(d)} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label className="text-xs">Start</Label>
              <Input
                value={start}
                onChange={(e) => setStart(e.target.value)}
                inputMode="numeric"
                placeholder="HH:MM"
                className={cn(!startNorm && "border-destructive")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Slut</Label>
              <Input
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                inputMode="numeric"
                placeholder="HH:MM"
                className={cn(!endNorm && "border-destructive")}
              />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Projekt</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
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
          <div className="space-y-1">
            <Label className="text-xs">Beskrivning</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Vad gjordes?" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Avbryt</Button>
          <Button onClick={save} disabled={saving}>Spara</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}