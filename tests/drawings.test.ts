import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSampleState } from "../src/lib/seed";
import { readState } from "../src/lib/domain";
import { blankPdm, createPdm, pdmFields, updatePdm } from "../src/lib/pdm";
import {
  addDrawing,
  addDrawingVersion,
  setDrawingRequirements,
  DRAWING_TYPES,
  approveDrawing,
  drawingApprovalFor,
  drawingReleaseIssues,
} from "../src/lib/drawings";
import { startPartChange } from "../src/lib/part-changes";
import { createProject, blankProject } from "../src/lib/projects";

const make = () =>
  createPdm(makeSampleState(), { ...blankPdm(), name: "Bracket" }, "DC");
test("existing PDM records gain drawing fields without losing identifiers or other details", () => {
  const made = make();
  const { drawings, drawingRequirements, ...legacy } = made.item;
  const migrated = readState(
    JSON.stringify({ ...made.state, pdmItems: [legacy] }),
  );
  assert.deepEqual(migrated, made.state);
  assert.ok(
    migrated.pdmItems[0].drawingRequirements.every(
      (r) => r.status === "Not assessed",
    ),
  );
});
test("drawing working versions are independent from drawing and model revisions", () => {
  const made = make();
  let state = addDrawing(
    made.state,
    made.item.id,
    1,
    "Machining",
    "DC",
    "Initial drawing",
  );
  const id = state.pdmItems[0].drawings[0].id;
  const initial = structuredClone(state.pdmItems[0].drawings[0].versions[0]);
  for (let n = 2; n <= 10; n++)
    state = addDrawingVersion(
      state,
      made.item.id,
      state.pdmItems[0].revision,
      id,
      "DC",
      `Change ${n}`,
    );
  state = addDrawing(
    state,
    made.item.id,
    state.pdmItems[0].revision,
    "Inspection",
    "QA",
    "Inspection dimensions",
  );
  const item = state.pdmItems[0];
  assert.equal(item.workingRevision, "0.1");
  assert.equal(item.drawings[0].versions.length, 10);
  assert.equal(item.drawings[0].draftRevision, "0.10");
  assert.equal(item.drawings[0].approvedRevision, null);
  assert.equal(item.drawings[1].versions.length, 1);
  assert.deepEqual(item.drawings[0].versions[0], initial);
  const legacy = JSON.parse(JSON.stringify(state));
  for (const d of legacy.pdmItems[0].drawings) {
    d.draftRevision = "0.1";
    for (const v of d.versions) delete v.revisionLabel;
  }
  assert.deepEqual(readState(JSON.stringify(legacy)), state);
  assert.ok(item.drawings[0].versions.every((v) => v.modelRevision === "0.1"));
  assert.deepEqual(readState(JSON.stringify(state)), state);
  const edited = updatePdm(state, item.id, item.revision, {
    ...pdmFields(item),
    owner: "Alex Morgan",
  });
  assert.deepEqual(edited.pdmItems[0].drawings, item.drawings);
});
test("requirements are explicit, audited, and do not create or approve drawings", () => {
  const made = make();
  const requirements = made.item.drawingRequirements.map((r) => ({
    ...r,
    status: "Required" as const,
  }));
  let state = setDrawingRequirements(made.state, made.item.id, 1, requirements);
  assert.equal(state.pdmItems[0].drawings.length, 0);
  assert.ok(
    state.pdmItems[0].activity[0].summary.includes("Not assessed → Required"),
  );
  assert.throws(
    () =>
      setDrawingRequirements(
        state,
        made.item.id,
        2,
        requirements.map((r) => ({
          ...r,
          status: "Not required",
          reason: " ",
        })),
      ),
    /give a reason/,
  );
  state = setDrawingRequirements(
    state,
    made.item.id,
    2,
    requirements.map((r) => ({
      ...r,
      status: "Not required",
      reason: "Standalone prototype",
    })),
  );
  assert.equal(state.pdmItems[0].status, "Draft");
  assert.deepEqual(readState(JSON.stringify(state)), state);
});
test("drawing writes reject duplicates, missing items, empty notes, and stale changes", () => {
  const made = make();
  const state = addDrawing(
    made.state,
    made.item.id,
    1,
    "Assembly",
    "DC",
    "Assembly instructions",
  );
  const drawing = state.pdmItems[0].drawings[0];
  assert.throws(
    () => addDrawing(state, made.item.id, 2, "Assembly", "DC", "Duplicate"),
    /already exists/,
  );
  assert.throws(
    () => addDrawingVersion(state, made.item.id, 1, drawing.id, "DC", "Stale"),
    /changed elsewhere/,
  );
  assert.throws(
    () => addDrawingVersion(state, made.item.id, 2, "missing", "DC", "Notes"),
    /no longer available/,
  );
  assert.throws(
    () => addDrawingVersion(state, made.item.id, 2, drawing.id, "DC", " "),
    /Describe/,
  );
  assert.throws(
    () =>
      setDrawingRequirements(
        state,
        made.item.id,
        1,
        made.item.drawingRequirements,
      ),
    /changed elsewhere/,
  );
});
test("saved drawing corruption and unsupported approvals are rejected", () => {
  const made = make();
  const state = addDrawing(
    made.state,
    made.item.id,
    1,
    "Machining",
    "DC",
    "Initial",
  );
  const item = state.pdmItems[0],
    drawing = item.drawings[0];
  for (const bad of [
    { ...item, drawings: [{ ...drawing, approvedRevision: "1" }] },
    { ...item, drawings: [drawing, { ...drawing, id: "other" }] },
    {
      ...item,
      drawings: [
        { ...drawing, versions: [{ ...drawing.versions[0], version: 3 }] },
      ],
    },
    {
      ...item,
      drawings: [
        {
          ...drawing,
          versions: [{ ...drawing.versions[0], modelRevision: "99" }],
        },
      ],
    },
    {
      ...item,
      drawingRequirements: DRAWING_TYPES.map((type) => ({
        type,
        status: "Not required",
        reason: "",
      })),
    },
  ])
    assert.throws(() =>
      readState(JSON.stringify({ ...state, pdmItems: [bad] })),
    );
});

