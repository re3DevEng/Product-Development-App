import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSampleState } from "../src/lib/seed";
import { readState, deleteFeature } from "../src/lib/domain";
import {
  blankPdm,
  createPdm,
  createPdmForChange,
  pdmFields,
  updatePdm,
} from "../src/lib/pdm";

const fields = { ...blankPdm(), name: "Bed Side Plate" };
test("creation from a change links its source and rejects closed or missing changes", () => {
  const state = makeSampleState();
  for (const workType of ["ECR", "OCR"]) {
    const source = state.features.find(
      (f) => f.workType === workType && f.status === "In-Work",
    )!;
    const result = createPdmForChange(state, source.id, fields, "DC");
    assert.deepEqual(result.item.featureIds, [source.id]);
    assert.equal(
      result.item.activity.filter((a) => a.featureId === source.id).length,
      1,
    );
    assert.deepEqual(readState(JSON.stringify(result.state)), result.state);
    assert.equal(result.state.features, state.features);
    const closed = {
      ...state,
      features: state.features.map((f) =>
        f.id === source.id ? { ...f, status: "Complete" as const } : f,
      ),
    };
    assert.throws(
      () => createPdmForChange(closed, source.id, fields, "DC"),
      /active ECR or OCR/,
    );
  }
  assert.throws(
    () => createPdmForChange(state, "deleted", fields, "DC"),
    /active ECR or OCR/,
  );
  const request = state.features.find((f) => f.workType === "Unassigned")!;
  assert.throws(
    () => createPdmForChange(state, request.id, fields, "DC"),
    /active ECR or OCR/,
  );
});
test("PDM upgrades existing data without changing features and uses a shared permanent sequence", () => {
  const original = makeSampleState();
  const { pdmItems, pdmCounter, ...legacy } = original;
  assert.deepEqual(readState(JSON.stringify(legacy)), original);
  const first = createPdm(original, fields, "dc");
  const second = createPdm(
    first.state,
    { ...fields, kind: "Assembly", purpose: "R&D / contract" },
    "CSH",
  );
  assert.equal(first.item.number, "DC-00001");
  assert.equal(second.item.number, "CSH-00002");
  assert.equal(first.item.workingRevision, "0.1");
  assert.equal(first.item.status, "Draft");
  assert.deepEqual(readState(JSON.stringify(second.state)), second.state);
  assert.equal(second.state.features, original.features);
});
test("Odoo assignment preserves identity and working revision and prevents duplicates", () => {
  const first = createPdm(makeSampleState(), fields, "DC");
  const changed = updatePdm(first.state, first.item.id, 1, {
    ...fields,
    odooNumber: "10930",
    owner: "Alex Morgan",
  });
  assert.equal(changed.pdmItems[0].id, first.item.id);
  assert.equal(changed.pdmItems[0].number, first.item.number);
  assert.equal(changed.pdmItems[0].workingRevision, "0.1");
  assert.ok(
    changed.pdmItems[0].activity.some((a) => a.summary.includes("10930")),
  );
  assert.throws(
    () => updatePdm(changed, first.item.id, 1, fields),
    /changed elsewhere/,
  );
  assert.throws(
    () => createPdm(changed, { ...fields, odooNumber: "10930" }, "DC"),
    /already belongs/,
  );
  assert.deepEqual(readState(JSON.stringify(changed)), changed);
});
test("PDM supports multiple changes and feature deletion removes links and related history only", () => {
  const state = makeSampleState();
  const changes = state.features
    .filter((f) => f.workType !== "Unassigned")
    .slice(0, 2);
  assert.equal(changes.length, 2);
  const created = createPdm(
    state,
    { ...fields, featureIds: changes.map((f) => f.id) },
    "DC",
  );
  const deleted = deleteFeature(
    created.state,
    changes[0].id,
    changes[0].revision,
    changes[0].number,
  );
  assert.deepEqual(deleted.pdmItems[0].featureIds, [changes[1].id]);
  assert.ok(
    !deleted.pdmItems[0].activity.some((a) => a.featureId === changes[0].id),
  );
  assert.equal(deleted.pdmCounter, 1);
  assert.equal(deleted.pdmItems[0].id, created.item.id);
  assert.deepEqual(readState(JSON.stringify(deleted)), deleted);
});
test("PDM rejects invalid links, identities, counters and unsupported release state", () => {
  const state = makeSampleState();
  assert.throws(() => createPdm(state, fields, "D1"), /initials/);
  assert.throws(
    () => createPdm(state, { ...fields, featureIds: ["missing"] }, "DC"),
    /existing ECRs/,
  );
  const request = state.features.find((f) => f.workType === "Unassigned")!;
  assert.throws(
    () => createPdm(state, { ...fields, featureIds: [request.id] }, "DC"),
    /existing ECRs/,
  );
  const made = createPdm(state, fields, "DC").state;
  for (const tampered of [
    { ...made, pdmCounter: 0 },
    { ...made, pdmItems: [{ ...made.pdmItems[0], status: "Released" }] },
    { ...made, pdmItems: [{ ...made.pdmItems[0], featureIds: ["missing"] }] },
    {
      ...made,
      pdmItems: [
        made.pdmItems[0],
        {
          ...made.pdmItems[0],
          id: "other",
          creatorInitials: "CSH",
          number: "CSH-00001",
        },
      ],
    },
  ])
    assert.throws(() => readState(JSON.stringify(tampered)));
  assert.deepEqual(pdmFields(made.pdmItems[0]), fields);
});
