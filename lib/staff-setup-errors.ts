type SupabaseFailure = { code?: string; status?: number; message?: string } | null | undefined;

export function sanitizeStaffSetupDiagnostic(message: unknown) {
  if (typeof message !== "string") return undefined;
  return message
    .replace(/https?:\/\/\S+/gi, "[url redacted]")
    .replace(/\bBearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/\b(access_token|refresh_token|token_hash|code|password|cookie|set-cookie)=([^&\s,;]+)/gi, "$1=[redacted]")
    .replace(/("(?:password|access_token|refresh_token|token_hash|cookie)"\s*:\s*")[^"]*(")/gi, "$1[redacted]$2")
    .replace(/\beyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\b/g, "[jwt redacted]")
    .slice(0, 500);
}

export function staffSetupFailureMessage(operation: string, error: SupabaseFailure): string | null {
  if (operation !== "provision staff profile") return null;
  if (["PGRST202", "42883"].includes(error?.code ?? "")) return "Staff setup is not enabled in the database yet. Apply migrations 202610060001_staff_invitation_callback_setup.sql and 202610070001_fix_staff_identifier_and_od_uuid_generation.sql, then retry.";
  if (error?.code === "42501") return "This account no longer has a valid pending staff invitation. Ask an administrator to verify the invitation.";
  if (error?.code === "23503") return "The invited ECE department is unavailable. Contact an administrator.";
  if (error?.code === "23514") return "Enter a valid name and Staff ID, then try again.";
  if (error?.code === "23505") return "That Staff ID is already in use. Contact an administrator to resolve the duplicate.";
  return null;
}
