# PDM implementation plan

## Agreed process

September 25 numbering clarification: drawing development edits now advance Rev0.1, Rev0.2, etc. Approval assigns DWG Rev1; later development uses Rev1.1, Rev1.2 before DWG Rev2 approval. Each saved entry preserves its development label, separate from its approved whole revision. This supersedes earlier descriptions below of a fixed drawing draft label and visible working-version counter. Internal version IDs remain for exact associations.

The planning summary is `output/pdf/PDM_Workflow_and_Rules.pdf` (September 23, 2026). It describes the intended final system, not current prototype capabilities. The parallel-release rules below supersede that PDF's earlier reconciliation rule; the PDF has not been regenerated.

- PDM is separate from Features, Software, and Systems. Drive stores files; the planned shared database stores identities, revisions, approvals, and relationships.
- ECR/OCR folders hold development copies; approved library files remain protected and previous releases remain available.
- New internal identifiers use creator initials and an app-assigned number. Identity is permanent, including after Odoo assignment.
- Ops assigns production numbers around ORR and decides whether a change retains its number or becomes a new numbered variant. R&D/contract parts may retain internal identifiers.
- Preserve the Odoo name format: `[number] Part Name [State] [Machine] [Special modifier] Rev#`. Use `Rev`, not `REV`. Renaming CAD must preserve references.
- Part/assembly and drawing development starts at Rev0.1; first approved release is Rev1. Subsequent model development uses RevN.1, RevN.2, etc., before release RevN+1.
- Drawing revisions are independent of model revisions. Working drawing uploads do not each increment the approved drawing revision. Drawing types: Machining, Inspection, Assembly; separate type folders preserve official filenames.
- Each required drawing must be updated, approved as still applicable, or declared not required with a reason. Changing printed PRT REV requires a drawing update and approval.
- Parts, assemblies, and drawings retain separate Drawn, Checked, Approved fields. Drawings inherit shared identification from model custom properties.
- Engineering approves collectively in a meeting; record date, participants, decision, and notes. An authorized person separately selects Release. Approvals cover exact files.
- Concurrent ECRs/OCRs are allowed. The first approved branch can release without waiting for other branches. Other unfinished branches based on older work show a newer-release notice and must document how they account for the released changes before release. Each later release of the same identity takes the next whole revision number; independent variants have their own sequence. Ops decides numbering/variants.
- Releases explicitly select receiving systems. Configurations reference exact released revisions; other systems stay unchanged. Physical retrofit tracking is separate.

## Milestone 1: draft register (implemented)

Creation workflow: create parts/assemblies from an active ECR/OCR's Parts & assemblies section. The form displays the source change, automatically links it at save, and returns to the source on create or cancel. Creation validates that the source still exists and is in work. The library has no standalone create action and serves as browsing/reference. Existing record editing and links remain available. Batch CAD registration remains future work; milestone 3 adds existing-part revision records and variants.

- PDM Library navigation, searchable part/assembly list, type selection, recent/name sorting.
- Read-only preview with explicit Edit record, separate Save changes and Discard changes.
- Draft name, description, kind, intended use, owner, optional Odoo number, linked ECR/OCR IDs.
- Permanent internal ID and separate UUID. Provisional numbering choice: one global numeric sequence, padded to five digits, prefixed by 2-5 creator initials. No annual reset. Confirm before shared database migration if sequences should instead be per initials.
- New items start Draft at working Rev0.1. Milestone 3 adds later working revisions. The record concurrency counter is distinct from the CAD revision.
- Edits and link changes create activity. Odoo assignment and owner changes preserve identity and CAD revision. Odoo values are manually entered, not verified by an integration.
- Bidirectional navigation between linked features and PDM records. Multiple ECRs/OCRs may link to a record; links do not constitute a controlled revision effort or release approval.
- Additive migration keeps all prior browser data. Counter validation, duplicate Odoo detection, stale-edit protection, and feature-delete cleanup are covered by tests.
- Uses existing browser-local storage and cross-tab serialization. IDs are unique only within that workspace, not across devices. Activity actor is Demo user, not authenticated identity.

## Not implemented in milestone 1

