import React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { assignAdminRole } from "@/lib/admin-functions";

export const Route = createFileRoute("/_authenticated/setup-admin")({
  component: SetupAdminPage,
});

function SetupAdminPage() {
  const navigate = useNavigate();
  const assignRole = useServerFn(assignAdminRole);
  const [session, setSession] = React.useState<any>(null);

  React.useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
  }, []);

  const handleAssignAdmin = async () => {
    if (!session?.user?.email) {
      alert("You must be logged in");
      return;
    }

    if (session.user.email !== "redmi.v1990@gmail.com") {
      alert("Only redmi.v1990@gmail.com can use this setup");
      return;
    }

    try {
      const result = await assignRole({ data: { email: session.user.email } });
      alert(result.message);
      navigate({ to: "/admin/plans" });
    } catch (error) {
      alert("Failed to assign admin role: " + (error as Error).message);
    }
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border p-8">
          <h1 className="font-display text-2xl font-bold">Admin Setup</h1>
          <p className="mt-4 text-muted-foreground">
            This page is for one-time admin role assignment.
          </p>

          {session?.user?.email === "redmi.v1990@gmail.com" ? (
            <div className="mt-6">
              <p className="mb-4 text-sm">
                Signed in as: <span className="font-semibold">{session.user.email}</span>
              </p>
              <button
                onClick={handleAssignAdmin}
                className="w-full rounded-xl bg-primary px-4 py-3 font-semibold text-primary-foreground"
              >
                Assign Admin Role
              </button>
            </div>
          ) : (
            <div className="mt-6">
              <p className="text-sm text-destructive">
                Only redmi.v1990@gmail.com can access this page.
              </p>
            </div>
          )}

          <button
            onClick={() => navigate({ to: "/dashboard" })}
            className="mt-4 w-full rounded-xl border px-4 py-3 font-semibold"
          >
            Back to Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
