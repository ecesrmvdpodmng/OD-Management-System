import { z } from "zod";
import type { StudentMajor, StudentMinor } from "@/types/domain";

export const srmistEmailSchema = z.string().trim().email().max(254).refine((email) => email.toLowerCase().split("@").at(-1) === "srmist.edu.in", {
  message: "Use your @srmist.edu.in email address."
});

export const registerNumberSchema = z.string().trim().toUpperCase().regex(/^RA[A-Z0-9]{6,18}$/, {
  message: "Enter a valid SRMIST register number beginning with RA."
});

export const studentSections = ["A", "B"] as const;
export type StudentSection = (typeof studentSections)[number];
export const studentYears = ["I", "II", "III", "IV"] as const;
export type StudentYear = (typeof studentYears)[number];
export const studentYearsByMajor: Readonly<Record<StudentMajor, readonly StudentYear[]>> = {
  "B.Tech": studentYears,
  "M.Tech": ["I", "II"]
};
export const studentMajors = ["B.Tech", "M.Tech"] as const satisfies readonly StudentMajor[];
export const studentMinorsByMajor: Readonly<Record<StudentMajor, readonly StudentMinor[]>> = {
  "B.Tech": ["ECE Core", "EE VLSI", "ECE DS"],
  "M.Tech": ["EE VLSI"]
};
export const studentMinors = ["ECE Core", "EE VLSI", "ECE DS"] as const satisfies readonly StudentMinor[];
export type { StudentMajor, StudentMinor };

export function isStudentMajor(value: string): value is StudentMajor {
  return studentMajors.some((major) => major === value);
}

export function isStudentMinor(value: string): value is StudentMinor {
  return studentMinors.some((minor) => minor === value);
}

export function isStudentSection(value: string): value is StudentSection {
  return studentSections.some((section) => section === value);
}

export function isStudentYearForMajor(major: StudentMajor, value: string): value is StudentYear {
  return studentYearsByMajor[major].some((year) => year === value);
}

export const registerStudentSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  registerNumber: registerNumberSchema,
  major: z.enum(studentMajors),
  minor: z.enum(studentMinors),
  section: z.enum(studentSections),
  year: z.enum(studentYears),
  email: srmistEmailSchema,
  password: z.string().min(10).max(128),
  confirmPassword: z.string().min(10).max(128)
}).refine((value) => value.password === value.confirmPassword, {
  message: "Passwords do not match.", path: ["confirmPassword"]
}).refine((value) => value.major === "B.Tech"
  ? studentMinorsByMajor["B.Tech"].some((minor) => minor === value.minor)
  : studentMinorsByMajor["M.Tech"].some((minor) => minor === value.minor), {
  message: "Choose a Minor that is available for the selected Major.", path: ["minor"]
}).refine((value) => studentYearsByMajor[value.major].some((year) => year === value.year), {
  message: "Choose a Year that is available for the selected Major.", path: ["year"]
});

