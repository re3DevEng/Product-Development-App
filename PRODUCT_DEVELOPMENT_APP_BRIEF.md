# Product Development App — replacement brief

Updated September 11, 2026.

Implementation update, September 14: the first local sample-data prototype is built. See README.md and PROTOTYPE_VALIDATION.md for its implemented scope, checks, and remaining cloud integrations. The first-release scope below remains the target for the connected app.

## Agreed project direction

Replace the existing Google AppSheet New Feature Request App with an internal web application that is easier to use, customize, and extend. The first release recreates the key existing workflow. Later releases can expand into other product-development organization needs.

Google Drive remains central. External users, customer accounts, and a separate public submission app are outside the replacement's scope.

The team already has a contract-print tracking web app using Supabase and Vercel, developed in Visual Studio Code. This is useful precedent, not evidence that this project must share its database or that its implementation has been inspected.

Visual Studio Code is the editor used to work on the application. The underlying web framework, data model, and integrations determine what the application can do.

## First-release scope

| Capability | Expected result |
|---|---|
| Internal access | Authorized teammates can open the app and sign in. Google sign-in is the proposed method. |
| New request | Enter a feature description, affected Gigabot versions, and relevant request details. Identify the submitting teammate. |
| Feature identity | Keep existing IDs. New requests receive a unique readable ID; changing status or reopening a feature does not change its identity. |
| Active work | Browse and search requested/in-work features; filter by status, owner, priority, document type, roadmap membership, and progress where useful. |
| Feature detail | Edit the feature from a single authoritative record, with its ownership, priority, status, progress, and document links together. |
| ECR and OCR | Select the work type, assign ownership, create the appropriate Google Doc from the existing template, or associate an existing document. Show document-creation progress/failure clearly. |
| Roadmap | Include or remove a feature from the roadmap without creating another independent copy. |
| Completion and archival | Mark a feature complete, archived, or declined; restore it through an explicit action while preserving its identity, documents, and history. |
| Change history | Record who changed significant fields and when, to make conflicting changes and progress easier to understand. This is a proposed reliability improvement. |
| Existing data | Import the current requests and retain usable Google Drive/Docs links; resolve known conflicting fields and document targets before the final import. |
| Help | Provide short internal guidance explaining how to submit, assign, progress, and close a feature. |

The first-release baseline is ECR/OCR. PD ECR, weighted assessment scoring, and older hidden spreadsheet workflows are not assumed to be active requirements. Detailed task management, approval enforcement, schedules, costs, and other ideas remain future scope until prioritized.

Existing customer/contact information is historical business data. Removing external access does not imply deleting that information or preventing teammates from recording a request on a customer's behalf. Required fields for the new internal form can be simpler than the previous public form.

## Accepted architecture

The user accepted this architecture on September 11, 2026: keep engineering documents, templates, attachments, and supporting files in Google Drive; store structured request records and application activity in Supabase; host the custom web application on Vercel.

| Part | Responsibility |
|---|---|
| Custom web app | A tailored interface built with Next.js and TypeScript, editable in ordinary source code. |
| Vercel | Host the web app and its supported server-side endpoints. |
| Supabase | Store features, users/memberships, record relationships, history, and reliable identifiers in PostgreSQL; provide authentication. |
| Google Drive and Docs | Continue to hold the ECR/OCR documents, templates, supporting material, and existing file organization. |
| Server-side integration | Check authorization, create/link documents, perform workflow changes, and handle failed/retried operations. |
| Source repository | Version the application, database migrations, configuration examples, and setup instructions. |

The storage decision is settled. Supabase, Vercel, and Google Drive are the chosen foundation. The contract-print app can still inform conventions after inspection, but its repository is not a prerequisite for designing this application.

Google Sheets supplies the existing data for migration and can later receive exports or reporting data. Supabase is the authoritative record store. Do not create two independently editable authoritative copies in Sheets and Supabase.

Google login and authorization to read/write Drive documents are distinct concerns. The Drive access approach, internal membership rules, and target folders will need to be configured deliberately. A working login alone does not establish permission to every project document.

The existing contract-print app can inform navigation, styling, deployment, and authentication conventions after its repository is inspected. Sharing a platform does not require sharing production data or coupling the two applications' releases.

## Design principles for expansion

Storage comparison retained as the rationale for the accepted decision:

