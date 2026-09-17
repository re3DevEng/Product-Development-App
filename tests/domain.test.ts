import { test } from "node:test";
import assert from "node:assert/strict";
import {
  addDocument,
  createFeature,
  deleteFeature,
  isActive,
  parseDriveLink,
  readState,
  updateFeature,
  type FeatureFields,
} from "../src/lib/domain";
import { makeSampleState } from "../src/lib/seed";

const request: FeatureFields = {
  title: "Test the new enclosure",
  description: "Validate service access with the team.",
  products: ["Gigabot 5"],
  owners: [],
  status: "Request",
  workType: "Unassigned",
  stage: "Not started",
  priority: "Medium",
  roadmap: false,
};
test("new requests have stable IDs and unique sequential numbers even after archival", () => {
  let state = makeSampleState();
  const one = createFeature(state, request);
  state = one.state;
  state = updateFeature(state, one.feature.id, 1, {
    ...request,
    status: "Archive",
  });
  const two = createFeature(state, request);
  assert.notEqual(one.feature.id, two.feature.id);
  assert.notEqual(one.feature.number, two.feature.number);
  assert.equal(
    Number(two.feature.number.split("-")[1]),
    Number(one.feature.number.split("-")[1]) + 1,
  );
});
test("work type starts in-work, all views reference the same owner and stage", () => {
  const result = createFeature(makeSampleState(), request);
  const state = updateFeature(result.state, result.feature.id, 1, {
    ...request,
    workType: "ECR",
    stage: "PDR",
    owners: ["Alex Morgan"],
    roadmap: true,
  });
  const feature = state.features.find((f) => f.id === result.feature.id)!;
  assert.equal(feature.status, "In-Work");
  assert.equal(
    state.features
      .filter((f) => isActive(f) && f.workType === "ECR")
      .find((f) => f.id === feature.id),
    feature,
  );
  assert.equal(
    state.features
      .filter((f) => isActive(f) && f.roadmap)
      .find((f) => f.id === feature.id),
    feature,
  );
  assert.match(feature.activity[0].summary, /Owners: None → Alex Morgan/);
});
test("archive and restore keep identity, owners, roadmap and documents", () => {
  let state = makeSampleState();
  const f = state.features[0];
  state = addDocument(
    state,
    f.id,
    f.revision,
    "Test specification",
    "ECR",
    "https://docs.google.com/document/d/example_file_123456/edit",
  );
  const withDoc = state.features[0];
  state = updateFeature(state, f.id, withDoc.revision, {
    ...withDoc,
    status: "Archive",
  });
  assert.equal(
    state.features
      .filter((v) => isActive(v) && v.roadmap)
      .some((v) => v.id === f.id),
    false,
  );
  const archived = state.features[0];
  state = updateFeature(state, f.id, archived.revision, {
    ...archived,
    status: "In-Work",
  });
  assert.equal(state.features[0].number, f.number);
  assert.deepEqual(state.features[0].documents, withDoc.documents);
  assert.deepEqual(state.features[0].owners, f.owners);
  assert.equal(state.features[0].roadmap, true);
  assert.equal(state.features[0].activity.length, f.activity.length + 3);
});
test("stale edits are rejected instead of overwriting a newer record", () => {
  const state = makeSampleState();
  const f = state.features[0];
  const changed = updateFeature(state, f.id, f.revision, {
    ...f,
    priority: "Low",
  });
  assert.throws(
    () =>
      updateFeature(changed, f.id, f.revision, { ...f, priority: "Medium" }),
    /another tab/,
  );
});
test("linking the same file twice is rejected and ordinary edits do not add files", () => {
  let state = makeSampleState();
  const f = state.features[0];
  state = addDocument(
    state,
    f.id,
    1,
    "Working doc",
    "ECR",
    "https://docs.google.com/document/d/example_file_123456/edit",
  );
  assert.throws(
    () =>
      addDocument(
        state,
        f.id,
        2,
        "Same file",
        "ECR",
        "https://drive.google.com/open?id=example_file_123456",
      ),
    /already linked/,
  );
  state = updateFeature(state, f.id, 2, {
    ...f,
    workType: "OCR",
    stage: "Final Review",
  });
  assert.equal(state.features[0].documents.length, 1);
  assert.equal(state.features[0].documents[0].role, "ECR");
});
test("document links allow individual Google files and reject unsafe or folder links", () => {
  assert.equal(
    parseDriveLink(
      "https://docs.google.com/spreadsheets/d/example_file_123456/edit?usp=sharing",
    ).fileId,
    "example_file_123456",
  );
  for (const url of [
    "javascript:alert(1)",
    "https://evil.example/d/example_file_123456",
    "https://drive.google.com.evil.example/file/d/example_file_123456/view",
    "https://drive.google.com/drive/folders/example_file_123456",
    "http://docs.google.com/document/d/example_file_123456",
  ])
    assert.throws(() => parseDriveLink(url));
});
test("invalid work stages and incomplete requests are rejected", () => {
  const state = makeSampleState();
  assert.throws(
    () => createFeature(state, { ...request, title: " " }),
    /short title/,
  );
  assert.throws(
    () => createFeature(state, { ...request, products: [] }),
    /affected product/,
  );
  assert.throws(
    () => createFeature(state, { ...request, workType: "OCR", stage: "CDR" }),
    /review stage/,
  );
  assert.throws(
    () => createFeature(state, { ...request, status: "In-Work" }),
    /Choose ECR or OCR/,
  );
});
test("saved samples round-trip and corrupted data is detected", () => {
  const state = makeSampleState();
  assert.deepEqual(readState(JSON.stringify(state)), state);
  assert.throws(() => readState("{}"), /Unsupported/);
  const broken = structuredClone(state);
  broken.features[0].number = broken.features[1].number;
  assert.throws(() => readState(JSON.stringify(broken)), /unique/);
  const brokenCounter = structuredClone(state);
  brokenCounter.counters = {};
  assert.throws(() => readState(JSON.stringify(brokenCounter)), /counter/);
});

