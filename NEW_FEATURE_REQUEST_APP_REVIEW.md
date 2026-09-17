# New Feature Request App — detailed review
Reviewed September 11, 2026.

Your app is a product-development and change-management tool for re:3D/Gigabot. Its purpose is to make requests easy to submit, bring ECR and OCR work into one place, connect requests to the roadmap, and preserve a traceable path from an idea to implementation.

This review is based on your full 87-turn **Google Sheets Script Setup** conversation, the related **Assess feature request folder move** task, the current Google Sheets workbook, your process presentation, the ECR/OCR/PD ECR templates, the In-Work Documents folder inventory, and two working-document samples. Current Google documentation was used to check platform limitations.

The build conversation includes attachments whose contents were not returned. I did not inspect the live AppSheet editor, final Apps Script source, deployment settings, or bot execution history: the available browser reached AppSheet's sign-in page. References to a feature being documented or historically working are not claims that I tested its current execution. No app settings or cloud data were changed.

## Goal and intended users

The workbook's How to Use page explicitly describes replacing the previous spreadsheet-and-Google-Form user experience with a more approachable AppSheet application. Google Sheets remains the backend; users can submit and manage requests through the app.

The intended benefits are:
- One place to submit requests and see active work.
- One workflow for both Engineering Change Requests (ECRs) and Operational Change Requests (OCRs).
- A permanent feature ID that survives movement between lifecycle stages.
- Direct access to each feature's working document.
- Visibility into priority, project ownership, progress, and roadmap inclusion.
- Separate views of completed, archived, and declined work.
- Simple access for teammates, with a separate external request experience for customers.

Your July 18, 2025 message confirms that you created a second AppSheet app for external use, using the same spreadsheet. The current Info tab describes customer submission and internal evaluation; it does not promise customers access to internal project tracking. This establishes the intended separation of users, not proof of the deployed access controls.

