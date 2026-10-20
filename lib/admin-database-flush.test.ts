import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/202610200006_admin_database_flush.sql", "utf8");
const page = readFileSync("app/admin/database-flush/page.tsx", "utf8");
const actions = readFileSync("app/actions/admin-maintenance.ts", "utf8");
const shell = readFileSync("components/layout/AppShell.tsx", "utf8");

describe("admin database maintenance safeguards", () => {
  it("promotes B.Tech and M.Tech students according to their program length", () => {
    expect(migration).toMatch(/when major = 'M\.Tech' and year = 'I' then 'II'/i);
    expect(migration).toMatch(/when major = 'M\.Tech' then year/i);
    expect(migration).toMatch(/when year = 'I' then 'II'[\s\S]*when year = 'II' then 'III'[\s\S]*when year = 'III' then 'IV'/i);
    expect(migration).toMatch(/where role = 'student'/i);
    expect(page).toContain("B.Tech 4th-year and M.Tech 2nd-year accounts remain in their current year.");
  });

  it("deletes OD workflow records while preserving identity and account configuration tables", () => {
    for (const table of ["notifications", "audit_logs", "od_attendance", "od_request_faculty", "od_request_students", "od_approval_history", "od_requests"]) {
      expect(migration).toMatch(new RegExp(`delete from public\\.${table}\\b`, "i"));
    }
    for (const table of ["profiles", "staff_account_invitations", "faculty_role_requests", "departments", "academic_years", "od_limits"]) {
      expect(migration).not.toMatch(new RegExp(`delete from public\\.${table}\\b`, "i"));
    }
    expect(migration).toMatch(/delete from public\.audit_logs where request_id is not null/i);
  });

  it("requires admin authorization in the server action and database RPCs", () => {
    expect(actions).toMatch(/await requireAdmin\(\)/g);
    expect(migration.match(/actor\.role <> 'admin'/g)).toHaveLength(2);
    expect(migration).toMatch(/revoke all on function public\.admin_wipe_od_workflow_data\(\) from public, anon/i);
    expect(migration).toMatch(/grant execute on function public\.admin_wipe_od_workflow_data\(\) to authenticated/i);
  });

  it("opens an action alert before execution and requires a typed wipe confirmation", () => {
    expect(shell).toContain('{ label: "Database Flush", href: "/admin/database-flush" }');
    expect(page).toMatch(/role="alertdialog" aria-modal="true"/);
    expect(page).toContain('Type WIPE OD DATA to enable this action');
    expect(page).toContain('wipePhrase !== "WIPE OD DATA"');
    expect(page).toMatch(/role="status"/);
  });
});
