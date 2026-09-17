# Product development hub — projects milestone

Design baseline: September 16, 2026. The local Projects foundation is now implemented: list, create/preview/edit, phase and lifecycle actions, project activity, and reciprocal feature links. Detailed requirements and milestones remain planned. The workflows below are starting defaults, not confirmed company procedures.

## Purpose

Keep machine development, custom customer machines, individual changes, and future software work connected in one internal workspace. A project represents an overall outcome; a feature represents a specific change. Projects have their own requirements, milestones, owners, documents, and history rather than adopting the ECR review workflow for an entire machine.

## Project types

| Type | Purpose | Additional information |
|---|---|---|
| Machine development | Develop a new machine or a new machine version | Product family, target version, intended capabilities, release criteria |
| Custom customer machine | Engineer and deliver a customer-specific machine | Customer/company name, base machine/version, customer requirements, acceptance criteria; order reference optional |

Both types share title, description/objective, owners, priority, target date (optional), lifecycle status, phase, requirements, milestones, linked work, documents, and activity. Customer details are internal records; this does not introduce customer accounts or external access. Commercial order management remains outside this milestone.

Use stable internal IDs. Proposed readable project numbers are PRJ-2026-001 with a separate annual counter from feature numbers. Store links by internal ID, never by title or readable number. Existing feature numbers remain unchanged.

## Workflow

Lifecycle: projects start In work at creation, then can become Complete. There is no Planning status or Start work step. Archive and Cancelled preserve work and history. Restore returns every project to In work. Controls match features: Complete, Archive, Cancel work, Restore, and Delete permanently. Ordinary status changes log automatically without a mandatory reason dialog. Earlier On hold records migrate to Archive without losing history.

Phase is separate from lifecycle:

| Machine development | Custom customer machine |
|---|---|
| Requirements | Requirements |
| Design | Design |
| Prototype | Build |
| Validation | Acceptance testing |
| Release readiness | Delivery readiness |

These are coordination phases, not automatic approval gates. Advancing a phase records a change; it does not imply that every requirement was accepted or every linked feature completed. Completion is an explicit action. Show unresolved work before completion and record a reason when proceeding with unresolved items. Do not close or cancel linked features automatically.

## Overview screen

Click a project to open its read-only overview. Use an Edit project button, preserving the feature preview's separation between reading, editing, and lifecycle actions.

Display order:

1. Project number, title, type, lifecycle indicator, and Edit project.
2. Description/objective, above the colored information panel.
3. Prominent colored panel: owners, priority, product/version or customer/base machine, phase with a segmented graphic, and target date or “Not set.”
4. Milestone summary: next unfinished milestone, target date, and a count such as “2 of 6 milestones complete.” Avoid an overall percentage that suggests equally weighted engineering work.
5. Linked work summary: open/completed feature counts and links to the actual records.
6. Requirements/acceptance summary and document shortcuts.

Tabs: Overview, Requirements, Milestones, Linked work, Documents, Activity. Only expose functional tabs when their corresponding milestone is built.

Requirements: individual statements with stable IDs, owner, acceptance criteria, and states Proposed, Accepted, Verified, or Dropped. Record verification evidence and a reason for dropping a requirement. “Accepted” means agreed scope; “Verified” means evidence meets the criteria.

Milestones: name, owner, optional target date, state Not started/In progress/Complete, and completion note. These track project outcomes such as prototype assembly or acceptance testing, not every small task.

## Connect existing features without duplication

- Features may stand alone or link to multiple projects. One common improvement can support a standard machine release and a custom build.
- A project-feature link carries the project ID, feature ID, time, and actor. Enforce one link per pair.
- Linking does not copy a feature, change its owners, advance its stage, or move its files. Opening it uses the existing feature preview.
- Add a Projects section to feature previews so users can navigate in both directions.
- Unlinking removes the relationship, not the feature, and records the action. Do not infer project membership from affected products.
- Project lists show title, type, status, phase, owners, target date, and next milestone. Search and type/status filters are enough for the initial screen.

## Software expansion boundary

Software will have its own requests, bugs, changes, testing, and release records. Do not add Software as a third ECR/OCR type or force software through hardware design reviews. Software items can later link to the same projects and to software releases. Keep source code, commits, and pull requests in Git; store references in this app. Software screens and workflow are a separate milestone.

## Files

Google Drive remains the file store. Each project can eventually have its own folder for project-level requirements, design, and acceptance evidence. The project folder structure has not been decided; do not impose the feature folder template on it automatically.

Existing ECR/OCR folders retain the exact agreed structure in FIRST_VERSION_DESIGN.md. Reference linked feature folders from projects rather than moving or duplicating them. Database records store durable Drive IDs. No Drive provisioning in the local project milestone.

## Activity and deletion

Target audit events include creation, edits with before/after values, ownership changes, lifecycle and phase changes, requirement acceptance/verification, milestone changes, project-feature linking/unlinking, and document link changes. Store actor, timestamp, entity ID, action, and relevant values. A project feed can include linked feature activity, labeled with its originating record, without duplicating the source events.

The current browser prototype stores demo-user activity summaries; it is not yet a complete shared audit system. Production changes and activity must be committed together in Supabase with authenticated actors and conflict protection. Linked Google documents and Git repositories retain their own content-edit history; the app must not claim to log every external file edit without an integration that captures it.

Normal closure, cancellation, and archival preserve history. The user's existing permanent-delete exception remains for mistakes. Project deletion must never cascade into linked features or Drive files. Before exposing permanent deletion for the expanded records, implement cleanup of relationship references and app activity references so the promised no-history behavior remains consistent. Avoid retaining copied titles or change snapshots for permanently deleted records in other feeds.

## Next build: local Projects foundation

Deliver only these functions in the next implementation milestone:

1. Projects navigation and searchable list for the two project types.
2. Create, preview, and edit project details, status, and phase.
3. Link/unlink existing features and show reciprocal project links on feature previews.
4. Project activity for all changes supported in this milestone.
5. Safe migration of existing browser data; no reset or loss of current features.

Defer detailed requirements, milestone editing, software, Drive automation, and cloud setup to separate milestones. The initial overview can show project details and linked work without nonfunctional placeholder controls.

Acceptance: a user can create one of each project type, link the same feature to both without copying it, edit that feature and see the change through both projects, unlink without deleting, and reload without losing records. Verify activity, stale-edit detection, and migration from existing saved data. Completing a project must leave its linked features unchanged.

