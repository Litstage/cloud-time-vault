import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { splitEntryByOb, computePay, type ObRule, type ObSplit, type Wage } from "@/lib/ob";

export type AdminEntry = {
  id: string;
  user_id: string;
  user_email: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
  start_time: string;
  end_time: string | null;
  description: string | null;
  project_id: string | null;
  project_name: string | null;
  project_color: string | null;
};

export type ManagedUser = {
  user_id: string;
  email: string | null;
  phone: string | null;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
  status: "pending" | "approved" | "rejected";
  approved_at: string | null;
  is_admin: boolean;
};

export type AuditLogEntry = {
  id: string;
  entry_id: string | null;
  entry_user_id: string | null;
  entry_user_email: string | null;
  action: "create" | "update" | "delete";
  changed_by: string;
  changed_by_email: string | null;
  before_data: Json | null;
  after_data: Json | null;
  created_at: string;
};

type Json = string | number | boolean | null | { [k: string]: Json } | Json[];

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (error) throw new Error(error.message);
    return { isAdmin: Boolean(data) };
  });

export const claimFirstAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("claim_first_admin");
    if (error) throw new Error(error.message);
    return { ok: Boolean(data) };
  });

export const getMyApprovalStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const [{ data: roleData }, { data: appr }] = await Promise.all([
      context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" }),
      context.supabase
        .from("user_approvals")
        .select("status")
        .eq("user_id", context.userId)
        .maybeSingle(),
    ]);
    const isAdmin = Boolean(roleData);
    const status = (appr?.status as "pending" | "approved" | "rejected" | undefined) ?? "pending";
    return { isAdmin, status, approved: isAdmin || status === "approved" };
  });

export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ManagedUser[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: approvals, error: aErr }, { data: roles, error: rErr }] = await Promise.all([
      supabaseAdmin.from("user_approvals").select("user_id, status, approved_at"),
      supabaseAdmin.from("user_roles").select("user_id, role"),
    ]);
    if (aErr) throw new Error(aErr.message);
    if (rErr) throw new Error(rErr.message);

    const adminIds = new Set(
      (roles ?? []).filter((r: any) => r.role === "admin").map((r: any) => r.user_id as string),
    );
    const apprMap = new Map(
      (approvals ?? []).map((a: any) => [a.user_id as string, a]),
    );

    const users: ManagedUser[] = [];
    let page = 1;
    while (page < 20) {
      const { data: usersPage, error: uErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (uErr) throw new Error(uErr.message);
      for (const u of usersPage.users) {
        const a = apprMap.get(u.id) as any;
        const meta = (u.user_metadata as Record<string, unknown> | null) ?? {};
        users.push({
          user_id: u.id,
          email: u.email ?? null,
          phone:
            (meta as any).phone ??
            (u.phone as string | undefined) ??
            null,
          first_name: (meta.first_name as string | undefined) ?? null,
          last_name: (meta.last_name as string | undefined) ?? null,
          created_at: u.created_at,
          status: (a?.status as ManagedUser["status"]) ?? "pending",
          approved_at: (a?.approved_at as string | null) ?? null,
          is_admin: adminIds.has(u.id),
        });
      }
      if (usersPage.users.length < 1000) break;
      page += 1;
    }
    users.sort((a, b) => {
      const order = { pending: 0, approved: 1, rejected: 2 } as const;
      if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
      return b.created_at.localeCompare(a.created_at);
    });
    return users;
  });

