import { describe, expect, it } from "vitest";
import { registerStudentSchema, registerNumberSchema, srmistEmailSchema, studentClasses, studentSections } from "@/lib/validation/auth";

describe("student registration validation", () => {
  it("accepts only the exact SRMIST email domain", () => {
    expect(srmistEmailSchema.safeParse("student@srmist.edu.in").success).toBe(true);
    for (const email of ["student@gmail.com", "student@outlook.com", "student@srmist.com", "student@srmist.edu.in.example.com"]) {
      expect(srmistEmailSchema.safeParse(email).success).toBe(false);
    }
  });

  it("accepts flexible RA register numbers while rejecting obvious invalid values", () => {
    expect(registerNumberSchema.safeParse("RA1234567890").success).toBe(true);
    expect(registerNumberSchema.safeParse("RA24ECE001").success).toBe(true);
    for (const value of ["123456", "RAX", "RA-123456", "RB12345678"]) expect(registerNumberSchema.safeParse(value).success).toBe(false);
  });

  it("requires independent A/B section and Core/VLSI/DS class values", () => {
    expect(studentSections).toEqual(["A", "B"]);
    expect(studentClasses).toEqual(["Core", "VLSI", "DS"]);
    const base = { fullName: "Student Name", registerNumber: "RA24ECE001", departmentId: "11111111-1111-4111-8111-111111111111", section: "A", studentClass: "Core", year: "II", email: "student@srmist.edu.in", password: "a-secure-password", confirmPassword: "a-secure-password" };
    for (const section of studentSections) for (const studentClass of studentClasses) {
      expect(registerStudentSchema.safeParse({ ...base, section, studentClass }).success).toBe(true);
    }
    expect(registerStudentSchema.safeParse({ ...base, confirmPassword: "different-password" }).success).toBe(false);
    for (const section of ["C", "Core", "a"]) expect(registerStudentSchema.safeParse({ ...base, section }).success).toBe(false);
    for (const studentClass of ["A", "B", "Other", "core"]) expect(registerStudentSchema.safeParse({ ...base, studentClass }).success).toBe(false);
    const { section: _section, ...withoutSection } = base;
    const { studentClass: _studentClass, ...withoutClass } = base;
    expect(registerStudentSchema.safeParse(withoutSection).success).toBe(false);
    expect(registerStudentSchema.safeParse(withoutClass).success).toBe(false);
  });
});
