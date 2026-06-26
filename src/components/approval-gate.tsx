import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, ShieldAlert, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "@tanstack/react-router";
import { getMyApprovalStatus } from "@/lib/admin.functions";

export function ApprovalGate({ children }: { children: ReactNode }) {
  const fetchStatus = useServerFn(getMyApprovalStatus);
  const navigate = useNavigate();
  const q = useQuery({
    queryKey: ["my-approval-status"],
    queryFn: () => fetchStatus({ data: undefined }),
    staleTime: 30_000,
  });

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (q.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-sm text-muted-foreground">
        Laddar…
      </div>
    );
  }

  if (q.data?.approved) return <>{children}</>;

  const rejected = q.data?.status === "rejected";

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Card className="max-w-md w-full p-6 text-center space-y-4">
        {rejected ? (
          <ShieldAlert className="mx-auto h-10 w-10 text-destructive" />
        ) : (
          <Clock className="mx-auto h-10 w-10 text-primary" />
        )}
        <h1 className="text-lg font-semibold">
          {rejected ? "Åtkomst nekad" : "Väntar på godkännande"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {rejected
            ? "Ditt konto har inte godkänts av administratören. Kontakta din admin om du tror att detta är ett misstag."
            : "Ditt konto har skapats men måste godkännas av en administratör innan du kan börja registrera tid. Du får tillgång så snart en admin godkänner dig."}
        </p>
        <div className="flex justify-center gap-2 pt-2">
          <Button variant="outline" onClick={() => q.refetch()} disabled={q.isFetching}>
            Uppdatera status
          </Button>
          <Button variant="ghost" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Logga ut
          </Button>
        </div>
      </Card>
    </div>
  );
}