| Decision factor | Google Sheets stores records | Supabase stores records; Drive stores files |
|---|---|---|
| Everyday record editing | Can retain direct spreadsheet editing, with rules for interactions with app workflows. | Teammates primarily edit in the app; the database has an administrative table editor. |
| Custom interface | Full custom interface is possible. | Full custom interface is possible. |
| Existing data | Familiar source format, though copied rows still need reconciliation and restructuring. | Requires an initial import and reconciliation; existing Google Docs can stay in place. |
| Future linked tasks, approvals, milestones | Possible, with more custom relationship and integrity logic. | PostgreSQL relationships and constraints provide a stronger foundation. |
| Numbering and simultaneous updates | Requires a carefully controlled write path; arbitrary direct sheet edits can bypass it. | Central transactions and uniqueness rules can enforce the design when implemented correctly. |
| Service management | Keeps the record store within Google Workspace, alongside web hosting and app integration. | Adds a database/auth service, matching technologies the team already uses elsewhere. |
| Spreadsheet reporting | Native spreadsheet access. | Export or a one-way reporting sheet can provide access without making two authoritative stores. |

Decision: Supabase for records, with the app as the normal place to manage work. At the current 78-request snapshot, the deciding factor is workflow complexity and future maintenance rather than raw record volume. The interface and workflow behavior will be implemented in the custom application.

1. **One feature, one record.** ECR, OCR, Roadmap, Complete, Archive, and Declined become views over shared records. A change made from any view updates the same feature.
2. **Separate independent concepts.** Lifecycle status, review progress, document type, roadmap membership, and ownership remain distinct.
3. **Preserve identity.** Use a stable internal identifier and a separate readable feature number. Preserve imported feature numbers and allocate new ones centrally with uniqueness enforcement.
4. **Treat documents as relationships.** Store the Drive file ID and its role, not just a displayed filename or copied text. Allow a feature to acquire additional supporting documents over time.
5. **Keep routine configuration editable.** Candidate settings include product/version lists, priorities, owners, workflow labels, and template/folder references. New behavior or major layout changes will still require code; a custom app is not automatically a no-code editor.
6. **Keep responsibilities separate in code.** Request workflows, Drive integration, identity, and the interface should be maintainable independently. Begin with a single application and clear modules; do not build a speculative plugin system or multiple services.
7. **Make failures recoverable.** Document creation must tolerate retries without producing duplicates. Database updates and Drive changes do not share one transaction, so track document-creation state and recovery.
8. **Support safe change.** Use versioned database changes, separate development/test data, and suitable backups/exports. Changes can be reviewed in a preview before replacing the working app.
9. **Leave room for relationships.** Future tasks, milestones, approvals, releases, test records, or linked projects should be addable without relocating the core feature record or changing its ID.

These principles reduce future rework; they do not guarantee that every unknown future requirement can be added without changes.

## Migration and first-release completion

Use the reviewed workbook as the starting source, with a fresh read before migration. The September 11 snapshot contains 78 distinct current requests, including 63 active, 13 complete, and 2 archived, plus 18 roadmap memberships. These are snapshot counts, not permanent constants.

Migration should preserve feature identity, descriptions, affected products, priority, ownership, lifecycle, review progress, meaningful dates, and document associations. Legacy contact data should remain available where relevant.

The prior audit found 11 features with stored-field disagreements, two missing roadmap document links, and one different document target. Do not blindly choose the first occurrence of an ID when merging copies. Record unresolved conflicts and resolve them before the production import.

A first release is ready when:
- Teammates can submit, find, edit, assign, and finish/reopen work through the app.
- All views reflect the same underlying record.
- Multiple submissions cannot receive the same feature number.
- Selecting ECR/OCR creates or links the intended document, and retries do not duplicate it.
- Existing document links and imported request counts reconcile.
- Internal access is enforced on both reads and writes.
- The app reports failures clearly and retains an understandable change history.
- The user can review the replacement with representative data before production cutover.

The current AppSheet app and its source files remain the operational system during development. This brief does not authorize moving Drive folders, overwriting the source workbook, or retiring AppSheet now.

## Delivery sequence

1. Architecture selected: Supabase records, Vercel hosting, Google Drive documents. Inspect the contract-print app when available if it will serve as a reference.
2. Initial first-release screens and record structure are mapped in FIRST_VERSION_DESIGN.md.
3. Build an interactive local prototype with representative, non-production data.
4. Connect internal authentication, the selected record store, and Google Drive/Docs.
5. Reconcile and trial-import the existing data; verify the essential workflows and failure recovery.
6. Review the working replacement, then prepare the final migration and launch.

## Sources and status

User direction in this conversation is the authority for scope. NEW_FEATURE_REQUEST_APP_REVIEW.md documents the prior app, not the requirements for external access in the replacement.

Technical options were checked against:
- [Supabase PostgreSQL database](https://supabase.com/docs/guides/database/overview)
- [Supabase Google sign-in](https://supabase.com/docs/guides/auth/social-login/auth-google)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Google Drive file copying](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/copy)
- [Google Drive permissions](https://developers.google.com/workspace/drive/api/guides/manage-sharing)

Only local planning/reference files have been changed. No application code, cloud resources, or production data has been created or changed for the replacement yet.