File upload/copy/download management; working CAD version history; drawing records; variant creation; exact assembly BOMs; system revision configurations; overlap reconciliation; meeting approvals; release publication; permissions; Odoo/SolidWorks integrations; PDM record deletion.

## Milestone 2: drawing records (implemented)

- Each part/assembly now has a Drawings tab and overview link. One draft drawing per type (Machining, Inspection, Assembly) is supported in this first stage.
- Drawing draft revision starts at 0.1; approved revision is explicitly absent. The exact model revision is captured on each working-version entry; milestone 3 adds selection from the model revision history.
- Record working versions with notes and a separate drawing author. Entries are append-only and retain their model revision, timestamp, and recording actor. The recording actor remains Demo user until authentication exists.
- Working version numbers increase without changing the drawing revision or the model revision. No approval or release action is implemented.
- Required drawing types start as Not assessed. Set each to Required or Not required; Not required needs a reason. Decisions and changes appear in part activity. Required drawings are shown as missing or draft/approval pending, never as approved.
- Existing saved parts migrate additively to empty drawings and unassessed requirements. Ordinary part edits preserve drawings. Stale writes, duplicate types, invalid versions, and unsupported approvals are rejected.
- Records and notes only: no actual drawing upload, download, CAD version storage, title-block modification, or Google Drive connection. Model revision selection uses existing revision records; there is no free-text way to claim association with a nonexistent revision.
- Verified 43 tests and production build; browser exercised drawing creation, second working version, requirements, and history on the illustrative QA-00001 record.

## Milestone 3: source revisions and variants (implemented September 24, 2026)

- From an active ECR/OCR, use Parts & assemblies > Change existing part. Search the library, choose an exact source model revision, choose Revise existing part or Create variant, select intended active systems, and describe the change.
- Revise existing part preserves its identity and Odoo number and appends the next draft working revision (0.2, 0.3, etc.). The same ECR/OCR can create multiple working revisions as testing leads to changes. The new revision retains its exact source revision. Existing model and drawing history stays intact. Selecting the part again defaults to that ECR/OCR's most recent result and still-active intended systems; the source can be changed explicitly. Revisions within one ECR/OCR do not trigger overlap warnings against each other.
- Create variant assigns a new internal ID and independent Rev0.1 history, retaining a link to the exact source. It starts without an Odoo number, drawings, or assessed drawing requirements. It inherits the source's kind, intended use, description, and owner; its name is editable during creation.
- Each change records its source and result revision, originating ECR/OCR, intended systems, notes, and Pending Ops numbering decision. Intended systems are planning associations, not edits to machine configurations.
- The original overlap warnings were replaced by milestone 4's newer-release notices. Concurrent work alone does not require reconciliation or prevent the first release. Independent variants are not marked outdated by a release of their source identity.
- The PDM Revisions tab preserves model history. Source/result links open and highlight the exact revision, even when a newer draft exists. The latest working revision means the most recently created draft, not a released production revision.
- Drawing working versions explicitly select an existing model revision by ID. Old versions retain their association. Saving a new working version does not increment the approved drawing revision. Required-drawing coverage flags missing versions for the latest model draft. Requirements remain part-level; per-revision approval packages are future scope.
- Creation records activity on the source/result part and ECR/OCR. Stale edits and invalid source references are rejected. Recorded revision work cannot be silently unlinked. Permanent feature/system deletion clears corresponding links while preserving independent model lineage.
- Additive migration gives older parts a deterministic initial revision and attaches older drawing entries to it. All records remain browser-local drafts; no CAD copies, file uploads, shared permissions, approvals, or releases are performed.
- Verification: all 50 tests and production build passed. Browser checks covered revision creation, an independent variant from an older source, overlap warnings, exact-source navigation, drawing association with Rev0.2 while DWGREV stays 0.1, narrow layout, and persistence after reload/server restart. Illustrative QA records were used.

## Milestone 4: prototype Engineering approval and release records (September 25, 2026)