test("drawing approval increments DWG revision once, preserves versions and rejects stale or duplicate approval", () => {
  const made = make();
  let s = addDrawing(
    made.state,
    made.item.id,
    1,
    "Machining",
    "Drafter",
    "Initial",
  );
  for (let n = 2; n <= 10; n++)
    s = addDrawingVersion(
      s,
      made.item.id,
      s.pdmItems[0].revision,
      s.pdmItems[0].drawings[0].id,
      "Drafter",
      `Edit ${n}`,
    );
  const input = {
    partId: made.item.id,
    recordRevision: s.pdmItems[0].revision,
    drawingId: s.pdmItems[0].drawings[0].id,
    versionId: s.pdmItems[0].drawings[0].versions.at(-1)!.id,
    modelRevisionId: made.item.modelRevisions[0].id,
    checkedBy: "Checker",
    approvedBy: "Engineering team",
    notes: "Approved at review",
    kind: "Approval" as const,
  };
  assert.throws(
    () =>
      approveDrawing(s, {
        ...input,
        versionId: s.pdmItems[0].drawings[0].versions[0].id,
      }),
    /latest working/,
  );
  assert.throws(
    () => approveDrawing(s, { ...input, checkedBy: "" }),
    /Checked by/,
  );
  s = approveDrawing(s, input);
  const first = structuredClone(s.pdmItems[0].drawings[0].approvals[0]);
  assert.equal(s.pdmItems[0].drawings[0].approvedRevision, 1);
  assert.throws(() => approveDrawing(s, input), /changed elsewhere/);
  assert.throws(
    () =>
      approveDrawing(s, { ...input, recordRevision: s.pdmItems[0].revision }),
    /already approved/,
  );
  s = addDrawingVersion(
    s,
    made.item.id,
    s.pdmItems[0].revision,
    input.drawingId,
    "Drafter",
    "New changes",
  );
  assert.equal(s.pdmItems[0].drawings[0].draftRevision, "1.1");
  assert.equal(
    drawingApprovalFor(s.pdmItems[0].drawings[0], input.modelRevisionId),
    undefined,
  );
  s = approveDrawing(s, {
    ...input,
    recordRevision: s.pdmItems[0].revision,
    versionId: s.pdmItems[0].drawings[0].versions.at(-1)!.id,
  });
  assert.equal(s.pdmItems[0].drawings[0].approvedRevision, 2);
  assert.deepEqual(s.pdmItems[0].drawings[0].approvals[0], first);
  assert.deepEqual(readState(JSON.stringify(s)), s);
  const legacy = JSON.parse(
    JSON.stringify(
      addDrawing(made.state, made.item.id, 1, "Inspection", "D", "Initial"),
    ),
  );
  delete legacy.pdmItems[0].drawings[0].approvals;
  assert.deepEqual(
    readState(JSON.stringify(legacy)).pdmItems[0].drawings[0].approvals,
    [],
  );
});

