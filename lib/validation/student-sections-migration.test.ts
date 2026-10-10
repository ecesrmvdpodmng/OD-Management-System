import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { studentSections } from "@/lib/validation/auth";

const migration = readFileSync("supabase/migrations/202610100002_student_sections_core_vlsi_ds.sql", "utf8");
const registrationAction = readFileSync("app/actions/auth.ts", "utf8");

describe("student section persistence contract", () => {
  it("retains existing A/B values while the database permits the three new values", () => {
    expect(migration).toMatch(/section is null or section in \('A', 'B', 'Core', 'VLSI', 'DS'\)/i);
    expect(migration).not.toMatch(/update public\.profiles[\s\S]*?set section\s*=/i);
  });

  it("normalizes supported values to the exact labels used by registration", () => {
    for (const section of studentSections) expect(migration).toContain(`when '${section.toUpperCase()}' then '${section}'`);
    expect(migration).toMatch(/section_value not in \('Core', 'VLSI', 'DS'\)/i);
  });

  it("sends the selected validated section through Auth metadata for profile provisioning", () => {
    expect(registrationAction).toMatch(/section: parsed\.section/);
    expect(migration).toMatch(/register_number, section, year, is_active/);
    expect(migration).toMatch(/register_no, section_value, year_value, true/);
  });
});