export const setUserApproval = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; status: "pending" | "approved" | "rejected" }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("user_approvals").upsert(
      {
        user_id: data.userId,
        status: data.status,
        approved_at: data.status === "approved" ? new Date().toISOString() : null,
        approved_by: data.status === "approved" ? context.userId : null,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setUserAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; isAdmin: boolean }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (!data.isAdmin && data.userId === context.userId) {
      throw new Error("Du kan inte ta bort din egen adminroll");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.isAdmin) {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.userId, role: "admin" }, { onConflict: "user_id,role" });
      if (error) throw new Error(error.message);
      // Admins are auto-approved
      await supabaseAdmin.from("user_approvals").upsert(
        {
          user_id: data.userId,
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: context.userId,
        },
        { onConflict: "user_id" },
      );
    } else {
      const { error } = await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.userId)
        .eq("role", "admin");
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deleteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    if (data.userId === context.userId) {
      throw new Error("Du kan inte ta bort dig själv");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const createManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { email: string; password: string; phone?: string; firstName?: string; lastName?: string; approve?: boolean; makeAdmin?: boolean }) => {
      const email = (d.email ?? "").trim();
      const password = d.password ?? "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ogiltig e-post");
      if (password.length < 6) throw new Error("Lösenord måste vara minst 6 tecken");
      const phone = (d.phone ?? "").trim();
      const firstName = (d.firstName ?? "").trim();
      const lastName = (d.lastName ?? "").trim();
      return {
        email,
        password,
        phone: phone || undefined,
        firstName: firstName || undefined,
        lastName: lastName || undefined,
        approve: d.approve !== false,
        makeAdmin: Boolean(d.makeAdmin),
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const metadata: Record<string, unknown> = {};
    if (data.phone) metadata.phone = data.phone;
    if (data.firstName) metadata.first_name = data.firstName;
    if (data.lastName) metadata.last_name = data.lastName;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: metadata,
    });
    if (error) throw new Error(error.message);
    const newId = created.user?.id;
    if (!newId) throw new Error("Kunde inte skapa användare");
    if (data.approve || data.makeAdmin) {
      await supabaseAdmin.from("user_approvals").upsert(
        {
          user_id: newId,
          status: "approved",
          approved_at: new Date().toISOString(),
          approved_by: context.userId,
        },
        { onConflict: "user_id" },
      );
    }
    if (data.makeAdmin) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newId, role: "admin" }, { onConflict: "user_id,role" });
    }
    return { ok: true, userId: newId };
  });

export const updateManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { userId: string; email?: string; phone?: string; firstName?: string; lastName?: string; password?: string }) => {
      if (!d.userId) throw new Error("userId krävs");
      const email = d.email?.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ogiltig e-post");
      const password = d.password ?? "";
      if (password && password.length < 6) throw new Error("Lösenord måste vara minst 6 tecken");
      return {
        userId: d.userId,
        email: email || undefined,
        phone: d.phone !== undefined ? d.phone.trim() : undefined,
        firstName: d.firstName !== undefined ? d.firstName.trim() : undefined,
        lastName: d.lastName !== undefined ? d.lastName.trim() : undefined,
        password: password || undefined,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing, error: getErr } = await supabaseAdmin.auth.admin.getUserById(data.userId);
    if (getErr) throw new Error(getErr.message);
    const currentMeta = (existing.user?.user_metadata as Record<string, unknown> | null) ?? {};
    const updates: Record<string, unknown> = {};
    if (data.email) updates.email = data.email;
    if (data.password) updates.password = data.password;
    if (data.phone !== undefined || data.firstName !== undefined || data.lastName !== undefined) {
      const nextMeta: Record<string, unknown> = { ...currentMeta };
      if (data.phone !== undefined) nextMeta.phone = data.phone || null;
      if (data.firstName !== undefined) nextMeta.first_name = data.firstName || null;
      if (data.lastName !== undefined) nextMeta.last_name = data.lastName || null;
      updates.user_metadata = nextMeta;
    }
    if (Object.keys(updates).length === 0) return { ok: true };
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.userId, updates);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAllTimeEntries = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { from?: string; to?: string } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<AdminEntry[]> => {
    const { data: admin, error: roleErr } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(roleErr.message);
    if (!admin) throw new Error("Forbidden");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    let q = supabaseAdmin
      .from("time_entries")
      .select("id, user_id, description, start_time, end_time, project_id, projects(name, color)")
      .order("start_time", { ascending: false })
      .limit(5000);
    if (data.from) q = q.gte("start_time", data.from);
    if (data.to) q = q.lt("start_time", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Fetch users (paged) to map emails
    const emails = new Map<string, string | null>();
    const firstNames = new Map<string, string | null>();
    const lastNames = new Map<string, string | null>();
    let page = 1;
    while (page < 20) {
      const { data: usersPage, error: uErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (uErr) throw new Error(uErr.message);
      for (const u of usersPage.users) {
        emails.set(u.id, u.email ?? null);
        const meta = (u.user_metadata as Record<string, unknown> | null) ?? {};
        firstNames.set(u.id, (meta.first_name as string | undefined) ?? null);
        lastNames.set(u.id, (meta.last_name as string | undefined) ?? null);
      }
      if (usersPage.users.length < 1000) break;
      page += 1;
    }

    return (rows ?? []).map((r) => {
      const proj = (r as unknown as { projects: { name: string; color: string } | null }).projects;
      return {
        id: r.id as string,
        user_id: r.user_id as string,
        user_email: emails.get(r.user_id as string) ?? null,
        user_first_name: firstNames.get(r.user_id as string) ?? null,
        user_last_name: lastNames.get(r.user_id as string) ?? null,
        start_time: r.start_time as string,
        end_time: (r.end_time as string | null) ?? null,
        description: (r.description as string | null) ?? null,
        project_id: (r.project_id as string | null) ?? null,
        project_name: proj?.name ?? null,
        project_color: proj?.color ?? null,
      };
    });
  });

function validateIsoRange(startIso: string, endIso: string) {
  const s = new Date(startIso);
  const e = new Date(endIso);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) throw new Error("Ogiltigt datum/tid");
  if (e.getTime() <= s.getTime()) throw new Error("Sluttid måste vara efter starttid");
  return { start: s.toISOString(), end: e.toISOString() };
}

