import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Assign admin role to a user by email */
export const assignAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: user } = await supabase.auth.admin.listUsers();

    const targetUser = user.users.find((u) => u.email === data.email);
    if (!targetUser) {
      throw new Error("User not found");
    }

    // Check if already admin
    const { data: existing } = await supabase
      .from("user_roles")
      .select("*")
      .eq("user_id", targetUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (existing) {
      return { success: true, message: "User is already an admin" };
    }

    // Assign admin role
    const { error } = await supabase.from("user_roles").insert({
      user_id: targetUser.id,
      role: "admin",
    });

    if (error) {
      throw new Error("Failed to assign admin role");
    }

    return { success: true, message: "Admin role assigned successfully" };
  });

/** Check if current user is admin */
export const isAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabase } = context;

    const { data: role } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    return { isAdmin: !!role };
  });
