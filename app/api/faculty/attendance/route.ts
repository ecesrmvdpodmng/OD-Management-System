import { NextResponse } from "next/server";
import { requireFaculty } from "@/lib/auth";
import { publicError } from "@/lib/errors";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const faculty = await requireFaculty();
    const supabase = await createSupabaseServerClient();
    const eligible: Array<Record<string, unknown>> = [];
    for (let page = 0; page < 100; page += 1) {
      const { data, error } = await supabase.from("od_requests")
        .select("id,od_number,event_name,reason,purpose,event_date,faculty_id,department_id,status,od_request_faculty!inner(faculty_id),od_request_students!inner(student_id,student:profiles!student_id!inner(id,full_name,register_number,major,minor,section)),od_attendance(request_id,student_id,attendance_status)")
        .eq("status", "APPROVED")
        .eq("department_id", faculty.department_id)
        .eq("od_request_faculty.faculty_id", faculty.id)
        .order("event_date", { ascending: false })
        .range(page * 500, page * 500 + 499);
      if (error) throw error;
      eligible.push(...((data ?? []) as unknown as Array<Record<string, unknown>>));
      if ((data ?? []).length < 500) break;
      if (page === 99) throw new Error("Attendance list exceeds the supported result size.");
    }

    const records = eligible.flatMap((row) => {
      const students = row.od_request_students as Array<{ student_id: string; student: { id: string; full_name: string | null; register_number: string | null; major: string | null; minor: string | null; section: string | null } | null }>;
      const attendance = row.od_attendance as Array<{ student_id: string; attendance_status: string }>;
      return students.flatMap((link) => {
        const student = link.student;
        if (!student?.id || !student.major || !student.minor || !["A", "B"].includes(student.section ?? "")) return [];
        const existing = attendance.find((item) => item.student_id === student.id);
        return [{
          requestId: String(row.id), reference: String(row.od_number ?? row.id), studentId: student.id,
          studentName: student.full_name ?? "", registerNumber: student.register_number ?? "",
          major: student.major, minor: student.minor, section: student.section!,
          eventName: String(row.event_name ?? ""), date: String(row.event_date ?? ""),
          reason: String(row.purpose ?? row.reason ?? ""),
          attendanceStatus: existing?.attendance_status === "PRESENT" || existing?.attendance_status === "ABSENT" ? existing.attendance_status : null
        }];
      });
    });
    return NextResponse.json({ records }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const issue = publicError(error);
    const status = issue.code === "UNAUTHORIZED" ? 401 : issue.code === "FORBIDDEN" ? 403 : 500;
    if (status === 500) console.error("[faculty-attendance] eligible OD query failed", error instanceof Error ? error.message : error);
    return NextResponse.json({ message: status === 500 ? "Approved attendance records could not be loaded." : issue.message }, { status, headers: { "Cache-Control": "private, no-store" } });
  }
}
