import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSampleState } from "../src/lib/seed";
import { readState, updateFeature, deleteFeature } from "../src/lib/domain";
import {
  createProject,
  blankProject,
  deleteProject,
} from "../src/lib/projects";
import { historyItems } from "../src/lib/history";
import {
  blankSoftware,
  createSoftware,
  updateSoftware,
  softwareFields,
  changeSoftwareStatus,
  linkSoftwareFeature,
  linkSoftwareSystem,
  softwareDependencies,
  addSoftwareDocument,
} from "../src/lib/software";

const request = {
  ...blankSoftware(),
  title: "Calibration controls",
  description: "Add calibration controls for the sensor",
  application: "Firmware",
};
test("software creation, bug fields, numbering and legacy migration preserve existing records", () => {
  const original = makeSampleState();
  const { software, softwareCounters, ...legacy } = original;
  assert.deepEqual(readState(JSON.stringify(legacy)), original);
  const first = createSoftware(original, request, "2026-09-18T12:00:00.000Z");
  const bug = createSoftware(
    first.state,
    {
      ...request,
      type: "Bug report",
      steps: "Open calibration",
      expected: "Calibrates",
      actual: "Stops",
    },
    "2026-09-18T12:00:00.000Z",
  );
  assert.equal(first.item.number, "SW-2026-001");
  assert.equal(bug.item.number, "SW-2026-002");
  assert.equal(
    createSoftware(bug.state, request, "2027-01-02T12:00:00.000Z").item.number,
    "SW-2027-001",
  );
  assert.deepEqual(readState(JSON.stringify(bug.state)), bug.state);
  assert.equal(bug.state.features, original.features);
});

test("software can support several features and systems without being duplicated", () => {
  const system = createProject(makeSampleState(), {
    ...blankProject(),
    title: "New machine",
    description: "New version",
    product: "Gigabot",
  });
  const created = createSoftware(system.state, request);
  let state = linkSoftwareFeature(
    created.state,
    created.item.id,
    1,
    created.state.features[0].id,
    true,
  );
  state = linkSoftwareFeature(
    state,
    created.item.id,
    2,
    state.features[1].id,
    false,
  );
  state = linkSoftwareSystem(
    state,
    created.item.id,
    3,
    system.project.id,
    true,
  );
  assert.equal(state.software.length, 1);
  assert.equal(state.software[0].featureLinks.length, 2);
  assert.deepEqual(state.software[0].systemIds, [system.project.id]);
  assert.equal(
    linkSoftwareFeature(state, created.item.id, 4, state.features[0].id, true),
    state,
  );
  state = updateSoftware(state, created.item.id, 4, {
    ...request,
    title: "Shared calibration",
    owners: ["Alex Morgan"],
  });
  assert.match(
    state.software[0].activity[0].summary,
    /Calibration controls → Shared calibration/,
  );
  state = linkSoftwareFeature(
    state,
    created.item.id,
    5,
    state.features[0].id,
    null,
  );
  assert.equal(state.features.length, created.state.features.length);
  assert.equal(state.software[0].featureLinks.length, 1);
  assert.deepEqual(readState(JSON.stringify(state)), state);
});

test("required software blocks feature completion until complete; related and cancelled are distinct", () => {
  const created = createSoftware(makeSampleState(), request);
  const f = created.state.features[0];
  let state = linkSoftwareFeature(
    created.state,
    created.item.id,
    1,
    f.id,
    true,
  );
  assert.throws(
    () => updateFeature(state, f.id, f.revision, { ...f, status: "Complete" }),
    /required software/,
  );
  state = changeSoftwareStatus(state, created.item.id, 2, "In work");
  state = changeSoftwareStatus(state, created.item.id, 3, "Cancelled");
  assert.equal(softwareDependencies(state, f.id).length, 1);
  assert.throws(
    () => updateFeature(state, f.id, f.revision, { ...f, status: "Complete" }),
    /required software/,
  );
  state = changeSoftwareStatus(state, created.item.id, 4, "In work");
  state = changeSoftwareStatus(state, created.item.id, 5, "Testing");
  state = changeSoftwareStatus(state, created.item.id, 6, "Complete");
  assert.equal(softwareDependencies(state, f.id).length, 0);
  const done = updateFeature(state, f.id, f.revision, {
    ...f,
    status: "Complete",
  });
  assert.equal(done.features.find((v) => v.id === f.id)?.status, "Complete");
  assert.equal(
    historyItems(state, "Complete").filter((v) => v.kind === "Software").length,
    1,
  );
  const related = linkSoftwareFeature(
    created.state,
    created.item.id,
    1,
    f.id,
    false,
  );
  assert.doesNotThrow(() =>
    updateFeature(related, f.id, f.revision, { ...f, status: "Complete" }),
  );
});

