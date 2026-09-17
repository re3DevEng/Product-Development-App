# Local prototype validation

Validated September 14, 2026. Scope: the local sample-data prototype only.

## Automated checks

- TypeScript checking passed.
- Next.js production build passed.
- Eight workflow regression tests passed: feature-number preservation, shared-view updates, archive/restore with documents, stale revisions, duplicate documents, unsafe links, invalid request fields/stages, and saved-data validation.
- A regression test caught and helped fix an update edge case: extra properties in a supplied feature object could replace existing documents. Domain updates now explicitly select only editable fields.

## Browser verification

Using the running production build through the browser interface:

- Created a request with title, description, and affected product; received feature number `2026-013`.
- Selected ECR and PDR, assigned two owners, and added the feature to the roadmap.
- Saved a test-only placeholder file link. No real Drive file was created or opened.
- Archived the request and found it in Archive with the same number, owners, and stage.
- Restored it to In-Work and verified that its linked file remained attached.
- Reloaded the page and confirmed the saved feature remained available.
- Filtered to the All products option and verified the matching rows.
- Checked active roadmap membership and the option to include historical work.
- Opened the same feature in two tabs, changed priority in one, and verified that the other displayed a conflict warning and disabled saving.
- Inspected desktop at 1440 × 1000, phone at 390 × 844, and the app’s ordinary narrow preview panel. Fixed page-level horizontal overflow and improved text contrast. Wide feature tables scroll inside their panel on small screens.
- Verified the phone request form and its footer remain within the viewport.
- No warnings or errors were reported in the browser console during these checks.

The test request is retained in Archive, off the active roadmap, and is explicitly named “Prototype check — service access.” Its document is labeled “Test-only placeholder — not a real Drive file.” It is sample test data, not an imported request.

## Status-action usability update

The lifecycle dropdown was replaced with a status indicator and explicit Complete, Archive, Decline, and Restore buttons. The updated production build passed. Browser checks on the existing test request verified each action, restoration to In-Work, linked-file preservation, and Save & archive saving an unsaved priority change. The test request was returned to Archive with its original priority. User-created requests were not edited.

## Cancel and permanent-delete update — September 15, 2026

- All 12 automated regression tests passed, including no return to Request after work starts, preserved start state across closure/restoration, legacy browser-data migration, and complete in-memory deletion of feature/activity/document references without reusing numbers.
- Production build and TypeScript validation passed.
- Browser checks verified Cancel work, the Cancelled history view, Restore to In-Work, disabled Unassigned for started work, and Decline only for unstarted requests.
- The deletion confirmation was checked with empty, incorrect, and matching feature numbers. Escape dismissed only the confirmation and preserved the feature panel; closing both restored page scrolling. The browser deletion was not submitted; deletion logic was exercised using disposable in-memory test records.
- The existing test record retained its linked document and was returned to Archive. No user-created records were edited or deleted.

## Compact selection controls — September 15, 2026

Replaced short dropdowns with native radio groups styled as selection buttons. Verified the build and TypeScript checks; browser checks covered ECR/OCR stage choices, hiding review stage for Unassigned, stage reset when changing type, keyboard arrow selection, priority filters, sorting, disabled Unassigned for started work, and 390-pixel layout without page overflow. Browser form changes were reverted without saving. Domain rules were unchanged, so the existing regression suite was not expanded or rerun for this presentation change.

## Read-only overview — September 15, 2026

The read-only overview milestone passed the production build and TypeScript check. Browser checks verified no editable fields or lifecycle/deletion controls on initial open, explicit Edit feature entry, cancelling a draft without saving, saving back to the updated overview, reading documents without editing, requiring edit mode to add links, hiding review stage for unassigned requests, and the 390-pixel layout. The existing test request’s priority was changed and restored to verify persistence; no user-created records were edited. The domain rules were unchanged.

## Separate field edits and feature status — September 16, 2026

Build and TypeScript checks passed. Browser checks verified stable Complete/Archive/Cancel work labels while changing priority; disabled status actions while field edits or a document-link draft are pending; enabled Save changes and Discard edits; restoration of the original saved values after discarding; and enabled status actions once edits are resolved. No saved feature data was changed during verification. Status handlers now use saved fields and reject pending edits rather than combining saves with a lifecycle change.

## Remaining integration work

There are no Supabase, Google authentication, Drive-generation, Vercel deployment, or migration integrations to validate yet. Browser-local conflict checks are not a substitute for production server/database concurrency and authorization. No production AppSheet or Drive data was modified.
