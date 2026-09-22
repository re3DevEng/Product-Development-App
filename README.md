# Product Development App

An internal replacement for the re:3D New Feature Request App. The first local prototype is implemented with Next.js and TypeScript. It uses illustrative sample data; no AppSheet records have been imported or changed.

## Try the app

When the local server is running, open **http://127.0.0.1:3000** in this computer’s browser.

1. Choose **New request**, enter a title and description, select a product, and create it.
2. Clicking a feature opens its read-only overview. Choose **Edit feature** to assign owners, choose ECR/OCR, set a review stage, add document links, or use status/deletion actions. **Save changes** returns to the overview; **Discard edits** discards unsaved changes. Documents and activity can be viewed without editing.

   Short choices use selection buttons. Review stage stays hidden until ECR or OCR is selected; its choices follow the selected work type. Owner/product list filters remain dropdowns for larger configurable lists.
3. Turn on **Include on the roadmap** to see the same feature on the roadmap.
4. Use **Documents** to save an existing Google file link or see the clearly labeled local document outline.
5. Use **Decline** for unstarted requests. Once work starts, use **Complete**, **Cancel work**, or **Archive**. Each preserves the record and its history. **Restore** returns started work to In-Work; it can never return to Request or clear its ECR/OCR type. Status actions always keep these labels and operate only on the saved feature. While field or document-link edits are pending, status actions are disabled: first **Save changes**, save the document link, or **Discard edits**. Cancel work changes the whole feature's status; Discard edits only abandons unsaved changes.
6. For mistakes or duplicates, **Delete permanently** removes the feature, its document links, and all activity from app storage without a trash entry or deletion history. Type the feature number to confirm. Linked Drive files and earlier downloaded copies remain untouched. The sequence counter is retained so deleted numbers are never reused.

Settings lets you add sample product and teammate options, download sample data, or start fresh with the original samples. Adding a sample teammate does not create an account or grant access.

Changes are saved only in browser storage on this computer. Use the same browser and address to see them again. `localhost` and `127.0.0.1` have separate browser storage. Clearing browser data removes these changes. The download is a JSON backup for inspection; the prototype does not yet have a restore/import screen.

## Run locally

Use Node.js 24 and pnpm 11. Open a terminal in this project folder:

```text
pnpm install
pnpm dev
```

Keep the terminal running while using the app. Stop it with Ctrl+C. The server listens only on this computer. If port 3000 is in use, stop the other app or choose a different port with `pnpm dev --port 3001`.

The Codex desktop runtime on this machine also provides pnpm at:

```text
C:\Users\draft\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd
```

In PowerShell, if `pnpm` is not found, run:

```powershell
& 'C:\Users\draft\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd' dev
```

For a production build preview:

```text
pnpm build
pnpm start
```

## What is implemented

- Software change requests and bug reports with SW numbers, owners, priority, component/version, reproduction details, Request/In work/Testing selection bar, separate completion and lifecycle actions, Drive document links, and activity history.
- Many-to-many software links to features and systems. Features distinguish Related from Required for completion; unfinished required software blocks feature completion. Link changes are logged in software Activity. Software has its own sidebar section and shares History tabs with features/systems.

- Individual project Documents tabs and overview document summaries: named Google Drive/Docs file links, duplicate checks, and activity history. Existing project records gain an empty documents list automatically.

- Shared Complete, Archive, Declined, and Cancelled history for projects and features, with All/Features/Projects buttons, search, owner/product filters, and sorting. The Projects page shows active work; projects do not use Declined.

- Projects for machine development and custom customer machines: create, preview, edit, phase tracking, owners, optional target dates, customer/base-machine details, and project history.
- Link the same existing feature to multiple projects, navigate in either direction, and unlink without deleting. Project controls match features: Complete, Archive, Cancel work, Restore, and typed-confirmation Delete permanently. Projects start In work as soon as they are created. Status changes leave linked features unchanged; completion needs a reason only when linked features remain unfinished. Permanent project deletion removes project history and links but preserves the features themselves. Existing browser data gains projects without a reset.

- Create and edit requests with stable internal IDs and readable year/sequence numbers.
- Active, ECR, OCR, Roadmap, Complete, Archive, and Declined views over the same records.
- Search, owner/product filters, and Recent/Priority/Title sorting, remembered per view during the session. Priority sorting is the single list-level priority control.
- Multiple owners and affected products, priorities, ECR/OCR review stages, and independent roadmap membership.
- Reversible lifecycle changes that preserve identity, documents, and activity.
- Existing Google Drive/Docs file links, duplicate-link detection, and a local document-outline preview.
- Activity entries for changes, browser persistence, cross-tab synchronization, and revision conflict checks.
- Responsive navigation, keyboard-accessible native dialogs, sample settings, help, and data export.

Numbers and writes are serialized with the browser Web Locks API. This only protects tabs in the same browser and origin. Supabase must allocate numbers and enforce access and concurrency centrally in the connected app.

## What comes next

The accepted architecture remains **Supabase for records/auth/history, Google Drive for documents/templates, and Vercel for hosting**. None of those services are connected yet. There is no real sign-in, shared database, automatic Google Doc generation, or production deployment. Google file permissions and existence are not verified when saving a link. No external-user functionality is planned.

1. Review the prototype’s wording, layout, and workflow with the user.
2. Add Supabase tables, internal membership, authentication, access policies, and server-side activity/concurrency checks.
3. Connect the real Drive templates and folder, with recoverable document-generation jobs.
4. Reconcile the reviewed legacy discrepancies and perform a trial import.
5. Deploy a Vercel preview, validate internal access, and plan the switch from AppSheet.

The existing AppSheet app should remain in use while these phases are completed.

## Source guide

| Location | Purpose |
| --- | --- |
| `src/app/page.tsx` | Application entry point |
| `src/components/workspace.tsx` | Workspace screens and feature panel |
| `src/app/globals.css` | Colors, spacing, responsive layouts, and component styles |
| `src/lib/domain.ts` | Workflow validation, IDs, lifecycle updates, file links, and history |
| `src/lib/store.ts` | Replaceable local browser storage adapter |
| `src/lib/seed.ts` | Illustrative sample requests and options |
| `tests/domain.test.ts` | Workflow and document-preservation regression tests |

The domain rules are separate from browser storage to make the next Supabase phase easier. The prototype is not a production security boundary; final authorization and validation must run on the server/database.

## Checks

```text
pnpm typecheck
pnpm test
pnpm build
pnpm format
```

The workflow tests cover number allocation, shared-view consistency, archive/restore preservation, stale edits, duplicate/unsafe links, input validation, and corrupted saved data. Browser verification is recorded in `PROTOTYPE_VALIDATION.md`.

Earlier decisions and findings are in `PROJECT_CONTEXT.md`, `FIRST_VERSION_DESIGN.md`, `PRODUCT_DEVELOPMENT_APP_BRIEF.md`, and `NEW_FEATURE_REQUEST_APP_REVIEW.md`.



## Local network preview

After building, run `pnpm run start:lan` to serve on port 3000 across the local network. Open `http://<this-computer-IP>:3000` on another device on the same network. The host must remain awake with the server running. Windows Firewall may require permission for private-network access; do not configure router port forwarding for this prototype.

Records remain in each browser's local storage, separately for each address and device. LAN access does not provide shared data or authentication. The app supports saving on HTTP LAN addresses using IndexedDB serialization and cryptographic ID generation.
