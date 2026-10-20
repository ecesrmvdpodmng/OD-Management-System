export type StaffInviteProfileSnapshot = {
  role: string;
  department_id: string | null;
  staff_setup_pending: boolean;
  is_active: boolean;
};

export type StaffInviteSnapshot = {
  role: string;
  department_id: string;
  completed_at: string | null;
};

export type StaffInviteAttemptState = "new" | "pending" | "completed" | "invalid";

/** Decide whether an Admin may send or restart the invitation without changing its assigned role or department. */
export function classifyStaffInviteAttempt(input: {
  profile: StaffInviteProfileSnapshot | null;
  invitation: StaffInviteSnapshot | null;
  role: "faculty" | "hod";
  departmentId: string;
}): StaffInviteAttemptState {
  const { profile, invitation, role, departmentId } = input;

  if (invitation?.completed_at) return "completed";
  if (profile && (!profile.staff_setup_pending || profile.is_active)) return "completed";

  if (profile && (profile.role !== role || profile.department_id !== departmentId)) return "invalid";
  if (invitation && (invitation.role !== role || invitation.department_id !== departmentId)) return "invalid";

  return profile || invitation ? "pending" : "new";
}