test("started work cannot become a request, clear its type, or be declined, even after closing", () => {
  let state = makeSampleState();
  const original = state.features[0];
  for (const status of [
    "In-Work",
    "Archive",
    "Complete",
    "Cancelled",
  ] as const) {
    const current = state.features[0];
    state = updateFeature(state, current.id, current.revision, {
      ...current,
      status,
    });
    const closed = state.features[0];
    assert.equal(closed.hasStarted, true);
    assert.throws(
      () =>
        updateFeature(state, closed.id, closed.revision, {
          ...closed,
          status: "Request",
        }),
      /cannot return/,
    );
    assert.throws(
      () =>
        updateFeature(state, closed.id, closed.revision, {
          ...closed,
          workType: "Unassigned",
          stage: "Not started",
        }),
      /Keep an ECR or OCR/,
    );
    assert.throws(
      () =>
        updateFeature(state, closed.id, closed.revision, {
          ...closed,
          status: "Declined",
        }),
      /Use Cancel/,
    );
  }
  const closed = state.features[0];
  state = updateFeature(state, closed.id, closed.revision, {
    ...closed,
    status: "In-Work",
    workType: "OCR",
    stage: "Final Review",
  });
  assert.equal(state.features[0].number, original.number);
  assert.equal(state.features[0].hasStarted, true);
});

test("requests can be declined and restored; cancellation requires starting work", () => {
  const created = createFeature(makeSampleState(), request);
  const f = created.feature;
  assert.throws(
    () =>
      updateFeature(created.state, f.id, f.revision, {
        ...f,
        status: "Cancelled",
      }),
    /Start work/,
  );
  const declined = updateFeature(created.state, f.id, f.revision, {
    ...f,
    status: "Declined",
  });
  const closed = declined.features[0];
  const restored = updateFeature(declined, closed.id, closed.revision, {
    ...closed,
    status: "Request",
  });
  assert.equal(restored.features[0].hasStarted, false);
  const start = restored.features[0];
  const working = updateFeature(restored, start.id, start.revision, {
    ...start,
    workType: "ECR",
  });
  assert.equal(working.features[0].status, "In-Work");
  assert.equal(working.features[0].hasStarted, true);
});

test("permanent deletion removes the feature and history but never reuses its number", () => {
  const created = createFeature(makeSampleState(), {
    ...request,
    title: "Disposable deletion test",
  });
  const f = created.feature;
  const withDoc = addDocument(
    created.state,
    f.id,
    f.revision,
    "Deletion test link",
    "Supporting file",
    "https://docs.google.com/document/d/disposable_file_123456/edit",
  );
  const linked = withDoc.features[0];
  assert.throws(
    () => deleteFeature(withDoc, f.id, linked.revision, "incorrect"),
    /Type the feature number/,
  );
  assert.throws(
    () => deleteFeature(withDoc, f.id, f.revision, f.number),
    /another tab/,
  );
  const deleted = deleteFeature(withDoc, f.id, linked.revision, f.number);
  const serialized = JSON.stringify(deleted);
  for (const value of [
    f.id,
    f.title,
    linked.documents[0].fileId,
    ...linked.activity.map((a) => a.id),
  ])
    assert.equal(serialized.includes(value), false);
  assert.equal(deleted.features.length, created.state.features.length - 1);
  assert.deepEqual(readState(serialized), deleted);
  assert.deepEqual(deleted.counters, withDoc.counters);
  assert.throws(
    () => updateFeature(deleted, f.id, linked.revision, linked),
    /no longer available/,
  );
  assert.notEqual(createFeature(deleted, request).feature.number, f.number);
});

test("existing browser samples gain the started marker without losing their content", () => {
  const initial = makeSampleState();
  const legacy = JSON.parse(JSON.stringify(initial));
  for (const f of legacy.features) delete f.hasStarted;
  const migrated = readState(JSON.stringify(legacy));
  assert.deepEqual(migrated, initial);
  const f = legacy.features[0];
  f.status = "Request";
  f.workType = "Unassigned";
  f.stage = "Not started";
  f.activity.unshift({
    id: "prior-return",
    at: f.updatedAt,
    actor: "Demo user",
    summary: "Work type: ECR → Unassigned\nStatus: In-Work → Request",
  });
  const repaired = readState(JSON.stringify(legacy)).features[0];
  assert.equal(repaired.status, "In-Work");
  assert.equal(repaired.workType, "ECR");
  assert.equal(repaired.hasStarted, true);
  assert.equal(repaired.number, f.number);
  assert.deepEqual(repaired.activity, f.activity);
});
