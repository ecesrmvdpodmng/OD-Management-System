"use server";

import "server-only";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function promoteAllStudentsAction(): Promise<{ ok: true; promoted: number } | { ok: false; message: string }> {
  try {
    await requireAdmin();
    const db = await createSupabaseServerClient();
    const { data, error } = await db.rpc("admin_promote_students_next_year");
    if (error) {
      console.error("[admin:promote-students]", { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return { ok: false, message: "Student years could not be updated. Confirm the latest database migration is applied." };
    }
    for (const path of ["/admin/students", "/admin/users", "/student/dashboard"]) revalidatePath(path);
    return { ok: true, promoted: Number(data ?? 0) };
  } catch (error) {
    console.error("[admin:promote-students] authorization or request failed", error instanceof Error ? error.message : "unknown error");
    return { ok: false, message: error instanceof Error ? error.message : "Students could not be promoted." };
  }
}

export async function wipeODWorkflowDataAction(): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    await requireAdmin();
    const db = await createSupabaseServerClient();
    const { error } = await db.rpc("admin_wipe_od_workflow_data");
    if (error) {
      console.error("[admin:wipe-od-workflow]", { code: error.code, message: error.message, details: error.details, hint: error.hint });
      return { ok: false, message: "OD workflow data could not be cleared. Confirm the latest database migration is applied." };
    }
    for (const path of ["/admin/dashboard", "/admin/students", "/admin/users", "/student/dashboard", "/student/applications", "/faculty/dashboard", "/faculty/approvals", "/faculty/attendance", "/hod/dashboard", "/hod/approvals"]) revalidatePath(path);
    return { ok: true };
  } catch (error) {
    console.error("[admin:wipe-od-workflow] authorization or request failed", error instanceof Error ? error.message : "unknown error");
    return { ok: false, message: error instanceof Error ? error.message : "OD workflow data could not be cleared." };
  }
}
