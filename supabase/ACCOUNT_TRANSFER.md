# Supabase migration audit and account-transfer runbook

Audit date: 2026-10-10. This is a repository review only. No Supabase project was linked, no production database was queried or changed, and no SQL migration was executed against PostgreSQL.

## Findings that block a blind migration push

1. Two SQL files have the same Supabase migration version, `202610080001`: `202610080001_hod_faculty_requests.sql` and `202610080001_student_only_categories_hod_limits.sql`. Supabase migration history tracks the version, not both filenames independently. Resolve this against the production migration ledger and the exact deployed source before renaming, squashing, repairing migration history, or pushing to any linked project. Both changes are functionally required; neither file is safe to discard based on its name.
2. `202609230001_initial_schema.sql` and `202609240001_production_workflow.sql` explicitly drop public tables, functions, and types with `CASCADE` before recreating them. They can erase application data if rerun against an existing database. Keep them as historical records, but never use them as a production repair/reset script.
3. There is no `supabase/config.toml`; Auth, SMTP, OAuth, redirect URLs, Storage, project secrets, and deployment settings are not configured by this migration set. `supabase/seed/` is empty, despite older README instructions that referenced a nonexistent `seed.sql`.
4. `supabase/migrations/staff-invitation-profile-regression.test.ts` was application test source, not a migration. It has been moved to `lib/validation/staff-invitation-profile-migration.test.ts`.
5. No Git metadata, linked Supabase CLI, PostgreSQL client, or Docker/Supabase local stack was available here. The actual production migration ledger and clean-database replay could not be checked. Therefore this audit does not certify that the current sequence replays cleanly.

## Migration inventory

Dependencies below mean the expected prior schema state based on SQL references, not an assertion that the production ledger confirms the migration was applied.

