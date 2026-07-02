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
  sample: string[];
  tableNumbersFound: Set<number>;
} {
  const out: any[] = [];
  let skipped = 0;
  const sample: string[] = [];
  const tableNumbersFound = new Set<number>();
  const lines = csv.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    // Split on ; , tab or 2+ spaces. Strip quotes and inner spaces per field.
    const parts = line
      .split(/[;,\t]|\s{2,}/)
      .map((p) => p.trim().replace(/^"|"$/g, "").replace(/\s+/g, ""));
    if (parts.length < 8) {
      if (sample.length < 3) sample.push(line);
      skipped += 1;
      continue;
    }
    const toNum = (s: string) => {
      const cleaned = s.replace(/[^0-9\-]/g, "");
      if (cleaned === "" || cleaned === "-") return NaN;
      return Number(cleaned);
    };
    // Skatteverkets fil har ofta 9 kolumner: tabellnr, från, till, kol1..kol6
    let nums: number[];
    let tableCol: number | null = null;
    if (parts.length >= 9) {
      const withTable = parts.slice(0, 9).map(toNum);
      if (withTable.every((n) => Number.isFinite(n))) {
        tableCol = withTable[0];
        nums = withTable.slice(1);
      } else {
        nums = parts.slice(0, 8).map(toNum);
      }
    } else {
      nums = parts.slice(0, 8).map(toNum);
    }
    if (nums.some((n) => !Number.isFinite(n))) {
      if (sample.length < 3) sample.push(line);
      skipped += 1;
      continue;
    }
    const [income_from, income_to, col1, col2, col3, col4, col5, col6] = nums;
    if (income_from <= 0 || income_to < income_from) {
      if (sample.length < 3) sample.push(line);
      skipped += 1;
      continue;
    }
    if (tableCol != null) tableNumbersFound.add(tableCol);
    out.push({ income_from, income_to, col1, col2, col3, col4, col5, col6, __table: tableCol });
  }
  return { rows: out, skipped, sample, tableNumbersFound };
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
    // If the file contains multiple tables (Skatteverket-format med tabellnr i första kolumnen),
    // filtrera på önskad tabell.
    let rows = parsed.rows;
    if (parsed.tableNumbersFound.size > 0) {
      rows = rows.filter((r: any) => r.__table === data.tableNumber);
    }
    if (rows.length === 0) {
      const hint =
        parsed.tableNumbersFound.size > 0
          ? ` Filen innehåller tabellerna ${[...parsed.tableNumbersFound].join(", ")} men inte ${data.tableNumber}.`
          : parsed.sample.length > 0
            ? ` Exempel på rader som inte kunde tolkas: ${parsed.sample.map((s) => `"${s}"`).join(" | ")}`
            : "";
      throw new Error(
        `Inga giltiga rader hittades i CSV. Format per rad: inkomst_från;inkomst_till;kol1;kol2;kol3;kol4;kol5;kol6 (Skatteverkets fil med tabellnr först stöds också).${hint}`,
      );
    }

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

    const inserts = rows.map(({ __table: _t, ...r }: any) => ({ tax_table_id: tableId, ...r }));
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
    // SSRF hardening: only allow HTTPS to skatteverket.se (or subdomains).
    let parsed: URL;
    try {
      parsed = new URL(data.url);
    } catch {
      throw new Error("Ogiltig URL");
    }
    if (parsed.protocol !== "https:") {
      throw new Error("Endast HTTPS-URL:er tillåts");
    }
    const host = parsed.hostname.toLowerCase();
    if (host !== "skatteverket.se" && !host.endsWith(".skatteverket.se")) {
      throw new Error("Endast URL:er på skatteverket.se tillåts");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        headers: { "user-agent": "tider.litstage.se" },
        signal: controller.signal,
        redirect: "error",
      });
    } finally {
      clearTimeout(timeout);
    }
    if (!res.ok) throw new Error(`Nedladdning misslyckades (${res.status})`);
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    if (contentType && !/text\/|csv|octet-stream/.test(contentType)) {
      throw new Error("Oväntad innehållstyp från Skatteverket");
    }
    // Cap response at ~5 MB to avoid unbounded reads.
    const MAX_BYTES = 5 * 1024 * 1024;
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_BYTES) {
      throw new Error("Filen är för stor");
    }
    const text = new TextDecoder("utf-8").decode(buf);
    // Sanity check that the payload looks like CSV/text (has digits and separators).
    if (!/[0-9]/.test(text) || !/[;,\t]/.test(text)) {
      throw new Error("Nedladdad fil ser inte ut som en CSV");
    }
    return { csv: text };
  });