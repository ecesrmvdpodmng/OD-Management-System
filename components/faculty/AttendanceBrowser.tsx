"use client";

import { useEffect, useState } from "react";
import { studentMajors, studentMinorsByMajor, studentSections, studentYears } from "@/lib/validation/auth";
import type { StudentMajor, StudentMinor, StudentSection } from "@/lib/validation/auth";
import type { Profile } from "@/types/domain";

type StudentYear = NonNullable<Profile["year"]>;
type AttendanceRow = {
  requestId: string; reference: string; studentId: string; studentName: string; registerNumber: string;
  major: StudentMajor; minor: StudentMinor; year: StudentYear; section: StudentSection;
  eventName: string; date: string; reason: string; attendanceStatus: "PRESENT" | "ABSENT";
};

const yearLabels: Record<StudentYear, string> = {
  I: "1st Year", II: "2nd Year", III: "3rd Year", IV: "4th Year"
};

export function AttendanceBrowser() {
  const [major, setMajor] = useState<StudentMajor | "">("");
  const [minor, setMinor] = useState<StudentMinor | "">("");
  const [year, setYear] = useState<StudentYear | "">("");
  const [section, setSection] = useState<StudentSection | "">("");
  const [result, setResult] = useState<{ key: string; rows: AttendanceRow[] } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const selectionKey = major && minor && year && section
    ? new URLSearchParams({ major, minor, year, section }).toString()
    : "";

  useEffect(() => {
    if (!selectionKey) return;

    let active = true;
    void fetch(`/api/faculty/attendance?${selectionKey}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { records?: AttendanceRow[]; message?: string };
        if (!response.ok) throw new Error(payload.message || "Approved attendance records could not be loaded.");
        if (active) setResult({ key: selectionKey, rows: payload.records ?? [] });
      })
      .catch((reason: unknown) => {
        if (active) setFailure({ key: selectionKey, message: reason instanceof Error ? reason.message : "Approved attendance records could not be loaded." });
      });

    return () => { active = false; };
  }, [selectionKey]);

  const rows = result?.key === selectionKey ? result.rows : [];
  const error = failure?.key === selectionKey ? failure.message : "";
  const loading = Boolean(selectionKey && result?.key !== selectionKey && failure?.key !== selectionKey);

  const card = "rounded-lg border px-4 py-3 text-left font-semibold transition focus-ring";
  const selectOption = (value: string, current: string) => `${card} ${current === value ? "border-accent bg-blue-50 text-accent" : "border-line bg-white text-navy hover:border-accent"}`;

  return <div className="space-y-5">
    <div>
      <h2 className="text-2xl font-bold text-navy">Approved OD Attendance</h2>
      <p className="mt-1 text-sm text-muted">View HOD-approved OD attendance for any academic combination in your department.</p>
    </div>
    {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}

    <section aria-label="Choose Major">
      <h3 className="mb-2 font-semibold text-navy">1. Choose Major</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {studentMajors.map((value) => <button key={value} type="button" aria-pressed={major === value}
          onClick={() => { if (major === value) return; setMajor(value); setMinor(""); setYear(""); setSection(""); setResult(null); setFailure(null); }}
          className={selectOption(value, major)}>{value}</button>)}
      </div>
    </section>

    {major ? <section aria-label="Choose Minor">
      <h3 className="mb-2 font-semibold text-navy">2. Choose Minor</h3>
      <div className="flex flex-wrap gap-2">
        {studentMinorsByMajor[major].map((value) => <button key={value} type="button" aria-pressed={minor === value}
          onClick={() => { if (minor === value) return; setMinor(value); setYear(""); setSection(""); setResult(null); setFailure(null); }}
          className={selectOption(value, minor)}>{value}</button>)}
      </div>
    </section> : null}

    {major && minor ? <section aria-label="Choose Year">
      <h3 className="mb-2 font-semibold text-navy">3. Choose Year</h3>
      <div className="flex flex-wrap gap-2">
        {studentYears.map((value) => <button key={value} type="button" aria-pressed={year === value}
          onClick={() => { if (year === value) return; setYear(value); setSection(""); setResult(null); setFailure(null); }}
          className={selectOption(value, year)}>{yearLabels[value]}</button>)}
      </div>
    </section> : null}

    {major && minor && year ? <section aria-label="Choose Section">
      <h3 className="mb-2 font-semibold text-navy">4. Choose Section</h3>
      <div className="flex flex-wrap gap-2">
        {studentSections.map((value) => <button key={value} type="button" aria-pressed={section === value}
          onClick={() => { if (section === value) return; setSection(value); setResult(null); setFailure(null); }}
          className={selectOption(value, section)}>Section {value}</button>)}
      </div>
    </section> : null}

    {major && minor && year && section ? <section aria-label="Eligible approved OD attendance" className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5">
      <h3 className="font-semibold text-navy">{major} → {minor} → {yearLabels[year]} → Section {section}</h3>
      {loading ? <p role="status" className="mt-3 text-sm text-muted">Loading approved attendance…</p> : null}
      {!loading && result?.key === selectionKey && !rows.length ? <p className="mt-3 text-sm text-muted">No HOD-approved ODs are available for this class.</p> : null}
      {!loading && rows.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[900px] text-left text-sm">
        <thead><tr className="border-b text-muted">{["Student", "Register No.", "Major", "Minor", "Year", "Section", "OD Date", "Event / Reason", "Attendance"].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead>
        <tbody>{rows.map((row) => <tr key={`${row.requestId}:${row.studentId}`} className="border-b border-line align-top">
          <td className="p-2"><span className="font-medium">{row.studentName || "—"}</span><span className="block text-xs text-muted">{row.reference}</span></td>
          <td className="p-2">{row.registerNumber || "—"}</td><td className="p-2">{row.major}</td><td className="p-2">{row.minor}</td>
          <td className="p-2">{yearLabels[row.year]}</td><td className="p-2">{row.section}</td><td className="p-2">{row.date || "—"}</td>
          <td className="max-w-xs whitespace-pre-wrap p-2">{[row.eventName, row.reason].filter(Boolean).join(" · ") || "—"}</td>
          <td className="p-2 font-medium text-emerald-700">{row.attendanceStatus === "PRESENT" ? "Present" : "Absent"}</td>
        </tr>)}</tbody>
      </table></div> : null}
    </section> : null}
  </div>;
}
