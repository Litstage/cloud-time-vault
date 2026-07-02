import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden");
}

export type TaxTableSummary = {
  id: string;
  year: number;
  table_number: number;
  period: string;
  source_url: string | null;
  imported_at: string;
  row_count: number;
};

export const listTaxTables = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<TaxTableSummary[]> => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tables, error } = await supabaseAdmin
      .from("tax_tables" as any)
      .select("*")
      .order("year", { ascending: false })
      .order("table_number", { ascending: true });
    if (error) throw new Error(error.message);
    const list = ((tables as any[]) ?? []);
    const ids = list.map((t) => t.id as string);
    const counts = new Map<string, number>();
    if (ids.length > 0) {
      const { data: rows, error: rErr } = await supabaseAdmin
        .from("tax_table_rows" as any)
        .select("tax_table_id")
        .in("tax_table_id", ids);
      if (rErr) throw new Error(rErr.message);
      for (const r of ((rows as any[]) ?? [])) {
        const k = r.tax_table_id as string;
        counts.set(k, (counts.get(k) ?? 0) + 1);
      }
    }
    return list.map((t: any) => ({
      id: t.id,
      year: t.year,
      table_number: t.table_number,
      period: t.period,
      source_url: t.source_url ?? null,
      imported_at: t.imported_at,
      row_count: counts.get(t.id) ?? 0,
    }));
  });

// Parse a CSV/TSV with columns: income_from, income_to, col1..col6.
// Accepts ',', ';' or tab as separator. Header row optional.
function parseTaxCsv(csv: string): {
  rows: Array<{
    income_from: number;
    income_to: number;
    col1: number;
    col2: number;
    col3: number;
    col4: number;
    col5: number;
    col6: number;
  }>;
  skipped: number;
} {
  const out: any[] = [];
  let skipped = 0;
  const lines = csv.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const parts = line.split(/[;,\t]/).map((p) => p.trim().replace(/\s+/g, ""));
    if (parts.length < 8) {
      skipped += 1;
      continue;
    }
    const nums = parts.slice(0, 8).map((p) => Number(p.replace(/[^0-9-]/g, "")));
    if (nums.some((n) => !Number.isFinite(n))) {
      skipped += 1;
      continue;
    }
    const [income_from, income_to, col1, col2, col3, col4, col5, col6] = nums;
    if (income_from <= 0 || income_to < income_from) {
      skipped += 1;
      continue;
    }
    out.push({ income_from, income_to, col1, col2, col3, col4, col5, col6 });
  }
  return { rows: out, skipped };
}

export const importTaxTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: {
      year: number;
      tableNumber: number;
      period?: "month" | "week";
      sourceUrl?: string | null;
      csv: string;
    }) => {
      if (!Number.isInteger(d.year) || d.year < 2000 || d.year > 2100) {
        throw new Error("Ogiltigt år");
      }
      if (!Number.isInteger(d.tableNumber) || d.tableNumber < 29 || d.tableNumber > 40) {
        throw new Error("Skattetabellnummer måste vara 29–40");
      }
      if (!d.csv || d.csv.length < 10) throw new Error("Tom eller ogiltig CSV");
      return {
        year: d.year,
        tableNumber: d.tableNumber,
        period: d.period ?? "month",
        sourceUrl: d.sourceUrl ?? null,
        csv: d.csv,
      };
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const parsed = parseTaxCsv(data.csv);
    if (parsed.rows.length === 0) throw new Error("Inga giltiga rader hittades i CSV");

    const { data: upserted, error: tErr } = await supabaseAdmin
      .from("tax_tables" as any)
      .upsert(
        {
          year: data.year,
          table_number: data.tableNumber,
          period: data.period,
          source_url: data.sourceUrl,
          imported_at: new Date().toISOString(),
        },
        { onConflict: "year,table_number,period" },
      )
      .select("id")
      .single();
    if (tErr) throw new Error(tErr.message);
    const tableId = (upserted as any).id as string;

    // Replace existing rows
    const { error: delErr } = await supabaseAdmin
      .from("tax_table_rows" as any)
      .delete()
      .eq("tax_table_id", tableId);
    if (delErr) throw new Error(delErr.message);

    const inserts = parsed.rows.map((r) => ({ tax_table_id: tableId, ...r }));
    // Insert in chunks to avoid payload limits
    const chunkSize = 500;
    for (let i = 0; i < inserts.length; i += chunkSize) {
      const { error } = await supabaseAdmin
        .from("tax_table_rows" as any)
        .insert(inserts.slice(i, i + chunkSize));
      if (error) throw new Error(error.message);
    }
    return { ok: true, inserted: inserts.length, skipped: parsed.skipped };
  });

export const deleteTaxTable = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("tax_tables" as any)
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const fetchTaxTableFromSkatteverket = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (d: { year: number; tableNumber: number; url?: string }) => {
      if (!Number.isInteger(d.year)) throw new Error("Ogiltigt år");
      if (!Number.isInteger(d.tableNumber)) throw new Error("Ogiltigt tabellnummer");
      return d;
    },
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    // Skatteverket has no stable public URL for CSVs — we let the admin pass one
    // if they've located it, otherwise return a message so the UI can prompt for a manual paste.
    if (!data.url) {
      throw new Error(
        "Ingen automatisk nedladdning från Skatteverket. Ladda ner tabellen från skatteverket.se och klistra in CSV-innehållet.",
      );
    }
    const res = await fetch(data.url, { headers: { "user-agent": "tider.litstage.se" } });
    if (!res.ok) throw new Error(`Nedladdning misslyckades (${res.status})`);
    const text = await res.text();
    return { csv: text };
  });