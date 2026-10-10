import { describe, expect, it } from "vitest";
import { classifyStaffInviteAttempt } from "@/lib/staff-invitation-policy";

const pendingProfile = { role: "faculty", department_id: "ece-dept", staff_setup_pending: true, is_active: false };
const pendingInvitation = { role: "faculty", department_id: "ece-dept", completed_at: null };

describe("staff invitation account policy", () => {
  it("allows an existing Auth account with an incomplete profile and matching invitation to continue", () => {
    expect(classifyStaffInviteAttempt({ profile: pendingProfile, invitation: pendingInvitation, role: "faculty", departmentId: "ece-dept" })).toBe("pending");
  });

  it("allows an existing Auth account with a valid invitation when provisioning did not create a profile", () => {
    expect(classifyStaffInviteAttempt({ profile: null, invitation: pendingInvitation, role: "faculty", departmentId: "ece-dept" })).toBe("pending");
  });

  it("applies the same pending-invitation rules to HOD accounts", () => {
    expect(classifyStaffInviteAttempt({
      profile: { ...pendingProfile, role: "hod" },
      invitation: { ...pendingInvitation, role: "hod" },
      role: "hod",
      departmentId: "ece-dept"
    })).toBe("pending");
  });

  it("identifies an already completed staff registration", () => {
    expect(classifyStaffInviteAttempt({
      profile: { ...pendingProfile, staff_setup_pending: false, is_active: true },
      invitation: { ...pendingInvitation, completed_at: "2026-10-10T00:00:00Z" },
      role: "faculty",
      departmentId: "ece-dept"
    })).toBe("completed");
  });

  it("rejects an invalid or mismatched invitation", () => {
    expect(classifyStaffInviteAttempt({ profile: null, invitation: { ...pendingInvitation, role: "hod" }, role: "faculty", departmentId: "ece-dept" })).toBe("invalid");
  });

  it("rejects attempts to change the invited role or department", () => {
    expect(classifyStaffInviteAttempt({ profile: pendingProfile, invitation: pendingInvitation, role: "hod", departmentId: "ece-dept" })).toBe("invalid");
    expect(classifyStaffInviteAttempt({ profile: pendingProfile, invitation: pendingInvitation, role: "faculty", departmentId: "other-dept" })).toBe("invalid");
  });

  it("allows a new invitation when neither a profile nor invitation exists", () => {
    expect(classifyStaffInviteAttempt({ profile: null, invitation: null, role: "hod", departmentId: "ece-dept" })).toBe("new");
  });
});
