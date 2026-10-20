"use server";

import { AppError, publicError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { registerStudentSchema } from "@/lib/validation/auth";

export type AuthActionResult = { ok: true; emailConfirmationRequired?: boolean } | { ok: false; message: string };

export async function registerStudentAction(input: unknown): Promise<AuthActionResult> {
  try {
    const parsed = registerStudentSchema.parse(input);
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signUp({
      email: parsed.email.toLowerCase(), password: parsed.password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "https://od-management.srmecevdp.com"}/auth/callback`,
        data: { full_name: parsed.fullName, register_number: parsed.registerNumber, department_code: "ECE", section: parsed.section, major: parsed.major, minor: parsed.minor, year: parsed.year }
      }
    });
    if (error || !data.user) {
      if (error && process.env.NODE_ENV === "development") console.error("[auth] registration/provisioning failed", { code: error.code, message: error.message });
      if (error?.code === "23505" || /already (exists|registered)|duplicate key/i.test(error?.message ?? "")) {
        return { ok: false, message: "That college email or register number is already in use." };
      }
      const databaseDetail = process.env.NODE_ENV === "development" && error?.message ? ` (${error.message})` : "";
      throw new AppError("DATABASE_ERROR", `We could not securely provision your student account. Please contact the ECE administrator${databaseDetail}.`);
    }
    return { ok: true, emailConfirmationRequired: !data.session };
  } catch (error) {
    if (error instanceof AppError) return { ok: false, message: error.message };
    if (error instanceof Error && "issues" in error) return { ok: false, message: "Check the name, register number, major, minor, section, college email, and password fields." };
    console.error("[auth] student registration failed", error);
    const issue = publicError(error);
    return { ok: false, message: issue.message };
  }
}



