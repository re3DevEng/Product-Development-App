# Product Development App — project context

## Current objective: replace AppSheet

September 16 scope expansion: the user wants an internal product development hub covering machine/version development, custom customer machines, and software requests/changes with history, alongside the existing feature tracker. PROJECTS_DESIGN.md defines two project types, read-only overview layout, links to existing features, and audit expectations. The local Projects foundation is now implemented. Project phases/numbering are starting defaults, not established company procedures. Software workflow, detailed requirements/milestones, and cloud integrations remain separate milestones.

The user has defined this project as an internal-only replacement for the AppSheet app. Priorities: easier use, code-level customization, easier changes, and a foundation that can grow into broader product-development organization. Recreate the key existing features first and retain Google Drive as a central part of the system. External users and a public request app are explicitly out of scope for the replacement.

The team has another web app for contract-print tracking built using Supabase and Vercel and developed in Visual Studio Code. Its code has not been inspected; it is a reference point, not an instruction to share its database or assume a particular framework.

Read PRODUCT_DEVELOPMENT_APP_BRIEF.md for the replacement scope and FIRST_VERSION_DESIGN.md for the initial screen/data design. The user accepted the recommended architecture on September 11, 2026: Supabase is the authoritative store for structured records and application history, Vercel hosts the custom web app, and Google Drive/Docs holds files and templates. Google Sheets is a migration source and possible reporting/export destination, not a second editable source of truth. This decision is settled; do not ask the user to choose the storage architecture again. Next.js with TypeScript is the selected implementation framework for the initial design.

Design the replacement around one authoritative feature record with filtered views, stable IDs, persistent document links, reliable document creation, and reversible lifecycle changes. Potential expansion areas are not first-release requirements.

## Implementation status — September 14, 2026

The first local Next.js/TypeScript prototype is built. See README.md for running it and the source guide. It implements sample request creation/editing, multiple owners/products, ECR/OCR stages, searchable filtered lists, roadmap tracking, archive/restore, linked Google files, activity history, sample settings, and local browser persistence with cross-tab revision checks. Document outlines are previews only. The prototype uses invented sample records and people, not imported AppSheet data. Any record named “Prototype check” is an end-to-end test example.

No cloud infrastructure, real authentication, shared Supabase persistence, automatic Google Doc creation, migration, or deployment has been performed. The local server is a review environment, not the replacement’s production backend. Next: review the prototype with the user, then implement Supabase/internal access before the Drive connection and reconciled trial import. Do not restart architecture planning or modify the existing AppSheet app.

## Latest workflow feedback and completed milestone

System readable numbers now use SYS-YYYY-NNN. Saved PRJ numbers migrate to SYS on load, keeping the same internal IDs, year/sequence, links, documents, history and counters. This supersedes the earlier decision to retain PRJ during the terminology-only rename.

Terminology update: user-facing Projects/Project is now Systems/System throughout navigation, page views, history kinds/filters, forms, actions, document sections, feature links, messages, and generated activity labels. Internal project storage keys/types and existing PRJ numbers stay unchanged for saved-data compatibility. Existing user-authored titles/notes are preserved. Build and all 24 tests passed.

Project UI now calls Linked work “Linked features” consistently in the tab, overview heading/button, creation notice, and feature-preview guidance. Relationships and behavior are unchanged.

Individual projects now have a Documents tab and an overview summary showing up to three linked files. Users can name and link individual Google Drive/Docs files; URLs are validated/normalized using the existing feature logic, duplicates rejected, and additions logged to project activity. Saved projects migrate additively to documents: []. Links survive archive/complete/cancel/restore. Document drafts have discard/unsaved-exit protection and capture a revision to prevent overwriting concurrent changes. Files are not uploaded or created, and access is not verified; Drive automation remains future scope.

History lists now match the Features table: shared status/priority badges and owner avatars, identical title/number/product layout and row arrows, plus review-stage or project-phase progress graphics. Project tags distinguish projects while retaining the All/Features/Projects filter. Shared badge components live in record-badges.tsx.

Features and Projects sidebar groups now expand/collapse independently with separate chevron buttons, initially open. Parent page buttons remain independent navigation actions with visible “View all features/projects” subtitles. Collapsing does not navigate, and opening the parent page does not toggle the submenu. Disclosure buttons include accessible names, expanded state, and controlled-group references. Expanded state lasts for the current session.

Sidebar hierarchy: Features opens the active feature list with indented Engineering changes and Operational changes. Projects opens the active project list with Roadmap first beneath it, then up to five recent active projects ordered by last update, opening their existing preview directly. Shared History tabs remain below both groups. Roadmap behavior remains the existing feature roadmap; this change reorganizes navigation only.

Project cancellation button is now labeled Cancel project. Features retain Cancel work. Cancellation behavior and history are unchanged.

