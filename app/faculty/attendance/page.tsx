"use client";

import { AppShell } from "@/components/layout/AppShell";
import { useDemo } from "@/components/od/DemoProvider";
import { AttendanceBrowser } from "@/components/faculty/AttendanceBrowser";

export default function FacultyAttendancePage() {
  const { currentUser } = useDemo();
  return <AppShell user={currentUser}><AttendanceBrowser /></AppShell>;
}
