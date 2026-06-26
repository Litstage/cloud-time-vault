import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AdminEntry = {
  id: string;
  user_id: string;
  user_email: string | null;
  start_time: string;
  end_time: string | null;
  description: string | null;
  project_name: string | null;
  project_color: string | null;
};

export type ManagedUser = {
  user_id: string;
  email: string | null;
  phone: string | null;
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
  before_data: Record<string, unknown> | null;
  after_data: Record<string, unknown> | null;
  created_at: string;
};

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
        users.push({
          user_id: u.id,
          email: u.email ?? null,
          phone:
            (u.user_metadata as any)?.phone ??
            (u.phone as string | undefined) ??
            null,
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
    (d: { email: string; password: string; phone?: string; approve?: boolean; makeAdmin?: boolean }) => {
      const email = (d.email ?? "").trim();
      const password = d.password ?? "";
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ogiltig e-post");
      if (password.length < 6) throw new Error("Lösenord måste vara minst 6 tecken");
      const phone = (d.phone ?? "").trim();
      return {
        email,
        password,
        phone: phone || undefined,
        approve: d.approve !== false,
        makeAdmin: Boolean(d.makeAdmin),
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: data.phone ? { phone: data.phone } : {},
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
    (d: { userId: string; email?: string; phone?: string; password?: string }) => {
      if (!d.userId) throw new Error("userId krävs");
      const email = d.email?.trim();
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ogiltig e-post");
      const password = d.password ?? "";
      if (password && password.length < 6) throw new Error("Lösenord måste vara minst 6 tecken");
      return {
        userId: d.userId,
        email: email || undefined,
        phone: d.phone !== undefined ? d.phone.trim() : undefined,
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
    if (data.phone !== undefined) {
      updates.user_metadata = { ...currentMeta, phone: data.phone || null };
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
      .select("id, user_id, description, start_time, end_time, projects(name, color)")
      .order("start_time", { ascending: false })
      .limit(5000);
    if (data.from) q = q.gte("start_time", data.from);
    if (data.to) q = q.lt("start_time", data.to);

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);

    // Fetch users (paged) to map emails
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

    return (rows ?? []).map((r) => {
      const proj = (r as unknown as { projects: { name: string; color: string } | null }).projects;
      return {
        id: r.id as string,
        user_id: r.user_id as string,
        user_email: emails.get(r.user_id as string) ?? null,
        start_time: r.start_time as string,
        end_time: (r.end_time as string | null) ?? null,
        description: (r.description as string | null) ?? null,
        project_name: proj?.name ?? null,
        project_color: proj?.color ?? null,
      };
    });
  });

function computeIsoTimes(dateIso: string, startHHMM: string, endHHMM: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) throw new Error("Ogiltigt datum");
  if (!/^\d{2}:\d{2}$/.test(startHHMM) || !/^\d{2}:\d{2}$/.test(endHHMM))
    throw new Error("Ogiltig tid");
  const startDate = new Date(`${dateIso}T${startHHMM}:00`);
  let endDate = new Date(`${dateIso}T${endHHMM}:00`);
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime()))
    throw new Error("Ogiltigt datum/tid");
  if (endDate.getTime() <= startDate.getTime()) {
    endDate = new Date(endDate.getTime() + 24 * 3600 * 1000);
  }
  return { start: startDate.toISOString(), end: endDate.toISOString() };
}

export const adminCreateTimeEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      userId: string;
      projectId: string | null;
      description: string | null;
      date: string;
      start: string;
      end: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { start, end } = computeIsoTimes(data.date, data.start, data.end);
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
      date: string;
      start: string;
      end: string;
    }) => d,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { start, end } = computeIsoTimes(data.date, data.start, data.end);
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

async function logAudit(
  supabaseAdmin: any,
  context: { userId: string; claims?: any },
  payload: {
    entry_id: string | null;
    entry_user_id: string | null;
    action: "create" | "update" | "delete";
    before_data: Record<string, unknown> | null;
    after_data: Record<string, unknown> | null;
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