export const adminCreateTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      userId: string;
      projectId: string | null;
      description: string | null;
      startIso: string;
      endIso: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { start, end } = validateIsoRange(data.startIso, data.endIso);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      user_id: data.userId,
      project_id: data.projectId,
      description: data.description,
      start_time: start,
      end_time: end,
    };
    const { data: inserted, error } = await supabaseAdmin
      .from("time_entries")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(supabaseAdmin, context, {
      entry_id: inserted?.id ?? null,
      entry_user_id: data.userId,
      action: "create",
      before_data: null,
      after_data: payload,
    });
    return { ok: true };
  });

export const adminUpdateTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      id: string;
      projectId: string | null;
      description: string | null;
      startIso: string;
      endIso: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { start, end } = validateIsoRange(data.startIso, data.endIso);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("time_entries")
      .select("user_id, project_id, description, start_time, end_time")
      .eq("id", data.id)
      .maybeSingle();
    const after = {
      project_id: data.projectId,
      description: data.description,
      start_time: start,
      end_time: end,
    };
    const { error } = await supabaseAdmin
      .from("time_entries")
      .update(after)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(supabaseAdmin, context, {
      entry_id: data.id,
      entry_user_id: (before?.user_id as string | undefined) ?? null,
      action: "update",
      before_data: before ?? null,
      after_data: after,
    });
    return { ok: true };
  });

export const adminDeleteTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("time_entries")
      .select("user_id, project_id, description, start_time, end_time")
      .eq("id", data.id)
      .maybeSingle();
    const { error } = await supabaseAdmin.from("time_entries").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(supabaseAdmin, context, {
      entry_id: data.id,
      entry_user_id: (before?.user_id as string | undefined) ?? null,
      action: "delete",
      before_data: before ?? null,
      after_data: null,
    });
    return { ok: true };
  });

export type UserEntry = {
  id: string;
  description: string | null;
  start_time: string;
  end_time: string | null;
  project_id: string | null;
  projects: { name: string; color: string } | null;
};

