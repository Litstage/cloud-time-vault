import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { isAdmin } from "@/lib/admin.functions";
import { listTaxTables, importTaxTable, deleteTaxTable } from "@/lib/tax.functions";

export const Route = createFileRoute("/_authenticated/admin-tax-tables")({
  head: () => ({ meta: [{ title: "Skattetabeller – Admin" }] }),
  component: TaxTablesPage,
});

function TaxTablesPage() {
  const checkAdmin = useServerFn(isAdmin);
  const list = useServerFn(listTaxTables);
  const importFn = useServerFn(importTaxTable);
  const del = useServerFn(deleteTaxTable);
  const qc = useQueryClient();

  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => checkAdmin({ data: undefined }) });
  const tablesQ = useQuery({
    queryKey: ["tax-tables"],
    enabled: !!adminQ.data?.isAdmin,
    queryFn: () => list({ data: undefined }),
  });

  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [tableNumber, setTableNumber] = useState("32");
  const [sourceUrl, setSourceUrl] = useState("");
  const [csv, setCsv] = useState("");

  const importMut = useMutation({
    mutationFn: (v: { year: number; tableNumber: number; sourceUrl: string; csv: string }) =>
      importFn({ data: { year: v.year, tableNumber: v.tableNumber, sourceUrl: v.sourceUrl || null, csv: v.csv } }),
    onSuccess: (res: { inserted: number; skipped: number }) => {
      toast.success(`Importerade ${res.inserted} rader (${res.skipped} hoppade över)`);
      setCsv("");
      qc.invalidateQueries({ queryKey: ["tax-tables"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Tabell borttagen");
      qc.invalidateQueries({ queryKey: ["tax-tables"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function onFile(f: File | null) {
    if (!f) return;
    const text = await f.text();
    setCsv(text);
  }

  return (
    <div className="min-h-screen bg-background pb-12">
      <header className="sticky top-0 z-10 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center gap-2 px-4 py-3">
          <Button asChild variant="ghost" size="icon">
            <Link to="/admin"><ArrowLeft className="h-5 w-5" /></Link>
          </Button>
          <h1 className="text-lg font-semibold tracking-tight">Skattetabeller</h1>
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
            <Card className="space-y-4 p-4">
              <div>
                <h2 className="text-sm font-medium">Importera Skatteverkets månadstabell</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ladda ner tabellen från{" "}
                  <a
                    href="https://www.skatteverket.se/foretag/arbetsgivare/loneradgivning/skattetabeller.4.361dc8c15312eff6fd11f95.html"
                    target="_blank"
                    rel="noreferrer"
                    className="underline"
                  >
                    skatteverket.se
                  </a>{" "}
                  och klistra in eller ladda upp CSV-innehållet. Format per rad:
                  {" "}
                  <code>inkomst_från;inkomst_till;kol1;kol2;kol3;kol4;kol5;kol6</code>.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">År</Label>
                  <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Tabell (29–40)</Label>
                  <Input type="number" min={29} max={40} value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} />
                </div>
                <div className="space-y-1 sm:col-span-1">
                  <Label className="text-xs">Käll-URL (valfri)</Label>
                  <Input type="url" value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)} placeholder="https://…" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">CSV-innehåll</Label>
                <Textarea
                  rows={8}
                  value={csv}
                  onChange={(e) => setCsv(e.target.value)}
                  placeholder="1;1900;0;0;0;0;0;0&#10;1901;2000;10;15;5;20;30;40&#10;…"
                  className="font-mono text-xs"
                />
                <div className="flex items-center gap-2 pt-1">
                  <Input
                    type="file"
                    accept=".csv,.txt,text/csv"
                    onChange={(e) => onFile(e.target.files?.[0] ?? null)}
                    className="max-w-xs"
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  disabled={importMut.isPending || !csv.trim()}
                  onClick={() =>
                    importMut.mutate({
                      year: Number(year) || 0,
                      tableNumber: Number(tableNumber) || 0,
                      sourceUrl,
                      csv,
                    })
                  }
                >
                  <Upload className="mr-2 h-4 w-4" /> Importera
                </Button>
              </div>
            </Card>

            <section className="space-y-2">
              <h2 className="px-1 text-sm font-medium text-muted-foreground">
                Importerade tabeller ({tablesQ.data?.length ?? 0})
              </h2>
              <Card className="divide-y p-0">
                {tablesQ.isLoading ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Laddar…</div>
                ) : (tablesQ.data ?? []).length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Inga tabeller importerade ännu.</div>
                ) : (
                  (tablesQ.data ?? []).map((t) => (
                    <div key={t.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">
                          Tabell {t.table_number} · {t.year} · {t.period === "month" ? "månad" : "vecka"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {t.row_count} rader · importerad {new Date(t.imported_at).toLocaleString("sv-SE")}
                          {t.source_url && (
                            <>
                              {" · "}
                              <a href={t.source_url} target="_blank" rel="noreferrer" className="underline">
                                källa
                              </a>
                            </>
                          )}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => {
                          if (confirm(`Ta bort tabell ${t.table_number} för ${t.year}?`)) deleteMut.mutate(t.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))
                )}
              </Card>
            </section>
          </>
        )}
      </main>
    </div>
  );
}