Shared history navigation: Complete, Archive, Declined, and Cancelled now combine project and feature records with All/Features/Projects selection buttons, shared search/owner/product filters, and Recent/Priority/Title sorting. Sidebar history counts include both types. Clicking a row opens its original project or feature preview. Declined has no projects because projects start in work; its Projects filter explains this. Projects now lists active projects only; removed the duplicate project-status dropdown. No record migration is needed for this display change.

Projects now start In work immediately upon creation, per user request. Removed Planning status/filter and Start work action. Existing saved Planning projects and Planning restore targets migrate to In work without changing their details/history; Archive/Complete/Cancelled restore to In work. Build and all 22 tests passed, including legacy migration. This supersedes the Start work behavior below.

Project status controls now match feature controls and placement above the edit form: Start work (Planning), Complete (In work), Archive, Cancel work, Restore for closed projects, and Delete permanently with typed project-number confirmation. Save/Discard remain separate and pending edits disable status buttons. Ordinary actions record history directly without a mandatory note; completion with unresolved linked features still asks for a reason. Legacy On hold projects migrate to Archive with history preserved; archived projects are excluded from the active list/count. Permanent project deletion removes its links/history but leaves linked features and counters intact. This supersedes the initial Projects milestone's required notes and lack of deletion UI.

Project product family/base machine now uses four visible selection buttons: Gigabot, Gigabot X, Terabot, and Terabot X. Version remains a separate field. These choices are independent of the feature tracker's affected-product list. Existing saved project values are preserved and shown with a note when outside these four families; users can explicitly update them while editing.

Projects foundation: added Projects navigation, search/type/status filters, project creation/preview/editing, separate annual PRJ numbers, type-specific phase graphics, owners/customer/product/version/date fields, and explicit lifecycle actions with reason notes. Completing or cancelling a project never changes linked feature status. Project type is fixed after creation. Linked work supports many-to-many feature links, search, unlinking, and opening the existing feature dialog; feature previews show reciprocal project links. Activity records project field before/after values, status reasons, and link/unlink events. Feature permanent deletion removes its project references and associated link events without a tombstone. Projects have no permanent-delete UI in this milestone. Shared dialog and selection components moved to shared-ui.tsx.

Existing browser data is upgraded additively with empty projects/counters and no reset. Tests: 18 passed (12 existing + 6 project scenarios covering migration, annual numbering, shared records, stale edits, lifecycle independence, deletion cleanup, and malformed saved data); production build/typecheck passed. Browser verification exercised creation, editing, linking, reciprocal navigation, unlinking, and history. A clearly labeled sample project PRJ-2026-001 “Prototype check — machine project” was created for this check; the temporary link to feature 2026-001 was removed and the feature itself was not edited. Next: user review of this bounded milestone before adding requirements/milestones or software.

The feature preview description appears above the colored information panel; documents remain below it.

Preview visual hierarchy: the colored information panel now uses larger, stronger values (16–18px), readable 13px labels, larger owner avatars and review progress bars, and a more distinct green background. Narrow screens stack the fields to preserve readability.

The read-only feature preview now displays the same review-stage progress graphic as the list, using a shared component. The graphic stays hidden for Not started, and the entire review-stage field stays hidden until a work type is assigned.

Latest simplification: removed the separate priority-filter button bar and its filter state. Priority remains available in the sort bar as the single list-level priority control. Priority badges and the editable priority field remain. Search and owner/product filters are unchanged.

Drive planning decision: the user specified `ECR Number- Title/` containing `CAD/`, `Design Notes/`, and `Supporting Files/`. Inside CAD: `SLDASM/`, `SLDPRT/`, `STEP/`, and `Drawing/` (singular). The exact tree is recorded in FIRST_VERSION_DESIGN.md. This replaces the earlier suggested tree with Testing. Use the same subfolders for OCR with its corresponding number/title. Implement during the Drive phase; no Drive changes now. Keep one folder associated with the permanent feature ID; app deletion must not delete Drive files. Placement of the working ECR/OCR document remains to be finalized.

September 16: removed the combined “Save & …” behavior at the user's request. Complete, Archive, Cancel work, Decline, and Restore retain stable labels, use only saved feature values, and are disabled while feature fields or a document-link draft have unsaved changes. The footer uses Save changes and Discard edits (renamed from Cancel edits), clearly separating draft edits from cancelling the whole feature. Browser checks verified stable labels, disabled actions during both kinds of drafts, re-enabling after edits are resolved, and discarding without changing the saved record. The build/type check passed. This supersedes earlier notes about combined saving/status actions. No saved user records were changed.

Latest milestone: clicking a feature now opens a read-only information overview with status, priority, work type, owners, products, applicable review stage, roadmap membership, description, document links, and dates. Edit feature explicitly enters edit mode. Status/deletion actions and adding document links require that mode. Save changes returns to the overview; Cancel edits discards draft changes. Documents and Activity remain readable without editing. Read-only views refresh when another tab updates the feature, while editing retains conflict detection. Build/type checking and desktop/mobile browser checks passed. No user-created records were changed. Stop at this milestone pending user feedback.

