import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { studentMajors, studentMinorsByMajor, studentSections } from "@/lib/validation/auth";

const migration = readFileSync("supabase/migrations/202610200001_student_major_minor_attendance.sql", "utf8");
const attendanceMigration = readFileSync("supabase/migrations/202610200002_auto_present_department_attendance.sql", "utf8");
const registrationAction = readFileSync("app/actions/auth.ts", "utf8");
const attendanceRoute = readFileSync("app/api/faculty/attendance/route.ts", "utf8");
const attendanceBrowser = readFileSync("components/faculty/AttendanceBrowser.tsx", "utf8");

describe("student Major, Minor, and Section persistence contract", () => {
  it("preserves the existing department and A/B section schema while adding nullable fields", () => {
    expect(studentMajors).toEqual(["B.Tech", "M.Tech"]);
    expect(studentMinorsByMajor["B.Tech"]).toEqual(["ECE Core", "ECE VLSI", "ECE DS"]);
    expect(studentMinorsByMajor["M.Tech"]).toEqual(["ECE Core", "ECE VLSI"]);
    expect(studentSections).toEqual(["A", "B"]);
    expect(migration).toMatch(/add column if not exists major text/i);
    expect(migration).toMatch(/add column if not exists minor text/i);
    expect(migration).toMatch(/major is null or major in \('B\.Tech', 'M\.Tech'\)/i);
    expect(migration).toMatch(/major = 'B\.Tech' and minor is not null and minor in \('ECE Core', 'ECE VLSI', 'ECE DS'\)/i);
    expect(migration).toMatch(/major = 'M\.Tech' and minor is not null and minor in \('ECE Core', 'ECE VLSI'\)/i);
    expect(migration).not.toMatch(/update public\.profiles[\s\S]*?set (?:major|minor|section)\s*=/i);
  });

  it("validates and stores Major, Minor, and Section independently at provisioning", () => {
    expect(migration).toMatch(/section_value not in \('A', 'B'\)/i);
    expect(migration).toMatch(/major_value not in \('B\.Tech', 'M\.Tech'\)/i);
    expect(migration).toMatch(/major, minor, year, is_active/i);
    expect(migration).toMatch(/section_value, major_value, minor_value, year_value/i);
    expect(registrationAction).toMatch(/section: parsed\.section/);
    expect(registrationAction).toMatch(/major: parsed\.major/);
    expect(registrationAction).toMatch(/minor: parsed\.minor/);
  });

  it("serves department-wide approved attendance through an explicitly guarded faculty RPC", () => {
    expect(attendanceRoute).toMatch(/requireFaculty\(\)/);
    expect(attendanceRoute).toMatch(/rpc\("faculty_approved_od_attendance"\)/);
    expect(attendanceMigration).toMatch(/actor\.role <> 'faculty' or actor\.department_id is null/i);
    expect(attendanceMigration).toMatch(/r\.status='APPROVED' and r\.department_id=actor\.department_id/i);
    const departmentAttendanceRpc = attendanceMigration.split("create or replace function public.faculty_approved_od_attendance()")[1];
    expect(departmentAttendanceRpc).toBeDefined();
    expect(departmentAttendanceRpc).not.toMatch(/od_request_faculty/);
    expect(attendanceMigration).toMatch(/grant execute on function public\.faculty_approved_od_attendance\(\) to authenticated/i);
  });

  it("keeps attendance read-only and displays statuses without allowing faculty changes", () => {
    expect(attendanceBrowser).toContain('"Attendance"');
    expect(attendanceBrowser).toContain('row.attendanceStatus === "PRESENT" ? "Present" : "Absent"');
    expect(attendanceBrowser).not.toMatch(/Mark Present|Mark Absent|markAttendance/);
    expect(attendanceMigration).toMatch(/revoke all on function public\.mark_od_attendance\(uuid,uuid,public\.attendance_status\) from public,anon,authenticated/i);
  });

  it("marks students Present when regular and Special OD approval is final", () => {
    expect(attendanceMigration).toMatch(/if p_approved then perform public\.mark_approved_od_attendance_present\(p_request_id\); end if;[\s\S]*?decide_special_od_hod/i);
    expect(attendanceMigration).toMatch(/if p_approved then perform public\.mark_approved_od_attendance_present\(p_request_id\); end if;[\s\S]*?SPECIAL_OD_HOD_APPROVED/i);
    expect(attendanceMigration).toMatch(/where existing_attendance\.attendance_status = 'NOT_MARKED'/i);
    expect(attendanceMigration).toMatch(/where r\.status = 'APPROVED' and r\.hod_id is not null/i);
    expect(attendanceMigration).toMatch(/coalesce\(r\.hod_action_at, r\.updated_at, r\.created_at, now\(\)\)/i);
  });
});