export const adminListEntriesForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }): Promise<UserEntry[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("time_entries")
      .select("id, description, start_time, end_time, project_id, projects(name, color)")
      .eq("user_id", data.userId)
      .order("start_time", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (rows ?? []) as unknown as UserEntry[];
  });

export const adminStartTimer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; projectId: string | null; description: string | null }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = {
      user_id: data.userId,
      project_id: data.projectId,
      description: data.description,
      start_time: new Date().toISOString(),
    };
    const { data: inserted, error } = await supabaseAdmin
      .from("time_entries")
      .insert(payload)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await logAudit(supabaseAdmin, context, {
      entry_id: inserted?.id ?? null,
      entry_user_id: data.userId,
      action: "create",
      before_data: null,
      after_data: payload,
    });
    return { ok: true };
  });

export const adminStopTimer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: before } = await supabaseAdmin
      .from("time_entries")
      .select("user_id, project_id, description, start_time, end_time")
      .eq("id", data.id)
      .maybeSingle();
    const after = { end_time: new Date().toISOString() };
    const { error } = await supabaseAdmin
      .from("time_entries")
      .update(after)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logAudit(supabaseAdmin, context, {
      entry_id: data.id,
      entry_user_id: (before?.user_id as string | undefined) ?? null,
      action: "update",
      before_data: before ?? null,
      after_data: { ...(before ?? {}), ...after },
    });
    return { ok: true };
  });

async function logAudit(
  supabaseAdmin: any,
  context: { userId: string; claims?: any },
  payload: {
    entry_id: string | null;
    entry_user_id: string | null;
    action: "create" | "update" | "delete";
    before_data: Json | null;
    after_data: Json | null;
  },
) {
  const changedByEmail =
    (context.claims?.email as string | undefined) ?? null;
  await supabaseAdmin.from("time_entry_audit").insert({
    entry_id: payload.entry_id,
    entry_user_id: payload.entry_user_id,
    action: payload.action,
    changed_by: context.userId,
    changed_by_email: changedByEmail,
    before_data: payload.before_data,
    after_data: payload.after_data,
  });
}

export const adminCopyTimeEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { entryIds: string[]; targetUserIds: string[]; mode: "copy" | "move" }) => {
      if (!Array.isArray(d.entryIds) || d.entryIds.length === 0)
        throw new Error("Inga tidsposter valda");
      if (!Array.isArray(d.targetUserIds) || d.targetUserIds.length === 0)
        throw new Error("Välj minst en mottagare");
      if (d.mode !== "copy" && d.mode !== "move")
        throw new Error("Ogiltigt läge");
      if (d.mode === "move" && d.targetUserIds.length !== 1)
        throw new Error("Flytta stöder endast en mottagare");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Validate target users are approved (or admins)
    const [{ data: approvals }, { data: roles }] = await Promise.all([
      supabaseAdmin
        .from("user_approvals")
        .select("user_id, status")
        .in("user_id", data.targetUserIds),
      supabaseAdmin
        .from("user_roles")
        .select("user_id, role")
        .in("user_id", data.targetUserIds),
    ]);
    const approvedSet = new Set(
      ((approvals as any[]) ?? [])
        .filter((a) => a.status === "approved")
        .map((a) => a.user_id as string),
    );
    for (const r of (roles as any[]) ?? []) {
      if (r.role === "admin") approvedSet.add(r.user_id as string);
    }
    for (const uid of data.targetUserIds) {
      if (!approvedSet.has(uid)) throw new Error("Mottagare är inte godkänd");
    }

    const { data: sourceRows, error: srcErr } = await supabaseAdmin
      .from("time_entries")
      .select("id, user_id, project_id, description, start_time, end_time")
      .in("id", data.entryIds);
    if (srcErr) throw new Error(srcErr.message);
    if (!sourceRows || sourceRows.length === 0)
      throw new Error("Källposter hittades inte");

    let created = 0;
    let moved = 0;

    if (data.mode === "copy") {
      for (const targetId of data.targetUserIds) {
        const inserts = sourceRows.map((r: any) => ({
          user_id: targetId,
          project_id: r.project_id,
          description: r.description,
          start_time: r.start_time,
          end_time: r.end_time,
        }));
        const { data: inserted, error } = await supabaseAdmin
          .from("time_entries")
          .insert(inserts)
          .select("id");
        if (error) throw new Error(error.message);
        created += inserted?.length ?? 0;
        for (let i = 0; i < (inserted?.length ?? 0); i++) {
          const src = sourceRows[i] as any;
          const ins = inserted![i] as any;
          await logAudit(supabaseAdmin, context, {
            entry_id: ins.id,
            entry_user_id: targetId,
            action: "create",
            before_data: null,
            after_data: {
              ...inserts[i],
              copied_from_entry_id: src.id,
              copied_from_user_id: src.user_id,
            },
          });
        }
      }
    } else {
      const targetId = data.targetUserIds[0];
      for (const r of sourceRows as any[]) {
        if (r.user_id === targetId) continue;
        const { error } = await supabaseAdmin
          .from("time_entries")
          .update({ user_id: targetId })
          .eq("id", r.id);
        if (error) throw new Error(error.message);
        moved += 1;
        await logAudit(supabaseAdmin, context, {
          entry_id: r.id,
          entry_user_id: targetId,
          action: "update",
          before_data: {
            user_id: r.user_id,
            project_id: r.project_id,
            description: r.description,
            start_time: r.start_time,
            end_time: r.end_time,
          },
          after_data: {
            user_id: targetId,
            project_id: r.project_id,
            description: r.description,
            start_time: r.start_time,
            end_time: r.end_time,
            moved_from_user_id: r.user_id,
          },
        });
      }
    }

    return { ok: true, created, moved };
  });