test("stale updates, unknown links and unfinished dependencies on completed features are rejected", () => {
  const created = createSoftware(makeSampleState(), request);
  const state = updateSoftware(created.state, created.item.id, 1, {
    ...request,
    priority: "High",
  });
  assert.throws(
    () => updateSoftware(state, created.item.id, 1, request),
    /changed elsewhere/,
  );
  assert.throws(
    () =>
      linkSoftwareFeature(
        state,
        created.item.id,
        1,
        state.features[0].id,
        true,
      ),
    /changed elsewhere/,
  );
  assert.throws(
    () => linkSoftwareFeature(state, created.item.id, 2, "missing", true),
    /no longer available/,
  );
  const complete = state.features.find((f) => f.status === "Complete")!;
  assert.throws(
    () => linkSoftwareFeature(state, created.item.id, 2, complete.id, true),
    /Restore this feature/,
  );
  assert.throws(
    () => changeSoftwareStatus(state, created.item.id, 2, "Complete"),
    /available software action/,
  );
  assert.throws(
    () =>
      readState(
        JSON.stringify({
          ...state,
          software: [
            {
              ...state.software[0],
              featureLinks: [{ featureId: "missing", required: true }],
            },
          ],
        }),
      ),
    /relationships/,
  );
});

test("permanent feature/system deletion removes software references and reference activity only", () => {
  const system = createProject(makeSampleState(), {
    ...blankProject(),
    title: "New machine",
    description: "New version",
    product: "Gigabot",
  });
  const created = createSoftware(system.state, request);
  const f = created.state.features[0];
  let state = linkSoftwareFeature(
    created.state,
    created.item.id,
    1,
    f.id,
    true,
  );
  state = linkSoftwareSystem(
    state,
    created.item.id,
    2,
    system.project.id,
    true,
  );
  state = deleteFeature(state, f.id, f.revision, f.number);
  state = deleteProject(
    state,
    system.project.id,
    system.project.revision,
    system.project.number,
  );
  assert.deepEqual(state.software[0].featureLinks, []);
  assert.deepEqual(state.software[0].systemIds, []);
  assert.equal(state.software[0].activity.length, 1);
  assert.deepEqual(readState(JSON.stringify(state)), state);
});

test("software documents and workflow history survive archive/restore", () => {
  const created = createSoftware(makeSampleState(), request);
  const url = "https://docs.google.com/document/d/software_test_file_123/edit";
  let state = addSoftwareDocument(
    created.state,
    created.item.id,
    1,
    "Specification",
    url,
  );
  assert.throws(
    () => addSoftwareDocument(state, created.item.id, 2, "Duplicate", url),
    /already linked/,
  );
  state = changeSoftwareStatus(state, created.item.id, 2, "Archive");
  state = changeSoftwareStatus(state, created.item.id, 3, "Request");
  assert.equal(state.software[0].documents.length, 1);
  assert.deepEqual(softwareFields(state.software[0]), request);
  assert.deepEqual(readState(JSON.stringify(state)), state);
});

test("software keeps its original progression and cannot return to a request", () => {
  const created = createSoftware(makeSampleState(), request);
  let state = changeSoftwareStatus(
    created.state,
    created.item.id,
    1,
    "In work",
  );
  assert.throws(
    () => changeSoftwareStatus(state, created.item.id, 2, "Request"),
    /available software action/,
  );
  assert.throws(
    () => changeSoftwareStatus(state, created.item.id, 2, "Complete"),
    /available software action/,
  );
  state = changeSoftwareStatus(state, created.item.id, 2, "Testing");
  state = changeSoftwareStatus(state, created.item.id, 3, "Archive");
  state = changeSoftwareStatus(state, created.item.id, 4, "Testing");
  state = changeSoftwareStatus(state, created.item.id, 5, "In work");
  state = changeSoftwareStatus(state, created.item.id, 6, "Testing");
  state = changeSoftwareStatus(state, created.item.id, 7, "Complete");
  assert.equal(state.software[0].status, "Complete");
  assert.deepEqual(readState(JSON.stringify(state)), state);
});
test("short-lived engineering stages are removed without losing history", () => {
  const created = createSoftware(makeSampleState(), request);
  for (const status of ["In work", "Archive", "Complete", "Cancelled"]) {
    const legacy = {
      ...created.state,
      software: [
        { ...created.item, status, resumeStatus: "In work", stage: "ORR" },
      ],
    };
    const migrated = readState(JSON.stringify(legacy));
    assert.equal(
      migrated.software[0].status,
      status === "In work" ? "Testing" : status,
    );
    assert.equal(migrated.software[0].resumeStatus, "Testing");
    assert.equal("stage" in migrated.software[0], false);
    assert.deepEqual(migrated.software[0].activity, created.item.activity);
    assert.deepEqual(readState(JSON.stringify(migrated)), migrated);
  }
});