test("applicability covers an exact new model without incrementing DWG revision; newer target drawing needs approval", () => {
  const made = make();
  let s = addDrawing(
    made.state,
    made.item.id,
    1,
    "Machining",
    "Drafter",
    "Initial",
  );
  const d = s.pdmItems[0].drawings[0];
  const input = {
    partId: made.item.id,
    recordRevision: s.pdmItems[0].revision,
    drawingId: d.id,
    versionId: d.versions[0].id,
    modelRevisionId: made.item.modelRevisions[0].id,
    checkedBy: "Checker",
    approvedBy: "Team",
    notes: "Reviewed",
    kind: "Approval" as const,
  };
  s = approveDrawing(s, input);
  const f = s.features.find(
    (f) => f.status === "In-Work" && f.workType !== "Unassigned",
  )!;
  const system = createProject(s, {
    ...blankProject(),
    title: "Drawing test",
    description: "Test system",
    product: "Gigabot",
  });
  s = system.state;
  const change = startPartChange(s, {
    featureId: f.id,
    sourcePartId: made.item.id,
    sourceRecordRevision: s.pdmItems[0].revision,
    sourceRevisionId: input.modelRevisionId,
    mode: "Revise existing part",
    notes: "New model",
    systemIds: [system.project.id],
    variantName: "",
    initials: "QA",
  });
  s = change.state;
  const modelRevisionId = change.change.resultRevisionId;
  assert.equal(
    drawingApprovalFor(s.pdmItems[0].drawings[0], modelRevisionId),
    undefined,
  );
  s = approveDrawing(s, {
    ...input,
    kind: "Applicability",
    modelRevisionId,
    recordRevision: s.pdmItems[0].revision,
    notes:
      "Unchanged drawing remains applicable; printed PRT REV needs no change",
  });
  assert.equal(
    drawingApprovalFor(s.pdmItems[0].drawings[0], modelRevisionId)?.number,
    1,
  );
  assert.equal(s.pdmItems[0].drawings[0].approvedRevision, 1);
  assert.deepEqual(readState(JSON.stringify(s)), s);
  s = addDrawingVersion(
    s,
    made.item.id,
    s.pdmItems[0].revision,
    d.id,
    "Drafter",
    "Changed printed part revision",
    undefined,
    modelRevisionId,
  );
  assert.equal(
    drawingApprovalFor(s.pdmItems[0].drawings[0], modelRevisionId),
    undefined,
  );
  assert.throws(
    () =>
      approveDrawing(s, {
        ...input,
        kind: "Applicability",
        modelRevisionId,
        recordRevision: s.pdmItems[0].revision,
      }),
    /working drawing exists/,
  );
  assert.equal(
    drawingApprovalFor(s.pdmItems[0].drawings[0], input.modelRevisionId)
      ?.number,
    1,
  );
});