export const getAuditLog = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number } | undefined) => d ?? {})
  .handler(async ({ data, context }): Promise<AuditLogEntry[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin
      .from("time_entry_audit")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(Math.min(data.limit ?? 500, 2000));
    if (error) throw new Error(error.message);

    const emails = new Map<string, string | null>();
    let page = 1;
    while (page < 20) {
      const { data: usersPage, error: uErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (uErr) throw new Error(uErr.message);
      for (const u of usersPage.users) emails.set(u.id, u.email ?? null);
      if (usersPage.users.length < 1000) break;
      page += 1;
    }

    return (rows ?? []).map((r: any) => ({
      id: r.id,
      entry_id: r.entry_id,
      entry_user_id: r.entry_user_id,
      entry_user_email: r.entry_user_id ? emails.get(r.entry_user_id) ?? null : null,
      action: r.action,
      changed_by: r.changed_by,
      changed_by_email: r.changed_by_email ?? emails.get(r.changed_by) ?? null,
      before_data: r.before_data,
      after_data: r.after_data,
      created_at: r.created_at,
    }));
  });

export type SummaryFilters = {
  from: string; // ISO date YYYY-MM-DD inclusive
  to: string;   // ISO date YYYY-MM-DD inclusive
  fromTime?: string | null; // "HH:MM"
  toTime?: string | null;   // "HH:MM"; "00:00" or null = end of day
  userId?: string | null;
  clientId?: string | null;
  projectId?: string | null;
};

export type SummaryRow = {
  key: string;
  label: string;
  sublabel?: string | null;
  color?: string | null;
  ms: number;
  count: number;
  normalMs?: number;
  ob1Ms?: number;
  ob2Ms?: number;
  ob3Ms?: number;
  amount?: number;
  billing?: number;
};

export type SummaryResult = {
  totalMs: number;
  totalCount: number;
  totalNormalMs: number;
  totalOb1Ms: number;
  totalOb2Ms: number;
  totalOb3Ms: number;
  totalAmount: number;
  totalBilling: number;
  perClient: SummaryRow[];
  perProject: SummaryRow[];
  perUser: SummaryRow[];
};

export type UserWage = {
  user_id: string;
  hourly_rate: number;
  ob1_pct: number;
  ob2_pct: number;
  ob3_pct: number;
};

export const getUserWage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data, context }): Promise<UserWage> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row, error } = await supabaseAdmin
      .from("user_wages" as any)
      .select("*")
      .eq("user_id", data.userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    const r = row as any;
    return {
      user_id: data.userId,
      hourly_rate: Number(r?.hourly_rate ?? 0),
      ob1_pct: Number(r?.ob1_pct ?? 0),
      ob2_pct: Number(r?.ob2_pct ?? 0),
      ob3_pct: Number(r?.ob3_pct ?? 0),
    };
  });

