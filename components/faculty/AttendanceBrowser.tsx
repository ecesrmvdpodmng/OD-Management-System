"use client";

import { useEffect, useMemo, useState } from "react";
import { studentMajors, studentMinorsByMajor } from "@/lib/validation/auth";
import type { StudentMajor, StudentMinor } from "@/types/domain";

type AttendanceRow = {
  requestId: string; reference: string; studentId: string; studentName: string; registerNumber: string;
  major: StudentMajor; minor: StudentMinor; section: "A" | "B"; eventName: string; date: string; reason: string;
  attendanceStatus: "PRESENT" | "ABSENT";
};
const sections = ["A", "B"] as const;

export function AttendanceBrowser() {
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [major, setMajor] = useState<StudentMajor | "">("");
  const [minor, setMinor] = useState<StudentMinor | "">("");
  const [section, setSection] = useState<"A" | "B" | "">("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    fetch("/api/faculty/attendance", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { records?: AttendanceRow[]; message?: string };
        if (!response.ok) throw new Error(payload.message || "Attendance records could not be loaded.");
        if (active) setRows(payload.records ?? []);
      })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Attendance records could not be loaded."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const majorRows = useMemo(() => rows.filter((row) => !major || row.major === major), [rows, major]);
  const minorRows = useMemo(() => majorRows.filter((row) => !minor || row.minor === minor), [majorRows, minor]);
  const availableSections = sections.filter((value) => minorRows.some((row) => row.section === value));
  const shownRows = minor && section ? rows.filter((row) => row.major === major && row.minor === minor && row.section === section) : [];

  const card = "rounded-lg border px-4 py-3 text-left font-semibold transition focus-ring";
  return <div className="space-y-5">
    <div><h2 className="text-2xl font-bold text-navy">Approved OD Attendance</h2><p className="mt-1 text-sm text-muted">Choose a Major, Minor, and Section to view HOD-approved OD attendance across your department.</p></div>
    {error ? <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
    {loading ? <p role="status" className="rounded-lg border border-line bg-white p-5 text-sm text-muted">Loading eligible approved ODs…</p> : null}
    {!loading && !rows.length ? <p className="rounded-lg border border-line bg-white p-5 text-sm text-muted">No HOD-approved ODs in your department are currently eligible for attendance.</p> : null}
    {!loading && rows.length ? <>
      <section aria-label="Choose Major"><h3 className="mb-2 font-semibold text-navy">1. Choose Major</h3><div className="grid gap-3 sm:grid-cols-2">{studentMajors.map((value) => <button key={value} type="button" aria-pressed={major === value} onClick={() => { setMajor(value); setMinor(""); setSection(""); }} className={`${card} ${major === value ? "border-navy bg-navy text-white" : "border-line bg-white text-navy hover:border-accent"}`}>{value}</button>)}</div></section>
      {major ? <section aria-label="Choose Minor"><h3 className="mb-2 font-semibold text-navy">2. Choose Minor</h3><div className="flex flex-wrap gap-2">{studentMinorsByMajor[major].map((value) => <button key={value} type="button" aria-pressed={minor === value} onClick={() => { setMinor(value); setSection(""); }} className={`${card} ${minor === value ? "border-accent bg-blue-50 text-accent" : "border-line bg-white text-navy hover:border-accent"}`}>{value}</button>)}</div></section> : null}
      {major && minor ? <section aria-label="Choose Section"><h3 className="mb-2 font-semibold text-navy">3. Choose Section</h3><div className="flex flex-wrap gap-2">{availableSections.map((value) => <button key={value} type="button" aria-pressed={section === value} onClick={() => setSection(value)} className={`${card} ${section === value ? "border-accent bg-blue-50 text-accent" : "border-line bg-white text-navy hover:border-accent"}`}>Section {value}</button>)}{!availableSections.length ? <p className="text-sm text-muted">No eligible students in this Major and Minor.</p> : null}</div></section> : null}
      {major && minor && section ? <section aria-label="Eligible approved OD attendance" className="rounded-lg border border-line bg-white p-4 shadow-soft sm:p-5"><h3 className="font-semibold text-navy">{major} → {minor} → Section {section}</h3>{shownRows.length ? <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[820px] text-left text-sm"><thead><tr className="border-b text-muted">{["Student","Register No.","Major","Minor","Section","OD Date","Event / Reason","Attendance"].map((label) => <th key={label} className="p-2">{label}</th>)}</tr></thead><tbody>{shownRows.map((row) => <tr key={`${row.requestId}:${row.studentId}`} className="border-b border-line align-top"><td className="p-2"><span className="font-medium">{row.studentName || "—"}</span><span className="block text-xs text-muted">{row.reference}</span></td><td className="p-2">{row.registerNumber || "—"}</td><td className="p-2">{row.major}</td><td className="p-2">{row.minor}</td><td className="p-2">{row.section}</td><td className="p-2">{row.date || "—"}</td><td className="max-w-xs whitespace-pre-wrap p-2">{[row.eventName, row.reason].filter(Boolean).join(" · ") || "—"}</td><td className="p-2 font-medium text-emerald-700">{row.attendanceStatus === "PRESENT" ? "Present" : "Absent"}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-muted">No eligible approved OD records for this selection.</p>}</section> : null}
    </> : null}
  </div>;
}