| Migration | Purpose and dependencies | Recommendation |
| --- | --- | --- |
| `202609230001_initial_schema.sql` | Original full schema bootstrap: enums, departments/profiles/OD/attendance/notification/request tables, functions, triggers, indexes, RLS, grants and initial ECE department data. Has destructive `DROP ... CASCADE` preamble. | **Retain as history.** Do not rerun on a populated database. Superseded in part by the next migration, but not safe to delete without confirmed history and a tested baseline. |
| `202609240001_production_workflow.sql` | Replaces the first schema with the production workflow schema; relies on Supabase `auth` schema and core Supabase roles. Also destructive `DROP ... CASCADE` reset. | **Retain as history.** Fresh bootstrap only; never deploy as a repair to existing production. |
| `202609240002_security_workflow.sql` | Builds on production schema: audit logging, workflow/security functions, policies and privilege grants. | **Retain.** Required security/workflow evolution. |
| `202609270001_multi_student_od.sql` | Transitions to parent/child OD records, adds `WITHDRAWN`, audit/notification/attendance and submission/review/withdrawal RPCs, supporting RLS and grants. Requires the production schema. | **Retain.** Historical transition; later changes intentionally make student submissions one-student-only while retaining the relationship table. |
| `202609280001_profiles_own_read_policy.sql` | Adds own-profile read policy needed for authenticated profile lookup. | **Retain.** Later migrations refine/replace policy details, but this is part of historical replay. |
| `202609290001_auth_staff_and_od_hardening.sql` | Adds academic-year, OD-limit, reviewer, approval-history, faculty-role-request structures; profile helpers, Auth provisioning and hardened RPC/RLS behavior. | **Retain.** Core current workflow/security objects. |
| `202609290002_profiles_self_lookup_access.sql` | Ensures authenticated users can look up their own profile under the correct `auth_user_id` policy. | **Retain.** Needed by auth/profile flow; subsequent policy cleanup depends on this evolution. |
| `202609290003_auth_student_profile_provisioning.sql` | Replaces the Auth user trigger for complete student profile provisioning and removes obsolete completion function. | **Retain.** Current student registration path depends on trigger behavior later updated by migration `202610100003`. |
| `202609300001_fix_portal_rls_and_schema_alignment.sql` | Replaces legacy broad policies with scoped policies and helper checks; aligns grants/columns for portal access. | **Retain.** Essential access-control correction. |
| `202609300002_admin_profile_directory.sql` | Adds admin-only profile directory/search RPC where direct profile email selection is restricted. | **Retain.** Current admin listing dependency; replaced by v2 in the latest migration while v1 is the history. |
| `202609300003_admin_profile_management.sql` | Adds server-authorized admin role and active-status management RPCs. | **Retain.** Admin authorization workflow. |
| `202610010001_staff_invites_and_academic_year_admin.sql` | Adds staff invitation lifecycle, staff setup and academic-year administration functions, and OD limit seeding behavior. Requires profile/Auth/workflow tables. | **Retain.** Required by Faculty/HOD invitation and settings flows. |
| `202610020001_resend_pending_staff_invites.sql` | Updates invitation/Auth provisioning behavior to permit safe resend/restart of incomplete invitations. | **Retain.** Invitation retry behavior. |
| `202610060001_staff_invitation_callback_setup.sql` | Extends invitation completion state and setup RPC used after Auth callback. | **Retain.** Required for staff registration callbacks. |
| `202610070001_fix_staff_identifier_and_od_uuid_generation.sql` | Corrects staff ID validation/storage and removes extension-specific UUID generation dependency for OD rows; updates staff setup RPC. | **Retain.** Required for current staff and OD inserts. |
| `202610070002_fix_od_category_submission.sql` | Replaces OD submission RPC to persist the expected category/reason payload. | **Retain.** Current student OD submission dependency. |
| `202610080001_hod_faculty_requests.sql` | Adds HOD-to-admin Faculty account request RPC, deriving HOD identity and department from the session. | **Retain.** Required HOD workflow; its version collision must be reconciled. |
| `202610080001_student_only_categories_hod_limits.sql` | Adds category-specific OD limits, student-only ownership/submission logic, scoped read policy and HOD limit management; drops obsolete student-search RPC. | **Retain.** Current OD security/business logic; its version collision must be reconciled. |
| `202610080002_hod_faculty_request_reason.sql` | Updates HOD Faculty request constraints/RPC to store a required reason. Depends on `faculty_role_requests` and the earlier request RPC. | **Retain.** Current request form behavior. |
| `202610080003_special_od_approval_workflow.sql` | Adds special OD eligibility/submission/approval fields and RPCs for student, Faculty and HOD steps. | **Retain.** Current special OD workflow. |
| `202610100001_complete_existing_staff_invitation_profile.sql` | Completes an existing invitation-created profile for the authenticated invitee, preserves invitation role/department, and supports safe retry. | **Retain.** Current staff completion fix. |
| `202610100002_student_sections_core_vlsi_ds.sql` | Historical interim change that accepted Core/VLSI/DS values in `profiles.section` and updated the student Auth trigger. | **Retain as history.** Followed by the separate section/class migration below; do not remove until a replacement baseline is verified. |
| `202610100003_student_section_and_class.sql` | Adds nullable `student_class`, preserves existing section values, validates A/B section and Core/VLSI/DS class for new registrations, updates Auth trigger and admin directory v2. | **Retain.** Latest student profile schema/provisioning change. |

### Consolidation/removal decision

No SQL migration is removed or renumbered. The historical sequence contains destructive bootstraps, successive function/policy replacements, and one duplicate version; a squash without a production ledger and clean replay could lose data or security behavior. A new baseline should be created only from a verified staging copy of the actual production schema, replayed and acceptance-tested on a separate empty Supabase project. Keep the current history/tag intact until that baseline and a cutover plan have been approved. Do not run `migration repair` or manually edit `supabase_migrations.schema_migrations` as a shortcut.

## Safe account-transfer procedure

### 1. Establish the source state (read-only first)