export const upsertUserWage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: UserWage) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin.from("user_wages" as any) as any).upsert(
      {
        user_id: data.user_id,
        hourly_rate: data.hourly_rate,
        ob1_pct: data.ob1_pct,
        ob2_pct: data.ob2_pct,
        ob3_pct: data.ob3_pct,
      },
      { onConflict: "user_id" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: SummaryFilters) => d)
  .handler(async ({ data, context }): Promise<SummaryResult> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const fromTime = data.fromTime && /^\d{2}:\d{2}$/.test(data.fromTime) ? data.fromTime : "00:00";
    const fromIso = new Date(`${data.from}T${fromTime}:00`).toISOString();
    const hasToTime = data.toTime && /^\d{2}:\d{2}$/.test(data.toTime) && data.toTime !== "00:00";
    const toIso = hasToTime
      ? new Date(`${data.to}T${data.toTime}:00`).toISOString()
      : new Date(new Date(`${data.to}T00:00:00`).getTime() + 24 * 3600 * 1000).toISOString();

    let q = supabaseAdmin
      .from("time_entries")
      .select("id, user_id, start_time, end_time, project_id, projects(id, name, color, client_id, client, clients(id, name, hourly_rate))")
      .gte("start_time", fromIso)
      .lt("start_time", toIso)
      .not("end_time", "is", null)
      .limit(20000);
    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.projectId) q = q.eq("project_id", data.projectId);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Filter by clientId in memory (joined column)
    const filtered = (rows ?? []).filter((r: any) => {
      if (!data.clientId) return true;
      const cid = r.projects?.client_id ?? null;
      return cid === data.clientId;
    });

    // Collect user ids and resolve emails
    const userIds = new Set<string>(filtered.map((r: any) => r.user_id as string));
    const emails = new Map<string, string | null>();
    if (userIds.size > 0) {
      let page = 1;
      while (page < 20) {
        const { data: usersPage, error: uErr } = await supabaseAdmin.auth.admin.listUsers({
          page,
          perPage: 1000,
        });
        if (uErr) throw new Error(uErr.message);
        for (const u of usersPage.users) emails.set(u.id, u.email ?? null);
        if (usersPage.users.length < 1000) break;
        page += 1;
      }
    }

    // Load OB rules + wages for the involved users
    const [{ data: ruleRows }, { data: wageRows }] = await Promise.all([
      (supabaseAdmin.from("ob_rules" as any) as any).select("*").eq("active", true),
      (supabaseAdmin.from("user_wages" as any) as any)
        .select("*")
        .in("user_id", Array.from(userIds)),
    ]);
    const rules = ((ruleRows as any[]) ?? []) as ObRule[];
    const wages = new Map<string, Wage>();
    for (const w of ((wageRows as any[]) ?? [])) {
      wages.set(w.user_id as string, {
        hourly_rate: Number(w.hourly_rate ?? 0),
        ob1_pct: Number(w.ob1_pct ?? 0),
        ob2_pct: Number(w.ob2_pct ?? 0),
        ob3_pct: Number(w.ob3_pct ?? 0),
      });
    }
    const emptySplit = (): ObSplit => ({ normalMs: 0, ob1Ms: 0, ob2Ms: 0, ob3Ms: 0 });
    const addInto = (row: SummaryRow, s: ObSplit, amount: number, billing: number) => {
      row.normalMs = (row.normalMs ?? 0) + s.normalMs;
      row.ob1Ms = (row.ob1Ms ?? 0) + s.ob1Ms;
      row.ob2Ms = (row.ob2Ms ?? 0) + s.ob2Ms;
      row.ob3Ms = (row.ob3Ms ?? 0) + s.ob3Ms;
      row.amount = (row.amount ?? 0) + amount;
      row.billing = (row.billing ?? 0) + billing;
    };

    const perClient = new Map<string, SummaryRow>();
    const perProject = new Map<string, SummaryRow>();
    const perUser = new Map<string, SummaryRow>();
    let totalMs = 0;
    let totalCount = 0;
    const totalSplit = emptySplit();
    let totalAmount = 0;
    let totalBilling = 0;

    for (const r of filtered as any[]) {
      const ms = new Date(r.end_time).getTime() - new Date(r.start_time).getTime();
      if (ms <= 0) continue;
      totalMs += ms;
      totalCount += 1;
      const split = splitEntryByOb(r.start_time as string, r.end_time as string, rules);
      const wage = wages.get(r.user_id as string) ?? { hourly_rate: 0, ob1_pct: 0, ob2_pct: 0, ob3_pct: 0 };
      const amount = computePay(split, wage);
      totalSplit.normalMs += split.normalMs;
      totalSplit.ob1Ms += split.ob1Ms;
      totalSplit.ob2Ms += split.ob2Ms;
      totalSplit.ob3Ms += split.ob3Ms;
      totalAmount += amount;

      const proj = r.projects ?? null;
      const clientObj = proj?.clients ?? null;
      const clientRate = Number(clientObj?.hourly_rate ?? 0);
      const billing = (ms / 3600000) * clientRate;
      totalBilling += billing;
      const clientKey = clientObj?.id ?? proj?.client ?? "__none__";
      const clientLabel = clientObj?.name ?? proj?.client ?? "Ingen kund";
      const pc = perClient.get(clientKey);
      if (pc) { pc.ms += ms; pc.count += 1; addInto(pc, split, amount, billing); }
      else {
        const row: SummaryRow = { key: clientKey, label: clientLabel, ms, count: 1 };
        addInto(row, split, amount, billing);
        perClient.set(clientKey, row);
      }

      const projKey = proj?.id ?? "__none__";
      const projLabel = proj?.name ?? "Inget projekt";
      const pp = perProject.get(projKey);
      if (pp) { pp.ms += ms; pp.count += 1; addInto(pp, split, amount, billing); }
      else {
        const row: SummaryRow = {
          key: projKey, label: projLabel, sublabel: clientLabel,
          color: proj?.color ?? null, ms, count: 1,
        };
        addInto(row, split, amount, billing);
        perProject.set(projKey, row);
      }

      const uid = r.user_id as string;
      const pu = perUser.get(uid);
      if (pu) { pu.ms += ms; pu.count += 1; addInto(pu, split, amount, billing); }
      else {
        const row: SummaryRow = { key: uid, label: emails.get(uid) ?? uid, ms, count: 1 };
        addInto(row, split, amount, billing);
        perUser.set(uid, row);
      }
    }

    const sortDesc = (a: SummaryRow, b: SummaryRow) => b.ms - a.ms;
    return {
      totalMs,
      totalCount,
      totalNormalMs: totalSplit.normalMs,
      totalOb1Ms: totalSplit.ob1Ms,
      totalOb2Ms: totalSplit.ob2Ms,
      totalOb3Ms: totalSplit.ob3Ms,
      totalAmount,
      totalBilling,
      perClient: Array.from(perClient.values()).sort(sortDesc),
      perProject: Array.from(perProject.values()).sort(sortDesc),
      perUser: Array.from(perUser.values()).sort(sortDesc),
    };
  });