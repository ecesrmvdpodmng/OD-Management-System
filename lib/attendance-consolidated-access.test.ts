import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const consolidatedRoute = readFileSync("app/api/consolidated/route.ts", "utf8");
const loginContent = readFileSync("app/login/LoginContent.tsx", "utf8");

describe("attendance and consolidated access boundaries", () => {
  it("keeps faculty consolidated reports limited to assigned requests and HOD reports department-wide", () => {
    expect(consolidatedRoute).toMatch(/requireAuthenticatedUser\(\)/);
    expect(consolidatedRoute).toMatch(/!\["faculty", "hod"\]\.includes\(actor\.role\)/);
    expect(consolidatedRoute).toMatch(/if \(actor\.role === "faculty"\)/);
    expect(consolidatedRoute).toMatch(/\.eq\("faculty_id", actor\.id\)/);
    expect(consolidatedRoute).toMatch(/query = query\.in\("id", requestIds\)/);
    expect(consolidatedRoute).toMatch(/\.eq\("department_id", actor\.department_id\)/);
  });

  it("hides Google sign-in while retaining OAuth code and only one Create Account link", () => {
    expect(loginContent).toMatch(/const showGoogleSignIn = false/);
    expect(loginContent).toMatch(/auth\.signInWithOAuth/);
    expect(loginContent.match(/Create Account/g)).toHaveLength(1);
  });
});
