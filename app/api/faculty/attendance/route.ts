import { NextResponse } from "next/server";
import { requireFaculty } from "@/lib/auth";
import { publicError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireFaculty();
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.rpc("faculty_approved_od_attendance");
    if (error) throw error;
    const rows = (data ?? []) as Array<{
      request_id: string; od_number: string; student_id: string; student_name: string | null;
      register_number: string | null; major: string; minor: string; section: "A" | "B";
      event_name: string | null; event_date: string; reason: string | null; attendance_status: "PRESENT" | "ABSENT";
    }>;
    const records = rows.map((row) => ({
      requestId: row.request_id, reference: row.od_number, studentId: row.student_id,
      studentName: row.student_name ?? "", registerNumber: row.register_number ?? "",
      major: row.major, minor: row.minor, section: row.section,
      eventName: row.event_name ?? "", date: row.event_date,
      reason: row.reason ?? "", attendanceStatus: row.attendance_status
    }));
    return NextResponse.json({ records }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const issue = publicError(error);
    const status = issue.code === "UNAUTHORIZED" ? 401 : issue.code === "FORBIDDEN" ? 403 : 500;
    if (status === 500) console.error("[faculty-attendance] eligible OD query failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: status === 500 ? "Approved attendance records could not be loaded." : issue.message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
