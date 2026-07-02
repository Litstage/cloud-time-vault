import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { isAdmin as isAdminFn } from "@/lib/admin.functions";

function AdminBadgeToggle() {
  const checkAdmin = useServerFn(isAdminFn);
  const { data } = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdmin({ data: undefined }),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (data?.isAdmin) {
      document.body.classList.add("admin-user");
    } else {
      document.body.classList.remove("admin-user");
    }
  }, [data?.isAdmin]);

  return null;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => (
    <>
      <AdminBadgeToggle />
      <Outlet />
    </>
  ),
});
