"use client";

import { useState } from "react";
import { promoteAllStudentsAction, wipeODWorkflowDataAction } from "@/app/actions/admin-maintenance";
import { AppShell } from "@/components/layout/AppShell";
import { useDemo } from "@/components/od/DemoProvider";

type PendingAction = "promote" | "wipe" | null;

export default function DatabaseFlushPage() {
  const { currentUser } = useDemo();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [wipePhrase, setWipePhrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function confirmAction() {
    if (!pendingAction || busy) return;
    if (pendingAction === "wipe" && wipePhrase !== "WIPE OD DATA") return;
    setBusy(true);
    setMessage("");
    setError("");

    if (pendingAction === "promote") {
      const result = await promoteAllStudentsAction();
      if (result.ok) setMessage(`${result.promoted} student account${result.promoted === 1 ? " was" : "s were"} advanced. B.Tech 4th-year and M.Tech 2nd-year accounts remain in their current year.`);
      else setError(result.message);
    } else {
      const result = await wipeODWorkflowDataAction();
      if (result.ok) setMessage("OD requests, approvals, attendance records, OD-linked audit entries, and notifications were permanently deleted. Student, Faculty, and HOD accounts and account-related records were preserved.");
      else setError(result.message);
    }

    setBusy(false);
    setPendingAction(null);
    setWipePhrase("");
  }

  return <AppShell user={currentUser}>
    <h2 className="text-2xl font-bold text-navy">Database Flush</h2>
    <p className="mt-1 max-w-3xl text-sm text-muted">Run student year progression or clear old OD workflow records. Account profiles, Supabase Auth accounts, staff invitations, departments, academic-year settings, and OD limits are preserved.</p>
    {message ? <p role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">{message}</p> : null}
    {error ? <p role="alert" className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}

    <div className="mt-6 grid gap-5 xl:grid-cols-2">
      <section className="rounded-lg border border-line bg-white p-5 shadow-soft">
        <h3 className="text-lg font-bold text-navy">Promote all students to next Year</h3>
        <p className="mt-2 text-sm text-muted">Advances B.Tech students from I to II, II to III, and III to IV. M.Tech students move from I to II. B.Tech IV and M.Tech II remain unchanged.</p>
        <button type="button" disabled={busy} onClick={() => { setError(""); setMessage(""); setPendingAction("promote"); }} className="mt-4 rounded-lg bg-navy px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Promote Students</button>
      </section>

      <section className="rounded-lg border border-red-200 bg-white p-5 shadow-soft">
        <h3 className="text-lg font-bold text-red-800">Wipe OD history and workflow data</h3>
        <p className="mt-2 text-sm text-muted">Permanently removes OD requests, reviewer assignments, approval history, attendance marks, OD-linked audit entries, and notifications. Student, Faculty, and HOD accounts and account-related records are kept.</p>
        <button type="button" disabled={busy} onClick={() => { setError(""); setMessage(""); setWipePhrase(""); setPendingAction("wipe"); }} className="mt-4 rounded-lg bg-red-700 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">Wipe OD Data</button>
      </section>
    </div>

    {pendingAction ? <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <section role="alertdialog" aria-modal="true" aria-labelledby="flush-confirm-title" aria-describedby="flush-confirm-description" className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
        <h3 id="flush-confirm-title" className={`text-xl font-bold ${pendingAction === "wipe" ? "text-red-800" : "text-navy"}`}>
          {pendingAction === "wipe" ? "Confirm permanent OD data wipe" : "Confirm student year promotion"}
        </h3>
        <p id="flush-confirm-description" className="mt-3 text-sm text-muted">
          {pendingAction === "wipe"
            ? "This permanently deletes OD requests, approvals, attendance, OD-linked audit history, and notifications. Student, Faculty, HOD, and Admin accounts remain. This cannot be undone."
            : "This updates every eligible student profile at once. B.Tech 4th-year and M.Tech 2nd-year accounts stay in their current year."}
        </p>
        {pendingAction === "wipe" ? <label className="mt-4 block text-sm font-medium text-slate-700">Type WIPE OD DATA to enable this action<input autoComplete="off" value={wipePhrase} onChange={(event) => setWipePhrase(event.target.value)} className="mt-1 w-full rounded-lg border border-line px-3 py-2" /></label> : null}
        <div className="mt-6 flex justify-end gap-3">
          <button type="button" disabled={busy} onClick={() => { setPendingAction(null); setWipePhrase(""); }} className="rounded-lg border border-line px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50">Cancel</button>
          <button type="button" disabled={busy || (pendingAction === "wipe" && wipePhrase !== "WIPE OD DATA")} onClick={() => void confirmAction()} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 ${pendingAction === "wipe" ? "bg-red-700" : "bg-navy"}`}>
            {busy ? "Working…" : pendingAction === "wipe" ? "Permanently Wipe OD Data" : "Promote Students"}
          </button>
        </div>
      </section>
    </div> : null}
  </AppShell>;
}