- Each part group in an active ECR/OCR has Record Engineering approval and Record release. Approval records meeting date, participants, notes, Ops numbering decision, and intended active systems. Production parts require an Ops-assigned Odoo number; R&D/contract parts may retain their internal identifier. Assigning an Odoo number does not increment the revision.
- Release requires a current approval plus a named releaser and explicit authorization confirmation. These are manually recorded prototype fields, not authenticated permissions. Release numbers are allocated in the serialized save operation: Rev1, Rev2, etc., independently per identity.
- A release maps an exact model revision to its whole release number. Original working labels and drawing associations remain intact. After Rev1, new development uses Rev1.1, Rev1.2, etc. Historical releases cannot be released a second time or silently renumbered.
- The first approved parallel branch may release. Another unfinished branch that does not descend from the latest released model shows Newer revision released. Its approval must record either Incorporated released changes or Proceed with intentional differences, with an explanation. If the work needs an independent identity, use Create variant instead.
- A newer release invalidates previously recorded approvals of other unfinished branches. Relevant part metadata, Odoo, drawing records/requirements, or intended-system changes also require updated approval; a newer working revision in the same ECR requires approval of that new revision. Unrelated parallel draft creation does not invalidate an approval.
- Revisions separates release history from development history, preserving approval details, exact model links, Ops notes, and intended systems. Actions log to the part and ECR/OCR. Deleting a feature clears its references without deleting the independent part release history.
- These are browser-local metadata records only. No CAD is published, drawing approval granted, ECR completed, or machine configuration updated by recording a release. Drawing coverage is not yet a production release gate. Real file snapshots, authenticated authorization, and shared database enforcement remain required before production use.
- Verification: 58 automated tests and production build passed. Tests cover parallel first/second releases, stale approvals, variants, post-release working numbering, migration, and history preservation. Browser verification used QA-00006, an explicitly illustrative R&D part, recording sample Engineering approval and Rev1 release.

## Next bounded milestones

Milestone 5 (September 25, 2026) now provides drawing approval records and part-release checks:

- Each drawing type has an append-only approval history identifying the exact drawing working version and exact model revision, separate Checked by and Approved by/Engineering participants, notes, and timestamp. Drawn by belongs to the working version and must be filled before approval.
- Approval of a new working version advances that drawing's whole DWG revision once. Ten working edits before first approval still yield DWG Rev1. New work after approval uses drawing draft RevN.1; working-version entries continue counting independently.
- Confirm still applicable records review of an already approved drawing against another exact model revision without advancing DWG revision. A newer working drawing for the target model must be approved instead. Changing printed PRT REV requires an updated drawing version and approval, not applicability confirmation; this remains a human check until CAD integration exists.
- Before any new part release, all three drawing types must be assessed. Not required needs a reason. Every Required type must have approval/applicability covering the selected exact model and its latest associated drawing version. A drawing approved for another model does not silently qualify. The ECR/OCR shows blockers and disables Record release; the save operation enforces the same rules.
- Drawing changes invalidate the part's Engineering approval snapshot, so finish drawing review before recording final part approval. The saved Engineering snapshot preserves drawing approvals and requirement decisions for each release. Drawing history and prior releases remain intact after later edits.
- Older drawing records gain an empty approval history. Existing releases are preserved as historical records and are not retroactively rejected or marked drawing-approved. The gate applies to future releases. Old uncompleted Engineering approvals may need updating after this additive migration.
- Drawing coverage can be inspected for any model revision in the Drawings tab. Requirements currently remain part-level; each release preserves its assessed values in the approval snapshot. Per-revision requirement editing, real file checks/publication, authenticated sign-off, and automatic title-block checks remain future scope.
- Verification: 61 automated tests and production build passed. Browser tested sample Machining drawing creation and approval to DWG Rev1 on illustrative QA-00006; no real CAD reviewed or published.

1. Drawing records with type, independent working versions/revisions, and explicit model revision association (draft foundation completed).
2. Source revisions, variants, intended systems, and prototype newer-release review/approval records (completed); actual CAD comparison remains future work.
3. Shared sign-in/database/Drive foundation before production use; migrate local records with numbering reconciliation.
4. File-backed approvals, drawing approval/coverage gates, exact system configurations, and controlled release publication.
5. SolidWorks integration and Odoo automation as separately scoped integrations.

Do not present prototype approval buttons or browser-only controls as enforcement of production permissions. No real files should be published until the shared storage and authorization foundation exists.
