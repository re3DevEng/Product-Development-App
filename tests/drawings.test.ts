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
} from "../src/lib/drawings";

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
  assert.equal(item.drawings[0].draftRevision, "0.1");
  assert.equal(item.drawings[0].approvedRevision, null);
  assert.equal(item.drawings[1].versions.length, 1);
  assert.deepEqual(item.drawings[0].versions[0], initial);
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
