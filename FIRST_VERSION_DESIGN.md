# First version — Product Development App

Design baseline: September 11, 2026. Architecture accepted by the user: Supabase + Vercel + Google Drive. A local sample-data prototype was built on September 14, 2026; see README.md. This document describes the full initial target, including cloud capabilities that are not yet implemented.

## Main experience

A desktop-first, responsive internal web app. Use a clear sidebar, searchable feature lists, and one consistent feature detail page. Keep everyday controls in the app; detailed engineering and operational documents continue to open in Google Docs.

| Screen | Purpose and main interactions |
|---|---|
| Active features | Default landing page. Show requested and in-work features with ID, short title, owner(s), priority, work type, progress, and roadmap indicator. Search and filter; open a feature or submit a new request. |
| New request | Short internal form: title, full description, affected product/version(s), optional priority and supporting links. Attribute the submission to the signed-in teammate. |
| Feature detail | Show the complete record. Edit details, assign owners, choose ECR/OCR, update progress, manage roadmap inclusion, open/create/link documents, change lifecycle, and read activity history. |
| ECR / OCR | Filtered views of the same features. Preserve view-specific filters and open the shared detail page. |
| Roadmap | Show roadmap-marked features with owner, priority, status, and progress. Default to active work; retain roadmap membership history when a feature is closed. |
| Complete / Archive / Declined | Filtered historical lists. Open the same detail page and restore/reopen a feature without changing its ID or losing its documents. |
| Settings | Maintain product/version options, priority labels/order, eligible review stages, document-template references, destination-folder references, and internal membership as appropriate. |
| Help | Brief guidance for submitting, assigning, progressing, and closing work. |

A short title is a proposed usability addition. Preserve the full original description during import; any generated title is a separate field. Filters do not duplicate records.

## Record structure

| Record type | What it holds |
|---|---|
| Features | Stable internal ID, unique readable feature number, title, description, lifecycle status, work type, priority, current review stage, roadmap flag, submitter, timestamps, and update version. |
| Feature owners | Links a feature to one or more teammates. Preserve legacy owner names during migration until matched to actual members. |
| Products and feature products | Configurable product/version list and the products affected by each feature. |
| Documents | Links a feature to Drive files by file ID, with document role, title, template used where known, and creation/linking state. |
| Activity | Actor, time, action, and relevant before/after values for meaningful changes. Imported history is labeled as imported; do not invent prior actors or events. |
| Internal members | Application access and basic membership roles. Google sign-in identifies a person; membership determines whether they may use the app. |
| Workflow settings | Editable labels/order and allowed stages for ECR/OCR, with stable internal codes. In-use choices can be retired without breaking historical records. |
| Number allocation | Central allocation of new year/sequence feature numbers with uniqueness enforcement; existing numbers remain unchanged. |
| Document jobs | Tracks a requested document operation, attempts, outcome, and reconciliation state so retries and interrupted operations can be recovered. |

Start with these focused structures. Later tasks, milestones, approvals, test results, and releases can link to the stable feature ID. Their detailed behavior is future scope.

## Workflow rules

- New requests start as Request. Selecting ECR/OCR starts In-Work and initiates document creation or allows linking an existing document.
- Request status and document-creation status are separate. Show Creating document, Document ready, or Needs attention so a failed Drive operation does not look successful.
- Lifecycle, work type, review stage, and roadmap membership are separate fields.
- Changing a field updates one record. All lists read that same record.
- Review stages are informational in the first version; formal approval enforcement is a later capability.
- Complete, Archive, and Declined preserve the feature. Restoring lets a teammate choose an appropriate active state and retains its linked documents.
- Existing documents remain associated when work type changes. A new ECR/OCR document is created only through an explicit, traceable operation; changing type does not silently delete or overwrite earlier work.
- Roadmap selection can persist on closed work for history. The default active roadmap filters out closed work while allowing historical inspection.
- Regular record edits do not create another ECR/OCR document.
- Conflicting simultaneous edits must be detected rather than silently replacing newer changes.
- All record changes validate internal access on the server/database, and application activity is written with the related data change.

## Drive connection

### Agreed feature-folder structure

The user specified this exact layout for the future Drive integration:

```text
ECR Number- Title/
  CAD/
    SLDASM/
    SLDPRT/
    STEP/
    Drawing/
  Design Notes/
  Supporting Files/
```

Use the feature's ECR number and title for the parent folder name. Preserve the specified spelling and capitalization, including singular `Drawing`. Do not add the previously suggested `Testing` folder. Apply the same subfolder layout to OCR work, with its OCR number and title. Associate the Drive folder ID with the permanent feature ID so changing work type or lifecycle does not create another project folder. The working ECR/OCR document's location within this layout is still to be finalized.

This is a recorded requirement for the Drive implementation phase; no Drive folders have been created or moved. Permanent app deletion leaves the Drive folder and its contents untouched.

Reuse existing Google Docs and their templates where appropriate. Store file IDs as durable references and preserve their existing location and access during initial migration.

Document generation runs on the server. It copies the selected template, fills supported request details, and links the resulting document to the feature. The app must distinguish a document it created from a pre-existing document someone linked.

Google Drive and Supabase do not share an atomic transaction. Track an operation identifier and enough state to reconcile a Drive file created before a database update failed. An ambiguous timeout must not blindly start a second copy operation.

Choose the final Drive authorization method and confirm the destination folder/template references when connecting the integration. App sign-in alone is not permission to all Drive files. Keep credentials out of browser code.

## Implementation organization

Use Next.js with TypeScript, deployed to Vercel. Group source code around features, documents, membership, and settings, with a shared interface layer. Keep Drive operations separate from feature workflow rules and database access.

Build a local prototype with clearly identified sample data first. It should support request creation, editing, filtering, lifecycle changes, roadmap inclusion, and navigation to the feature detail page. Simulated document creation must be labeled and must not pretend to have created a real Google Doc.

Follow with Supabase-backed persistence and internal access, then the Drive integration and migration tooling. Local prototype storage is not production persistence.

## Reviewable completion checks

1. A teammate creates a request and finds it in Active features.
2. The request gets a unique feature number, including when two requests arrive together.
3. An owner or priority edit appears consistently in Active features, ECR/OCR, and Roadmap.
4. Document creation links the intended file; a retry or page refresh does not create a duplicate.
5. A creation failure is visible and recoverable.
6. Archive and restore preserve the feature number, description, owners, documents, and activity.
7. Internal access is checked for both reading and changing records.
8. A trial import preserves existing IDs and resolves the known source conflicts without silently discarding data.

The current AppSheet app remains operational while the replacement is developed. Cloud resources, sign-in setup, Drive authorization, migration, and production launch are subsequent implementation steps.