Use a trusted operator workstation and the source project ref. Do not paste secrets into commands, chat, or source control.

```powershell
supabase login
supabase link --project-ref SOURCE_PROJECT_REF
supabase migration list --linked
```

Also inspect the source project's `supabase_migrations.schema_migrations` ledger directly using read-only SQL and compare the recorded versions to this directory and the deployed commit. In particular, establish which contents correspond to version `202610080001`. Preserve a database backup and the exact deployed source commit before planning any repair. Do not run `supabase db push` against production during the audit.

### 2. Provision a staging project under the destination account

Create a separate destination staging project, not the production destination. After reconciling the duplicate migration version, follow the chosen tested method:

- **Replay path:** apply the reconciled migration history to a genuinely empty project and confirm every migration succeeds in order. Do not replay the destructive bootstrap on a nonempty database.
- **Baseline path:** create a baseline from a verified source/staging schema snapshot, preserving extensions, enums, tables, sequences, constraints, indexes, grants, RLS policies, triggers, functions, and required reference data. Test baseline creation and all subsequent migrations on a new empty project. Preserve the old history in its original branch/tag and define how the destination migration ledger is initialized through a reviewed, documented procedure.

Supabase Auth users, password hashes, provider identities, SMTP/OAuth settings, project secrets, and deployed edge/runtime configuration are not recreated by these SQL migrations. Use Supabase-supported export/import or account/project-transfer procedures for Auth identities and application data; rehearse with backups and test accounts. Do not copy Auth rows with ad hoc SQL, reset passwords, or assume user UUIDs survive a transfer. If UUIDs change, preserve/re-map every `profiles.auth_user_id` and verify ownership/identity before cutover.

### 3. Recreate project settings manually and privately

Configure the destination project's Authentication settings before app testing:

- Site URL and allowed redirect URLs: local, preview, and production `/auth/callback` URLs plus the staff invitation callback URL used by the current app.
- Email confirmation and password-reset behavior; configure SMTP sender, credentials, SPF/DKIM as applicable, and review invitation/confirmation/reset templates.
- Google provider client ID/secret and provider callback URL; add destination application origins/redirects at the OAuth provider.
- Any CAPTCHA, session/refresh-token, JWT, MFA, rate-limit, and custom SMTP settings that source actually uses.
- Recreate Storage buckets and Storage policies only if the source project has them. Current app request flow does not require a document bucket.

Set application secrets in Vercel's encrypted environment settings for the new project:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (or the compatible publishable key supported by the configured client)
- `NEXT_PUBLIC_APP_URL`
- `ALLOWED_EMAIL_DOMAIN=srmist.edu.in`
- `ENABLE_DEMO_AUTH=false`
- `SUPABASE_SERVICE_ROLE_KEY` (server-only, required by current staff invitation and admin provisioning actions)
- `COLLEGE_NAME`, `COLLEGE_DEPARTMENT`

Never name a privileged key `NEXT_PUBLIC_*`, commit it, or expose it in browser bundles/logs. Rotate the destination service-role secret after setup if it was handled outside the intended secret manager.

### 4. Validate before cutover

Run the reconciled migration/baseline process only on staging; then compare schema inventories and test with separate disposable student, Faculty, HOD, and Admin Auth users. Verify trigger provisioning, invitations and callbacks, role/department boundaries, OD submission ownership, approvals, special OD workflow, attendance, notifications, and direct unauthorized API attempts. Test email delivery and Google OAuth end-to-end. Deploy Vercel Preview against staging first. Keep source production available and backed up until data/Auth migration and rollback are explicitly rehearsed.

## Local checks and current limitations

The repository was checked statically, but no local `supabase`, `psql`, or `docker` executable/project was available for SQL parsing, clean replay, or RLS integration checks. `npm run build` and `npm test` are the application checks; they do not validate PostgreSQL syntax or production migration state. Do not mark the destination project portable until the staging replay/baseline and Auth/data transfer tests pass.