Latest UI refinement: short dropdowns are now compact, keyboard-accessible radio-button selections for priority, work type, review stage, document role, priority filtering, and sorting. Owner/product filters remain dropdowns because those configurable lists can grow. Review stage is hidden while work type is Unassigned and appears with the applicable ECR/OCR stages after selection. Started work still cannot select Unassigned. Build/type checking passed; browser checks covered stage visibility/reset, priority filtering, keyboard arrows, sorting, and narrow-screen layout. Existing saved records were not changed. Await the user's next milestone.

September 15 update: the user approved Cancel (retaining history) for started work and a separate permanent Delete for mistakes. Both are implemented. Request offers Decline/Archive/Delete; In-Work offers Complete/Cancel work/Archive/Delete. Cancelled has its own sidebar history view. A durable hasStarted flag prevents returning started work to Request or clearing ECR/OCR, including after restore. Older browser samples are upgraded without resetting data. Permanent deletion requires typing the feature number and removes the entire feature, linked-file references, and activity, with no tombstone/deletion log; linked Drive files and past exports remain untouched. Allocation counters stay monotonic. All 12 regression tests and the production build passed. Browser checks verified cancellation/restoration, disabled Unassigned, request-only Decline, confirmation gating, Escape dismissal, and record preservation. No user records were deleted. This completes the current bounded milestone; await user feedback before Supabase work.

The user successfully tested creating a request, assigning owners, choosing ECR/OCR, setting the review stage, and adding it to the roadmap. Archiving was hard to discover in the lifecycle dropdown. The dropdown has now been replaced with a saved-status indicator and visible Complete, Archive, and Decline buttons at the top of the feature panel. Closed features show Restore, which returns typed work to In-Work and unassigned work to Request. Actions save immediately and retain the record; with unsaved feature edits, buttons explicitly say Save & complete/archive/decline/restore. Browser checks passed for all actions, file preservation, and saving edits while archiving. Production build passed.

Work in one bounded milestone at a time, as requested by the user. Stop after each milestone and record progress to make resuming efficient. Next: let the user try the new archive/restore controls; do not begin Supabase setup in the same milestone.

## Historical AppSheet baseline

Baseline review: September 11, 2026. Read NEW_FEATURE_REQUEST_APP_REVIEW.md for the detailed review and review-data-audit.json for the stored-data findings.

The user's existing New Feature Request App is built in Google AppSheet for re:3D/Gigabot. Goal: approachable internal/customer intake connected to roadmap review, ECR/OCR document creation, ownership, progress, and lifecycle tracking. It replaces the spreadsheet/Google Form user experience while retaining Google Sheets as backend and Google Docs for detailed work.

Source workbook: https://docs.google.com/spreadsheets/d/1FVAXuU3M4Odj1YI6wzOJNQt67cLZ5YpFfiU501o_tfs/edit
Project Drive folder: https://drive.google.com/drive/folders/1BOQ7FhfQSv89w3yA8mQyRNi9ycJO2sfl
Process presentation: https://docs.google.com/presentation/d/1GyNQYZNZBe8PxYaJJ9G_Mgl_s84R54oSrcFLFhrE1ek/edit
Build conversation: Google Sheets Script Setup, task ID 68757c63-206c-8007-9952-ef17e6015d23 (87 turns read).
Related task: Assess feature request folder move, ID 01a091f1-406f-7c22-9b4b-c311f406579e.

User confirmed building separate internal/external apps sharing the workbook and using ID # as key in every table. Current visible tabs: How to Use, Info, New Feature Requests, ECR, OCR, Roadmap Features, Complete, Archive, Declined, Used ID. There are also 11 hidden legacy/development tabs; PD ECR appears in older plans/template but its live app availability is unverified.

Snapshot: 78 distinct current requests; 63 active (38 ECR, 25 OCR), 13 complete, 2 archived, 0 declined, 18 roadmap members. Used ID contains exactly those 78 without duplicates. Active memberships match, but copied fields differ for 11 features. Roadmap has two missing document links and one actual document-target mismatch. Snapshot counts exclude hidden legacy tables.

Main difficulties from history: cross-table copies falling out of sync, reverse archival movement, chained bots failing to trigger, reused/generated IDs, URL/formula/smart-chip handling, repeated document creation on unrelated edits, sync delays, and convenient access from Drive. User wants easy access and a maintainable workflow.

Distinguish reported intent/history from verified current configuration. The AppSheet editor requires sign-in in the available browser. Final bot definitions, scripts, keys/types/formulas, permissions, external-app security, licensing, deployment, and execution logs were not inspected. Earlier assistant suggestions are not proof of implemented features or correct platform behavior. No cloud edits were made.

Platform facts verified in official Google documentation: app-event bots do not cross between separate apps sharing data; bot chaining needs explicit configuration; programmatic spreadsheet writes do not generally fire Apps Script edit triggers; ordinary max-plus-one IDs are not concurrency-safe for distributed/offline creation; sync and security require configuration-aware treatment.
