import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSampleState } from "../src/lib/seed";
import { readState, deleteFeature } from "../src/lib/domain";
import {
  blankProject,
  createProject,
  deleteProject,
} from "../src/lib/projects";
import { blankPdm, createPdm, pdmFields, updatePdm } from "../src/lib/pdm";
import { addDrawing, addDrawingVersion } from "../src/lib/drawings";
import { startPartChange, type StartPartChange } from "../src/lib/part-changes";
import { overlappingChanges } from "../src/lib/model-revisions";

function fixture() {
  const system = createProject(makeSampleState(), {
    ...blankProject(),
    title: "GB5",
    description: "New machine",
    product: "Gigabot",
  });
  const made = createPdm(
    system.state,
    { ...blankPdm(), name: "Bracket", odooNumber: "10930" },
    "DC",
  );
  const state = addDrawing(
    made.state,
    made.item.id,
    1,
    "Machining",
    "DC",
    "Source drawing",
  );
  const item = state.pdmItems[0];
  const features = state.features.filter(
    (f) => f.status === "In-Work" && f.workType !== "Unassigned",
  );
  const input: StartPartChange = {
    featureId: features[0].id,
    sourcePartId: item.id,
    sourceRecordRevision: item.revision,
    sourceRevisionId: item.modelRevisions[0].id,
    mode: "Revise existing part",
    systemIds: [system.project.id],
    notes: "Adjust mounting holes",
    variantName: "Custom bracket",
    initials: "QA",
  };
  return { state, item, input, features };
}
test("revision creates an independent draft history entry and preserves source/drawings/configurations", () => {
  const { state, item, input } = fixture();
  const result = startPartChange(state, input);
  const updated = result.state.pdmItems[0];
  assert.equal(updated.id, item.id);
  assert.equal(updated.number, item.number);
  assert.equal(updated.odooNumber, "10930");
  assert.equal(updated.workingRevision, "0.2");
  assert.deepEqual(updated.modelRevisions[0], item.modelRevisions[0]);
  assert.deepEqual(updated.drawings, item.drawings);
  assert.equal(result.state.projects, state.projects);
  assert.deepEqual(result.change.systemIds, input.systemIds);
  assert.equal(result.change.opsDecision, "Pending Ops");
  assert.deepEqual(readState(JSON.stringify(result.state)), result.state);
});
test("variants receive a new identity without copying Odoo identity or drawing approvals", () => {
  const { state, item, input } = fixture();
  const result = startPartChange(state, { ...input, mode: "Create variant" });
  const variant = result.state.pdmItems.find(
    (p) => p.id === result.change.resultPartId,
  )!;
  assert.notEqual(variant.id, item.id);
  assert.equal(variant.number, "QA-00002");
  assert.equal(variant.odooNumber, "");
  assert.equal(variant.workingRevision, "0.1");
  assert.deepEqual(variant.modelRevisions[0].source, {
    partId: item.id,
    revisionId: input.sourceRevisionId,
  });
  assert.equal(variant.drawings.length, 0);
  assert.deepEqual(variant.featureIds, [input.featureId]);
  const source = result.state.pdmItems.find((p) => p.id === item.id)!;
  assert.deepEqual(source.modelRevisions, item.modelRevisions);
  assert.deepEqual(source.drawings, item.drawings);
  assert.deepEqual(readState(JSON.stringify(result.state)), result.state);
});
test("parallel revisions branch from the chosen source and warn on both sides including variants", () => {
  const { state, input, features } = fixture();
  const first = startPartChange(state, input);
  const second = startPartChange(first.state, {
    ...input,
    featureId: features[1].id,
    sourceRecordRevision: first.state.pdmItems[0].revision,
  });
  assert.equal(second.state.pdmItems[0].workingRevision, "0.3");
  assert.equal(second.change.sourceRevisionId, input.sourceRevisionId);
  assert.equal(
    overlappingChanges(second.state, first.change)[0].id,
    second.change.id,
  );
  assert.equal(
    overlappingChanges(second.state, second.change)[0].id,
    first.change.id,
  );
  const variant = startPartChange(second.state, {
    ...input,
    featureId: features[2].id,
    mode: "Create variant",
    sourceRecordRevision: second.state.pdmItems[0].revision,
  });
  assert.equal(overlappingChanges(variant.state, variant.change).length, 2);
  assert.deepEqual(readState(JSON.stringify(variant.state)), variant.state);
});
test("drawings keep exact source revision references when newer model revisions exist", () => {
  const { state, input } = fixture();
  const result = startPartChange(state, input);
  const item = result.state.pdmItems[0],
    drawing = item.drawings[0];
  const updated = addDrawingVersion(
    result.state,
    item.id,
    item.revision,
    drawing.id,
    "QA",
    "Updated for model 0.2",
    undefined,
    item.modelRevisions[1].id,
  );
  const versions = updated.pdmItems[0].drawings[0].versions;
  assert.equal(versions[0].modelRevision, "0.1");
  assert.equal(versions[1].modelRevision, "0.2");
  assert.equal(updated.pdmItems[0].drawings[0].draftRevision, "0.1");
  assert.throws(
    () =>
      addDrawingVersion(
        updated,
        item.id,
        updated.pdmItems[0].revision,
        drawing.id,
        "QA",
        "Invalid",
        undefined,
        "unknown",
      ),
    /existing model revision/,
  );
  assert.deepEqual(readState(JSON.stringify(updated)), updated);
});
test("legacy model and drawing references migrate deterministically without resetting data", () => {
  const { state, item } = fixture();
  const { modelRevisions, ...legacy } = item;
  const { partChanges, ...old } = state;
  const raw = JSON.stringify({
    ...old,
    pdmItems: [
      {
        ...legacy,
        drawings: legacy.drawings.map((d) => ({
          ...d,
          versions: d.versions.map(({ modelRevisionId, ...v }) => v),
        })),
      },
    ],
  });
  assert.deepEqual(readState(raw), state);
  assert.deepEqual(readState(raw), readState(raw));
});
test("invalid, stale and detached change efforts are rejected", () => {
  const { state, input } = fixture();
  for (const bad of [
    { ...input, systemIds: [] },
    { ...input, systemIds: ["missing"] },
    { ...input, sourceRevisionId: "missing" },
    { ...input, notes: " " },
    { ...input, featureId: "missing" },
  ])
    assert.throws(() => startPartChange(state, bad));
  const result = startPartChange(state, input);
  assert.throws(
    () => startPartChange(result.state, input),
    /changed elsewhere/,
  );
  const p = result.state.pdmItems[0];
  assert.throws(
    () =>
      updatePdm(result.state, p.id, p.revision, {
        ...pdmFields(p),
        featureIds: [],
      }),
    /Keep links/,
  );
  assert.throws(
    () => readState(JSON.stringify({ ...result.state, partChanges: [] })),
    /missing its change/,
  );
});
test("one ECR supports successive test revisions while preserving drawings, lineage and activity", () => {
  const { state, input, item } = fixture();
  let current = state;
  let sourceRevisionId = input.sourceRevisionId;
  for (const notes of [
    "First design",
    "Test revealed flex; add rib",
    "Retest: adjust clearance",
  ]) {
    const before = current.pdmItems[0];
    const result = startPartChange(current, {
      ...input,
      sourceRecordRevision: before.revision,
      sourceRevisionId,
      notes,
    });
    assert.equal(result.change.sourceRevisionId, sourceRevisionId);
    assert.deepEqual(
      result.state.pdmItems[0].modelRevisions.slice(0, -1),
      before.modelRevisions,
    );
    assert.deepEqual(overlappingChanges(result.state, result.change), []);
    assert.throws(
      () =>
        startPartChange(result.state, {
          ...input,
          sourceRecordRevision: before.revision,
          sourceRevisionId,
          notes,
        }),
      /changed elsewhere/,
    );
    sourceRevisionId = result.change.resultRevisionId;
    current = result.state;
  }
  const updated = current.pdmItems[0];
  assert.equal(updated.id, item.id);
  assert.equal(updated.number, item.number);
  assert.equal(updated.odooNumber, item.odooNumber);
  assert.deepEqual(
    updated.modelRevisions.map((r) => r.label),
    ["0.1", "0.2", "0.3", "0.4"],
  );
  assert.equal(updated.workingRevision, "0.4");
  assert.deepEqual(updated.drawings, item.drawings);
  assert.equal(
    current.partChanges.filter((c) => c.featureId === input.featureId).length,
    3,
  );
  assert.equal(updated.activity.length, item.activity.length + 3);
  const originalFeature = state.features.find((f) => f.id === input.featureId)!;
  assert.equal(
    current.features.find((f) => f.id === input.featureId)!.activity.length,
    originalFeature.activity.length + 3,
  );
  assert.deepEqual(readState(JSON.stringify(current)), current);
});
test("permanent deletion cleans references while preserving independent model revision records", () => {
  const { state, input, features } = fixture();
  const changed = startPartChange(state, input).state;
  const deleted = deleteFeature(
    changed,
    features[0].id,
    changed.features.find((f) => f.id === features[0].id)!.revision,
    features[0].number,
  );
  assert.equal(deleted.partChanges[0].featureId, null);
  assert.equal(deleted.pdmItems[0].modelRevisions.length, 2);
  assert.deepEqual(readState(JSON.stringify(deleted)), deleted);
  const system = deleted.projects[0];
  const noSystem = deleteProject(
    deleted,
    system.id,
    system.revision,
    system.number,
  );
  assert.equal(noSystem.partChanges[0].systemIds.length, 0);
  assert.deepEqual(readState(JSON.stringify(noSystem)), noSystem);
});
