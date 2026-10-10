export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://od-management.srmecevdp.com",
  allowedEmailDomain: (process.env.ALLOWED_EMAIL_DOMAIN ?? "").trim().toLowerCase(),
  collegeName: process.env.COLLEGE_NAME?.trim() || "College",
  collegeDepartment: process.env.COLLEGE_DEPARTMENT?.trim() || "Department"
} as const;

export function hasAllowedEmailDomain(email: string) {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf("@");
  return env.allowedEmailDomain === "srmist.edu.in" && at > 0 && normalized.slice(at + 1) === "srmist.edu.in";
}
