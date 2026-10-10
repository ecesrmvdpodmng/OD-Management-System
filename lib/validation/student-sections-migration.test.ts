import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { studentClasses, studentSections } from "@/lib/validation/auth";

const migration = readFileSync("supabase/migrations/202610100003_student_section_and_class.sql", "utf8");
const registrationAction = readFileSync("app/actions/auth.ts", "utf8");

describe("student section and class persistence contract", () => {
  it("retains existing section data and adds a nullable class column without data rewrites", () => {
    expect(studentSections).toEqual(["A", "B"]);
    expect(studentClasses).toEqual(["Core", "VLSI", "DS"]);
    expect(migration).toMatch(/section is null or section in \('A', 'B', 'Core', 'VLSI', 'DS'\)/i);
    expect(migration).toMatch(/add column if not exists student_class text/i);
    expect(migration).toMatch(/student_class is null or student_class in \('Core', 'VLSI', 'DS'\)/i);
    expect(migration).not.toMatch(/update public\.profiles[\s\S]*?set (?:section|student_class)\s*=/i);
  });

  it("validates independent metadata and inserts it into separate columns", () => {
    expect(migration).toMatch(/section_value not in \('A', 'B'\)/i);
    expect(migration).toMatch(/class_value not in \('Core', 'VLSI', 'DS'\)/i);
    expect(migration).toMatch(/register_number, section, student_class, year, is_active/i);
    expect(migration).toMatch(/register_no, section_value, class_value, year_value, true/i);
    for (const studentClass of studentClasses) expect(migration).toContain(`when '${studentClass.toUpperCase()}' then '${studentClass}'`);
  });

  it("sends both validated registration values through Auth metadata", () => {
    expect(registrationAction).toMatch(/section: parsed\.section/);
    expect(registrationAction).toMatch(/student_class: parsed\.studentClass/);
    expect(migration).toMatch(/grant select\(student_class\) on public\.profiles to authenticated/i);
  });
});