Sources: [current workbook](https://docs.google.com/spreadsheets/d/1FVAXuU3M4Odj1YI6wzOJNQt67cLZ5YpFfiU501o_tfs/edit), [New Feature Process](https://docs.google.com/presentation/d/1GyNQYZNZBe8PxYaJJ9G_Mgl_s84R54oSrcFLFhrE1ek/edit), and Google Sheets Script Setup.

## How the app developed

| Period | Work evidenced in the build conversation | What it establishes |
|---|---|---|
| July 14, 2025 | Adapted a Google Forms/Sheets workflow with New Feature Requests, Roadmap Features, ECR, OCR, PD ECR, Complete, Archive, and Declined. Shared an onOpen script and an ID-generation helper. Initially wanted onOpen behavior preserved. | The AppSheet app grew from an existing change-management spreadsheet. |
| July 17 | Began building AppSheet from the spreadsheet. Worked on an informative landing page, table/detail presentation, Google Doc links, and year-plus-sequence IDs. | Usability and document access were early requirements. |
| July 18 | Created the external app sharing the backend. Worked on initial status, syncing, and copying a feature to ECR/OCR/PD ECR when its document type was selected. Reported a bot working. | Two entry points and automatic routing were being implemented. |
| July 21 | Addressed URL fields that could not be modified, copied rows replacing existing rows, retained form values, and cross-tab document-link updates. Confirmed the internal request form populated New Feature Requests and grouped items as Request/In-Work. Confirmed a bot changed status to In-Work. | Request intake and status assignment were reported working; key and synchronization problems were real implementation issues. |
| July 30 | Implemented archival movement. Reported duplicate/reused IDs after removing rows from New Feature Requests. Introduced Used ID and worked through text/number/list expression problems. Also reported linked bot conditions changing together. | The permanent ID register arose from a specific failure of calculating the next ID from a changing active table. |
| August 6–14 | Worked on reverse movement from Archive, restoring the correct ECR/OCR copy, bot chaining, and deleting stale active copies. Explicitly stated ID # was the key in every table. Added roadmap inclusion/removal. Reported document generation running again on unrelated edits. | Bidirectional movement and repeat-safe automation were the difficult parts. Reports of successful archival movement were followed by narrower cleanup failures, so the historical record is not a final all-paths test. |
| February 9, 2026 | Stated the AppSheet app was complete and focused on teammate access. Explored Chrome installation, links in Drive, a launcher, and Apps Script web-app redirects; reported failed launcher/redirect attempts. Updated the process presentation. | Adoption and convenient access remained an issue after the core build. |
| September 11, 2026 | Asked about moving the New Feature Request folder, then requested this detailed review. | File-location dependencies and maintainability are current concerns. |

Earlier assistant replies proposed several alternatives. I have not treated every proposed expression, slice, script, or bot as something you implemented. In particular, a Roadmap slice was suggested, but the current workbook contains physical Roadmap copies.

The original script you pasted also has specific historical hazards: it writes the table name into a blank Status cell and writes Request into column 4 (then called Push), while column 4 is now Change Type. Its maximum-ID calculation includes a nested array of IDs from the three in-work sheets, which would need flattening before taking a numeric maximum. The helper's typeof parseInt(...) == "string" test cannot identify nonnumeric input. These observations apply to the pasted July 2025 code only; I have not established that this code still runs. They make the final installed script important to inspect before treating the old onOpen behavior as compatible with today's workbook.

## Current structure and data model

The current workbook is named **Copy of Engineering Change Requests (ECR)**. Despite that name, its current instructions, active requests, recent documents, and folder location identify it as the relevant working backend.

It has 21 tabs: 10 visible and 11 hidden.

| Current visible tab | Role | Populated request records |
|---|---|---:|
| How to Use | Internal instructions | — |
| Info | External welcome/instructions | — |
| New Feature Requests | Active request dashboard/source table | 63 |
| ECR | Copies of active engineering requests | 38 |
| OCR | Copies of active operational requests | 25 |
| Roadmap Features | Copies of active roadmap features | 18 |
| Complete | Completed requests | 13 |
| Archive | Archived requests | 2 |
| Declined | Declined requests | 0 |
| Used ID | Permanent ID register | 78 |

Counts exclude headers, blanks, and hidden legacy tables. There are **78 distinct feature IDs** across the current lifecycle tables. All 63 active records currently have Status = In-Work. Their IDs match the combined ECR/OCR membership. The 18 Roadmap records match the active requests flagged Yes. There are no duplicate IDs within the inspected current tables, and all 78 IDs are present exactly once in Used ID.

These are good checks of current stored membership. They do not test simultaneous submissions or prove that all future bot transitions work.

The active record schema has 16 named columns:
1. ID #
2. In-Work Document
3. Last Status Update
4. Change Type
5. Status
6. Timestamp
7. Full Name
8. Email Address
9. Company Name
10. Current Gigabot version(s)
11. Requested feature description
12. Priority
13. Is on the Roadmap?
14. In-Work Document Link
15. Project Lead
16. Progress

The design distinguishes three separate concepts: **Status** is the lifecycle, **Progress** is the review/development stage, and **In-Work Document** selects ECR or OCR. Roadmap inclusion is another independent attribute.

The 11 hidden tabs are ECR1, PD ECR, OCR1, How to Use This Sheet!, In Work, Under Review, New Feature Assessments, New Feature Scores, Weights, Release Features, and Code Log. Their sampled headers and cells contain older workflows, scoring/release structures, and test/example data. The Code Log includes a 2019 entry, so those parts should not automatically be credited to your AppSheet build.

The PD ECR tab and template are real artifacts, but the current How to Use page documents ECR and OCR only. I cannot establish whether PD ECR is currently enabled in the deployed app. Likewise, the hidden assessment/weights tabs do not establish a functioning scoring feature in the current app.

## Features and workflow

**Request submission.** Internal and external users submit a single feature per request, with contact/company information and one or more Gigabot versions. AppSheet writes the request to the shared backend. The documented ID convention is year plus a three-digit sequence. Imported older requests retain their existing IDs.

**Active dashboard.** The New Features interface groups requests by lifecycle and exposes detail editing. Its documented controls include document type, priority, roadmap flag, project lead, and progress. The current workbook is structured to support those fields.

**Document assignment and routing.** Selecting ECR or OCR is documented to change status to In-Work, copy the feature into the corresponding table, and create a Google Doc named ECR In-Work Document [ID] or OCR In-Work Document [ID]. The active request remains represented in New Feature Requests while its ECR/OCR copy provides a second view of the work.

**Working-document links.** Google Docs hold the detailed engineering/operational work. The spreadsheet stores links. Current cells mix plain URLs, HYPERLINK formulas, and Google smart chips. These representations must be checked at the target-URL level: different displayed labels do not necessarily mean different documents.

**Roadmap.** Setting Is on the Roadmap? to Yes includes the feature; No removes it. Roadmap is a cross-cutting collection rather than an exclusive lifecycle stage. Current membership is consistent, although some copied links are not.

**Completion, archive, and decline.** The instructions direct users to change Status in New Features. The build conversation describes copying into the destination and removing obsolete active copies. You also requested restoring an archived item to active work and to the appropriate ECR/OCR table. The final restore implementation remains unverified.

**Identity across tables.** You explicitly chose ID # as the key throughout the app. That is why all matching, cleanup, restoration, and link propagation depend on stable, unique values. Used ID preserves IDs even after requests leave the active table.

**Guidance and access.** Internal How to Use and external Info content are present. The February presentation says the app link is attached to every sphere's meeting notes and explains desktop access. The build conversation shows that a native-feeling entry point from Google Drive was a significant usability goal. I did not verify a functioning launcher deployment.

## Engineering and operational process

The process presentation describes request intake, roadmap review, appropriate working-document creation, implementation, and completion.

ECR is intended for substantial engineering changes, especially next-generation roadmap work. Its path is SRR, PDR, CDR, ORR, and final stakeholder approvals. The template covers requirements and acceptance thresholds, design history, risk and benefit analysis, test plans, schedule and cost, design alternatives, manufacturing implications, beta testing, implementation, customer support, documentation, and final release readiness.

OCR covers changes to the current product or operating process with less engineering effort, while allowing engineering support. Its template contains a project plan and change log, lead/second-person review, and implementation checks for Odoo, assembly, instructions, support, sales, marketing, shipping, and affected downstream assets.

PD ECR describes exploratory or custom work connected to another feature, with requirements, development/testing, a final prototype, and a roadmap review before fuller release work. The presentation has inconsistent labels in this section: one place says CDR/PDR, another says CDR and OCR, and a later slide says CDR and ORR. The PD ECR template includes CDR and ORR. That is a process-document consistency issue; I have not silently selected a final policy.

I inspected the folder containing **55 working Google Docs**, and sampled ECR 2026014 and OCR 2026019. Both contain populated feature/ID/lead fields and substantive ongoing work. This confirms that the document workflow has produced useful working artifacts, although it does not reveal the final creation script.

The current request schema does not contain the individual approvals, test outcomes, budgets, or detailed task checklist from those documents. My inference is that the app coordinates and summarizes the work while the Google Docs carry its detail. A Progress label alone is not evidence that all review gates were completed or that AppSheet enforces them.

Sources: [ECR template](https://docs.google.com/document/d/1r5IQWGp4Ii1RBRI_-uR_E9LqlDUKURXQi6cgWu-cHhI/edit), [OCR template](https://docs.google.com/document/d/1vjv9AfddO329TY1Or7z95nSP2-c9a012q8-kpJaNYx8/edit), [PD ECR template](https://docs.google.com/document/d/1Mj5PnVJUn1q86fImL5szec-Rg86zTOKotWkzjPFZVsk/edit), [In-Work Documents](https://drive.google.com/drive/folders/12BYRT_WzeMSSAurPoN_G0BI-3E6IHrTO).

## Current data discrepancies

Comparing matching IDs across active and copied tables found **18 non-link field differences affecting 11 features**: five Progress differences, eight Last Status Update differences, two Priority differences, two No-versus-blank roadmap flags, and one Project Lead difference. Different fields have different significance; a blank versus No flag is not equivalent to two conflicting review stages.

Examples:

| Feature ID | Field | New Feature Requests | ECR copy |
|---|---|---|---|
| 2022011 | Progress | ORR | Final Review |
| 2022057 | Progress | ORR | Final Review |
| 2025004 | Progress | CDR | SRR |
| 2026011 | Progress | PDR | SRR |
| 2026013 | Progress | CDR | SRR |
| 2026014 | Priority | High | Medium |
| 2026014 | Project Lead | Mitchell Mashburn, Domenic Cordova | Blank |

The working ECR 2026014 document also names both leads, supporting the observation that its ECR table copy is missing useful ownership information. I have not assumed New Feature Requests is authoritative for every discrepancy.

Three document-link findings remain after inspecting the underlying cell links:
- **2022063:** Roadmap link is blank; New Feature Requests and ECR contain a document link.
- **2022070:** Roadmap link is blank; New Feature Requests and ECR contain a document link.
- **2025002:** Roadmap points to document ID `1sSRw_n68_kIB9gDqPAk0DkFMng45J6dZBJIY85cYrWg`; New Feature Requests and ECR point to `1yn44B1-XsWpEHaeCbPTvut4nrtJpLjOxyJJqXFyW190`. These are different documents. Which is intended requires checking.

For 2025006 and 2025010, plain-value reads initially looked inconsistent, but smart-chip inspection confirmed identical document targets. Those are display differences, not confirmed broken links.

The Complete and Declined feature-description headers are shorter than the corresponding active-table header. This creates separate column names for expression/action mapping and makes schema maintenance more delicate; it is not proof that those existing actions are broken.

The exact IDs, fields, and source/destination row numbers are saved in review-data-audit.json. These comparisons concern the stored workbook. The editor may use formulas, slices, or other rules that affect what users see, so I have not claimed every stored difference necessarily appears on screen.

## Limitations and why they matter here

**Copies need explicit synchronization.** New Feature Requests, ECR/OCR, and Roadmap hold versions of the same feature. Copying a row does not itself establish a continuing relationship between every field. Your build history repeatedly encountered this, and the current discrepancies confirm it remains a data-maintenance issue. This follows from the chosen architecture; AppSheet does not require one physical table per status.

**Sequential IDs have a concurrency limit.** Used ID addresses reuse after archival/removal, but a client-side maximum-plus-one calculation can still select the same next number for two simultaneous or offline submissions. Google explicitly documents the incompatibility of guaranteed sequential IDs with concurrent distributed/offline creation. There is no duplicate-ID failure in the inspected current data; the final generation expression and multi-user behavior are unverified. [Sequential keys](https://support.google.com/appsheet/answer/10106361?hl=en)

**Automation boundaries matter.** App-event bots in one AppSheet app do not automatically run for changes made through a different app sharing its spreadsheet. Bot-generated changes also require explicit configuration to trigger other bots. This is especially relevant to your external intake app and chained archive cleanup. The observed history does not identify today's settings. [Bots: The Essentials](https://support.google.com/appsheet/answer/11432969?hl=en)

**A true condition is not a complete event definition.** A value remaining ECR/OCR after every edit can repeatedly satisfy a document bot's condition. You reported exactly that failure. The historical advice proposed checking transitions; preventing duplicate work on retries or restoration also depends on how creation and existing document links are handled. The final guard is unverified.

**Spreadsheet and app edits follow different trigger paths.** Your original onOpen code is tied to opening the spreadsheet. Apps Script edit/change triggers do not generally run because an API or script wrote a row. AppSheet's Sheets event add-on supports configured direct user/Forms changes, not arbitrary programmatic changes. A later sync should not be assumed to recreate a missed edit event. [Apps Script triggers](https://developers.google.com/apps-script/guides/triggers/installable), [Sheets external eventing](https://support.google.com/appsheet/answer/11520310?hl=en)

**Sync is part of the user experience.** You reported waiting for sync before a bot-generated status appeared. Quick sync can improve supported app edits, but direct spreadsheet edits still require a subsequent sync, and computed values/complex configurations impose restrictions. Its current settings were not inspected. [Quick sync](https://support.google.com/appsheet/answer/13865312?hl=en)

**Internal/external presentation is not the same as access control.** The external app's limited intended experience is clear. Whether it truly prevents access to internal records depends on its tables, permissions, sign-in, and security filters. Hidden views or slices alone should not be treated as security boundaries. This is an unverified configuration question, not an observed disclosure. [Security filters versus table slices](https://support.google.com/appsheet/answer/10104488?hl=en), [Security: The Essentials](https://support.google.com/appsheet/answer/10105078?hl=en)

**The workflow spans separate products.** AppSheet handles requests/status, Sheets stores structured data, and Docs contain detailed work. Changing a document's content does not, by itself, establish automatic updates to the app's Progress or approvals. Likewise, an Odoo/Shopify/Zendesk checklist in a template is not evidence of an automated integration with those products.

**Files and permissions remain dependencies.** Full Google Docs links identify documents independently of their displayed names. Relative attachment paths and bot output folders have different location rules. A folder move must account for the actual connected account, permissions, table locations, default app folder, and any document-generation destinations. Those exact live references have not been inspected. [AppSheet file paths](https://support.google.com/appsheet/answer/11918256?hl=en), [Bot file archive settings](https://support.google.com/appsheet/answer/11568421?hl=en)

**Growth and licensing require configuration-specific review.** Google Sheets data sources can face API/concurrency and data-volume constraints. With 78 distinct current requests, this snapshot does not establish a capacity problem; duplicated records and many automations can still add maintenance work. Internal/external user licensing and plan-dependent automation availability were not checked. [App performance](https://support.google.com/appsheet/answer/10105761?hl=en), [Subscription capabilities](https://support.google.com/appsheet/answer/10105400?hl=en)

## Remaining evidence needed for a complete live audit

A signed-in view of both AppSheet apps would establish:
- Exact table bindings, keys, column types, initial values, and app formulas.
- The final ID expression and how each app updates Used ID.
- Views/slices, allowed edits, sign-in, security filters, and external data exposure.
- All bot event conditions, actions, process order, reuse, chaining, and wait settings.
- Document creation method, template IDs, parameter mappings, output folder, link write-back, and duplicate-creation guards.
- How copied fields are updated and which record is authoritative.
- Archive restoration, completion/decline reversal, ECR-to-OCR reassignment, and roadmap cleanup behavior.
- Final Apps Script source and installed triggers.
- Sync/offline settings, deployment state, licensing, and real automation run history.

I have not run test submissions, changed statuses, created documents, or edited the app during this review. Those actions would alter the working system and were not necessary to understand its design and inspect its current data.
