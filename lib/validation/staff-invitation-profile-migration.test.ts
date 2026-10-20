import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/202610100001_complete_existing_staff_invitation_profile.sql", "utf8");
const action = readFileSync("app/actions/admin.ts", "utf8");

describe("staff invitation profile completion contract", () => {
  it("completes an existing invitation-created profile and binds it to the verified Auth user", () => {
    expect(migration).toMatch(/where lower\(email\) = actor_email\s+for update/i);
    expect(migration).toMatch(/actor\.auth_user_id is not null and actor\.auth_user_id <> actor_id/i);
    expect(migration).toMatch(/set auth_user_id = actor_id,\s+full_name = staff_name,\s+register_number = staff_id/i);
    expect(migration).toMatch(/staff_setup_pending = false/i);
  });

  it("requires a verified authenticated user and a claimed, live invitation for that user", () => {
    expect(migration).toMatch(/where id = actor_id and email_confirmed_at is not null/i);
    expect(migration).toMatch(/where email = actor_email\s+and auth_user_id = actor_id\s+and claimed_at is not null\s+and completed_at is null\s+and expires_at > now\(\)/i);
    expect(migration).toMatch(/raise exception 'The existing profile does not match this pending invitation\.' using errcode = '42501'/i);
  });

  it("rejects an already-completed invitation at the database boundary while the action accepts only a matching completed profile", () => {
    expect(migration).toMatch(/and completed_at is null/i);
    expect(action).toMatch(/state\.status === "completed"[\s\S]*?profile\.email\?\.toLowerCase\(\) === user\.email\?\.toLowerCase\(\)[\s\S]*?profile\.role === state\.role[\s\S]*?!profile\.staff_setup_pending/);
  });

  it("takes role and department only from the invitation, never from RPC input", () => {
    expect(migration).toMatch(/p_full_name text,\s+p_faculty_id text/i);
    expect(migration).toMatch(/actor\.role <> invitation\.role/i);
    expect(migration).toMatch(/actor\.department_id <> invitation\.department_id/i);
    expect(migration).toMatch(/actor_id, staff_name, actor_email, staff_id, invitation\.department_id,\s+invitation\.role/i);
    expect(action).toMatch(/rpc\("complete_staff_account_setup", \{ p_full_name: fullName, p_faculty_id: facultyId \}\)/);
  });
});
