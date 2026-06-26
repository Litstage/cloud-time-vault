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