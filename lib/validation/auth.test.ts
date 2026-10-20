import { describe, expect, it } from "vitest";
import { registerStudentSchema, registerNumberSchema, srmistEmailSchema, studentMajors, studentMinorsByMajor, studentSections } from "@/lib/validation/auth";

const base = { fullName: "Student Name", registerNumber: "RA24ECE001", major: "B.Tech", minor: "ECE Core", section: "A", year: "II", email: "student@srmist.edu.in", password: "a-secure-password", confirmPassword: "a-secure-password" };

describe("student registration validation", () => {
  it("accepts only the exact SRMIST email domain", () => {
    expect(srmistEmailSchema.safeParse("student@srmist.edu.in").success).toBe(true);
    for (const email of ["student@gmail.com", "student@outlook.com", "student@srmist.com", "student@srmist.edu.in.example.com"]) expect(srmistEmailSchema.safeParse(email).success).toBe(false);
  });

  it("accepts flexible RA register numbers while rejecting obvious invalid values", () => {
    expect(registerNumberSchema.safeParse("RA1234567890").success).toBe(true);
    expect(registerNumberSchema.safeParse("RA24ECE001").success).toBe(true);
    for (const value of ["123456", "RAX", "RA-123456", "RB12345678"]) expect(registerNumberSchema.safeParse(value).success).toBe(false);
  });

  it("supports exactly the Major and Minor combinations and keeps Section independent", () => {
    expect(studentMajors).toEqual(["B.Tech", "M.Tech"]);
    expect(studentMinorsByMajor["B.Tech"]).toEqual(["ECE Core", "EE VLSI", "ECE DS"]);
    expect(studentMinorsByMajor["M.Tech"]).toEqual(["EE VLSI"]);
    expect(studentSections).toEqual(["A", "B"]);
    for (const major of studentMajors) for (const minor of studentMinorsByMajor[major]) for (const section of studentSections) {
      expect(registerStudentSchema.safeParse({ ...base, major, minor, section }).success).toBe(true);
    }
    expect(registerStudentSchema.safeParse({ ...base, major: "M.Tech", minor: "ECE Core" }).success).toBe(false);
    expect(registerStudentSchema.safeParse({ ...base, major: "M.Tech", minor: "ECE DS" }).success).toBe(false);
    expect(registerStudentSchema.safeParse({ ...base, minor: "ECE VLSI" }).success).toBe(false);
    expect(registerStudentSchema.safeParse({ ...base, section: "ECE Core" }).success).toBe(false);
    expect(registerStudentSchema.safeParse({ ...base, section: "C" }).success).toBe(false);
    expect(registerStudentSchema.safeParse({ ...base, confirmPassword: "different-password" }).success).toBe(false);
    const { section: _section, ...withoutSection } = base;
    const { minor: _minor, ...withoutMinor } = base;
    expect(registerStudentSchema.safeParse(withoutSection).success).toBe(false);
    expect(registerStudentSchema.safeParse(withoutMinor).success).toBe(false);
  });
});
