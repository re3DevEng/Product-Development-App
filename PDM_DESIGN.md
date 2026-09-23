# PDM implementation plan

## Agreed process

The complete planning summary is `output/pdf/PDM_Workflow_and_Rules.pdf` (September 23, 2026). It describes the intended final system, not current prototype capabilities.

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
- Concurrent ECRs/OCRs are allowed, but overlapping work requires reconciliation before either release. Ops decides numbering/variants.
- Releases explicitly select receiving systems. Configurations reference exact released revisions; other systems stay unchanged. Physical retrofit tracking is separate.

## Milestone 1: draft register (implemented)

Creation workflow: create parts/assemblies from an active ECR/OCR's Parts & assemblies section. The form displays the source change, automatically links it at save, and returns to the source on create or cancel. Creation validates that the source still exists and is in work. The library has no standalone create action and serves as browsing/reference. Existing record editing and links remain available. Batch CAD registration, existing-part revision workspaces, and variants remain future work.

- PDM Library navigation, searchable part/assembly list, type selection, recent/name sorting.
- Read-only preview with explicit Edit record, separate Save changes and Discard changes.
- Draft name, description, kind, intended use, owner, optional Odoo number, linked ECR/OCR IDs.
- Permanent internal ID and separate UUID. Provisional numbering choice: one global numeric sequence, padded to five digits, prefixed by 2-5 creator initials. No annual reset. Confirm before shared database migration if sequences should instead be per initials.
- Every item remains Draft at working Rev0.1. The record concurrency counter is distinct from the CAD revision.
- Edits and link changes create activity. Odoo assignment and owner changes preserve identity and CAD revision. Odoo values are manually entered, not verified by an integration.
- Bidirectional navigation between linked features and PDM records. Multiple ECRs/OCRs may link to a record; links do not constitute a controlled revision effort or release approval.
- Additive migration keeps all prior browser data. Counter validation, duplicate Odoo detection, stale-edit protection, and feature-delete cleanup are covered by tests.
- Uses existing browser-local storage and cross-tab serialization. IDs are unique only within that workspace, not across devices. Activity actor is Demo user, not authenticated identity.

## Not implemented in milestone 1

File upload/copy/download management; working CAD version history; drawing records; variant creation; exact assembly BOMs; system revision configurations; overlap reconciliation; meeting approvals; release publication; permissions; Odoo/SolidWorks integrations; PDM record deletion.

## Milestone 2: drawing records (implemented)

- Each part/assembly now has a Drawings tab and overview link. One draft drawing per type (Machining, Inspection, Assembly) is supported in this first stage.
- Drawing draft revision starts at 0.1; approved revision is explicitly absent. The model revision is captured on each working-version entry, currently the only available draft model revision 0.1.
- Record working versions with notes and a separate drawing author. Entries are append-only and retain their model revision, timestamp, and recording actor. The recording actor remains Demo user until authentication exists.
- Working version numbers increase without changing the drawing revision or the model revision. No approval or release action is implemented.
- Required drawing types start as Not assessed. Set each to Required or Not required; Not required needs a reason. Decisions and changes appear in part activity. Required drawings are shown as missing or draft/approval pending, never as approved.
- Existing saved parts migrate additively to empty drawings and unassessed requirements. Ordinary part edits preserve drawings. Stale writes, duplicate types, invalid versions, and unsupported approvals are rejected.
- Records and notes only: no actual drawing upload, download, CAD version storage, title-block modification, or Google Drive connection. Model revision selection will expand when controlled model revision records exist; there is no free-text way to claim association with a nonexistent revision.
- Verified 43 tests and production build; browser exercised drawing creation, second working version, requirements, and history on the illustrative QA-00001 record.

## Next bounded milestones

1. Drawing records with type, independent working versions/revisions, and explicit model revision association (draft foundation completed).
2. Change packages and source revisions, variants, intended systems, and concurrent-change reconciliation.
3. Shared sign-in/database/Drive foundation before production use; migrate local records with numbering reconciliation.
4. Approval records, drawing coverage, exact system configurations, and controlled release publication.
5. SolidWorks integration and Odoo automation as separately scoped integrations.

Do not present prototype approval buttons or browser-only controls as enforcement of production permissions. No real files should be published until the shared storage and authorization foundation exists.
