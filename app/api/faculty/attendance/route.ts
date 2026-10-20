import { NextResponse } from "next/server";
import { requireFaculty } from "@/lib/auth";
import { publicError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isStudentMajor, isStudentMinor, isStudentSection, studentMinorsByMajor, studentYears } from "@/lib/validation/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireFaculty();
    const params = new URL(request.url).searchParams;
    const major = params.get("major");
    const minor = params.get("minor");
    const year = params.get("year");
    const section = params.get("section");
    if (!major || !isStudentMajor(major)
      || !minor || !isStudentMinor(minor) || !studentMinorsByMajor[major].includes(minor)
      || !year || !studentYears.some((candidate) => candidate === year)
      || !section || !isStudentSection(section)) {
      return NextResponse.json({ message: "Choose a valid Major, Minor, Year, and Section." }, { status: 400, headers: { "Cache-Control": "private, no-store" } });
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("faculty_approved_od_attendance", {
      p_major: major, p_minor: minor, p_year: year, p_section: section
    });
    if (error) {
      console.error("[faculty-attendance] approved OD query failed", {
        code: error.code, message: error.message, details: error.details, hint: error.hint
      });
      throw error;
    }
    const rows = (data ?? []) as Array<{
      request_id: string; od_number: string; student_id: string; student_name: string | null;
      register_number: string | null; major: string; minor: string; year: string; section: "A" | "B";
      event_name: string | null; event_date: string; reason: string | null; attendance_status: "PRESENT" | "ABSENT";
    }>;
    const records = rows.map((row) => ({
      requestId: row.request_id, reference: row.od_number, studentId: row.student_id,
      studentName: row.student_name ?? "", registerNumber: row.register_number ?? "",
      major: row.major, minor: row.minor, year: row.year, section: row.section,
      eventName: row.event_name ?? "", date: row.event_date,
      reason: row.reason ?? "", attendanceStatus: row.attendance_status
    }));
    return NextResponse.json({ records }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const issue = publicError(error);
    const status = issue.code === "UNAUTHORIZED" ? 401 : issue.code === "FORBIDDEN" ? 403 : 500;
    if (status === 500) console.error("[faculty-attendance] request failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: status === 500 ? "Approved attendance records could not be loaded." : issue.message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
