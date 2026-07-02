import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({ meta: [{ title: "Logga in – Tidskoll" }] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        const meta: Record<string, string> = {};
        if (phone.trim()) meta.phone = phone.trim();
        if (firstName.trim()) meta.first_name = firstName.trim();
        if (lastName.trim()) meta.last_name = lastName.trim();
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: meta,
          },
        });
        if (error) throw error;
        toast.success("Konto skapat! Kolla din e-post om bekräftelse krävs.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Något gick fel");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
            <Clock className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Tidskoll</h1>
          <p className="mt-1 text-sm text-muted-foreground">Tidsregistrering i molnet</p>
        </div>
        <Card className="p-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">E-post</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            {mode === "signup" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">Förnamn</Label>
                    <Input
                      id="firstName"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      autoComplete="given-name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Efternamn</Label>
                    <Input
                      id="lastName"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      autoComplete="family-name"
                    />
                  </div>
                </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefonnummer</Label>
                <Input
                  id="phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                  placeholder="+46 70 123 45 67"
                />
              </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Lösenord</Label>
              <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === "signup" ? "new-password" : "current-password"} />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Vänta…" : mode === "signin" ? "Logga in" : "Skapa konto"}
            </Button>
          </form>
          <button
            type="button"
            onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
            className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-foreground"
          >
            {mode === "signin" ? "Inget konto? Skapa ett" : "Har du konto? Logga in"}
          </button>
        </Card>
      </div>
    </div>
  );
}