import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { studentMajors, studentMinorsByMajor, studentSections, studentYears, studentYearsByMajor } from "@/lib/validation/auth";

const browser = readFileSync("components/faculty/AttendanceBrowser.tsx", "utf8");
const route = readFileSync("app/api/faculty/attendance/route.ts", "utf8");
const migration = readFileSync("supabase/migrations/202610200003_faculty_attendance_academic_filters.sql", "utf8");
const todayOnlyMigration = readFileSync("supabase/migrations/202610200005_today_only_faculty_attendance_mtech_years.sql", "utf8");
const registrationForm = readFileSync("app/register/RegisterForm.tsx", "utf8");

describe("faculty attendance academic selection and query", () => {
  it("uses the current registration major, minor, year, and section values", () => {
    expect(studentMajors).toEqual(["B.Tech", "M.Tech"]);
    expect(studentMinorsByMajor["B.Tech"]).toEqual(["ECE Core", "EE VLSI", "ECE DS"]);
    expect(studentMinorsByMajor["M.Tech"]).toEqual(["EE VLSI"]);
    expect(studentYears).toEqual(["I", "II", "III", "IV"]);
    expect(studentYearsByMajor["B.Tech"]).toEqual(["I", "II", "III", "IV"]);
    expect(studentYearsByMajor["M.Tech"]).toEqual(["I", "II"]);
    expect(studentSections).toEqual(["A", "B"]);
  });

  it("requires the selection order and resets dependent filters and results", () => {
    const order = ["Choose Major", "Choose Minor", "Choose Year", "Choose Section"]
      .map((label) => browser.indexOf(label));
    expect(order.every((position) => position >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(browser).toMatch(/setMajor\(value\); setMinor\(""\); setYear\(""\); setSection\(""\); setResult\(null\)/);
    expect(browser).toMatch(/setMinor\(value\); setYear\(""\); setSection\(""\); setResult\(null\)/);
    expect(browser).toMatch(/setYear\(value\); setSection\(""\); setResult\(null\)/);
    expect(browser).toMatch(/studentSections\.map/);
    expect(browser).toContain("No HOD-approved ODs are available for this class.");
  });

  it("validates and fetches the exact academic combination server-side", () => {
    expect(route).toMatch(/await requireFaculty\(\)/);
    expect(route).toMatch(/studentMinorsByMajor\[major\]\.includes\(minor\)/);
    expect(route).toMatch(/p_major: major, p_minor: minor, p_year: year, p_section: section/);
    expect(route).toMatch(/code: error\.code, message: error\.message, details: error\.details, hint: error\.hint/);
    expect(migration).toMatch(/actor\.role <> 'faculty' or actor\.department_id is null/i);
    expect(migration).toMatch(/r\.status = 'APPROVED'[\s\S]*?r\.department_id = actor\.department_id/i);
    expect(migration).toMatch(/student\.major = p_major[\s\S]*?student\.minor = p_minor[\s\S]*?student\.year = p_year[\s\S]*?student\.section = p_section/i);
    expect(migration).not.toMatch(/od_request_faculty/);
    expect(migration).toMatch(/revoke all on function public\.faculty_approved_od_attendance\(\) from public, anon, authenticated/i);
  });

  it("shows only today's approved ODs and restricts M.Tech attendance years", () => {
    expect(browser).toMatch(/studentYearsByMajor\[major\]\.map/);
    expect(route).toMatch(/isStudentYearForMajor\(major, year\)/);
    expect(todayOnlyMigration).toMatch(/p_major = 'M\.Tech' and p_year not in \('I', 'II'\)/i);
    expect(todayOnlyMigration).toMatch(/r\.event_date = timezone\('Asia\/Kolkata', now\(\)\)::date/i);
    expect(todayOnlyMigration).toMatch(/major_value = 'M\.Tech' and year_value not in \('I', 'II'\)/i);
    expect(registrationForm).toMatch(/studentYearsByMajor\[form\.major\]\.map/);
  });

  it("keeps query failures distinct from successful empty results", () => {
    expect(browser).toMatch(/if \(!response\.ok\) throw new Error/);
    expect(browser).toMatch(/role="alert"/);
    expect(browser).toMatch(/result\?\.key === selectionKey && !rows\.length/);
    expect(browser).toMatch(/const loading = Boolean\(selectionKey && result\?\.key !== selectionKey && failure\?\.key !== selectionKey\)/);
  });
});
