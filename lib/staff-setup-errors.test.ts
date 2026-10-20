import { describe, expect, it } from "vitest";
import { sanitizeStaffSetupDiagnostic, staffSetupFailureMessage } from "@/lib/staff-setup-errors";

describe("staff setup failure diagnostics", () => {
  it("maps the missing setup RPC to the migrations that provide it", () => {
    expect(staffSetupFailureMessage("provision staff profile", { code: "PGRST202" })).toContain("202610060001_staff_invitation_callback_setup.sql");
    expect(staffSetupFailureMessage("provision staff profile", { code: "42883" })).toContain("202610070001_fix_staff_identifier_and_od_uuid_generation.sql");
  });

  it("distinguishes invitation, department, validation, and duplicate failures", () => {
    expect(staffSetupFailureMessage("provision staff profile", { code: "42501" })).toContain("valid pending staff invitation");
    expect(staffSetupFailureMessage("provision staff profile", { code: "23503" })).toContain("department is unavailable");
    expect(staffSetupFailureMessage("provision staff profile", { code: "23514" })).toContain("valid name and Staff ID");
    expect(staffSetupFailureMessage("provision staff profile", { code: "23505" })).toContain("already in use");
  });

  it("does not replace other operation errors with setup-specific guidance", () => {
    expect(staffSetupFailureMessage("set staff account password", { code: "42501" })).toBeNull();
  });

  it("retains safe diagnostic details while redacting credentials and links", () => {
    const message = sanitizeStaffSetupDiagnostic('https://example.test/auth?token_hash=secret password=secret Bearer abc eyJhbGci.eyJzdWI.abc');
    expect(message).not.toContain("example.test");
    expect(message).not.toContain("secret");
    expect(message).not.toContain("Bearer abc");
    expect(message).not.toContain("eyJhbGci");
    expect(message).toContain("[url redacted]");
    expect(message).toContain("password=[redacted]");
  });
});
