import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { studentMajors, studentMinorsByMajor, studentSections } from "@/lib/validation/auth";

const migration = readFileSync("supabase/migrations/202610200001_student_major_minor_attendance.sql", "utf8");
const registrationAction = readFileSync("app/actions/auth.ts", "utf8");
const attendanceRoute = readFileSync("app/api/faculty/attendance/route.ts", "utf8");
const attendanceAction = readFileSync("app/actions/od.ts", "utf8");

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

  it("restricts attendance data to approved assigned OD records and preserves the existing authorized mark action", () => {
    expect(attendanceRoute).toMatch(/requireFaculty\(\)/);
    expect(attendanceRoute).toMatch(/\.eq\("status", "APPROVED"\)/);
    expect(attendanceRoute).toMatch(/\.eq\("od_request_faculty\.faculty_id", faculty\.id\)/);
    expect(attendanceRoute).toMatch(/major,minor,section/);
    expect(attendanceAction).toMatch(/requireFaculty\(\)/);
    expect(attendanceAction).toMatch(/mark_od_attendance/);
  });
});
