import { test } from "node:test";
import assert from "node:assert/strict";
import { readState, updateFeature, deleteFeature } from "../src/lib/domain";
import { makeSampleState } from "../src/lib/seed";
import {
  blankProject,
  createProject,
  updateProject,
  linkProjectFeature,
  changeProjectStatus,
  deleteProject,
  projectActions,
  addProjectDocument,
  type ProjectFields,
} from "../src/lib/projects";

const machine: ProjectFields = {
  ...blankProject(),
  title: "Next machine",
  description: "Improve reliability",
  product: "Gigabot",
  owners: ["Alex Morgan"],
};
const custom: ProjectFields = {
  ...machine,
  title: "Custom machine",
  type: "Custom customer machine",
  customer: "Example customer",
};

test("legacy PRJ numbers migrate to SYS without changing identity, links or sequence", () => {
  const created = createProject(
    makeSampleState(),
    machine,
    "2026-09-17T12:00:00.000Z",
  );
  const linked = linkProjectFeature(
    created.state,
    created.project.id,
    1,
    created.state.features[0].id,
    true,
  );
  const legacy = {
    ...linked,
    projects: [{ ...linked.projects[0], number: "PRJ-2026-001" }],
  };
  const migrated = readState(JSON.stringify(legacy));
  assert.deepEqual(migrated, linked);
  assert.deepEqual(readState(JSON.stringify(migrated)), migrated);
  const next = createProject(migrated, machine, "2026-09-17T13:00:00.000Z");
  assert.equal(next.project.number, "SYS-2026-002");
});

test("project documents migrate, validate links, preserve history and survive lifecycle changes", () => {
  const created = createProject(makeSampleState(), machine);
  const { documents, ...legacyProject } = created.project;
  const migrated = readState(
    JSON.stringify({ ...created.state, projects: [legacyProject] }),
  );
  assert.deepEqual(migrated.projects[0].documents, []);
  const url = "https://docs.google.com/document/d/project_test_file_123/edit";
  let state = addProjectDocument(
    migrated,
    created.project.id,
    1,
    "Requirements",
    url,
  );
  assert.equal(
    state.projects[0].documents[0].url,
    "https://drive.google.com/file/d/project_test_file_123/view",
  );
  assert.match(
    state.projects[0].activity[0].summary,
    /Linked document: Requirements/,
  );
  assert.throws(
    () => addProjectDocument(state, created.project.id, 1, "Old edit", url),
    /another tab/,
  );
  assert.throws(
    () => addProjectDocument(state, created.project.id, 2, "Duplicate", url),
    /already linked/,
  );
  assert.throws(
    () =>
      addProjectDocument(
        state,
        created.project.id,
        2,
        "Unsafe",
        "https://example.com/file",
      ),
    /Google Drive/,
  );
  assert.throws(
    () => addProjectDocument(state, created.project.id, 2, "", url),
    /name/,
  );
  for (const status of [
    "Archive",
    "In work",
    "Complete",
    "In work",
    "Cancelled",
    "In work",
  ] as const) {
    state = changeProjectStatus(
      state,
      created.project.id,
      state.projects[0].revision,
      status,
    );
    assert.equal(state.projects[0].documents.length, 1);
  }
  assert.deepEqual(readState(JSON.stringify(state)), state);
  assert.equal(state.features, migrated.features);
});

test("project controls match features and ordinary actions need no note", () => {
  const created = createProject(makeSampleState(), machine);
  assert.deepEqual(
    projectActions(created.project).map((a) => a.label),
    ["Complete", "Archive", "Cancel system"],
  );
  assert.equal(created.project.status, "In work");
  let state = created.state;
  assert.deepEqual(
    projectActions(state.projects[0]).map((a) => a.label),
    ["Complete", "Archive", "Cancel system"],
  );
  state = changeProjectStatus(state, created.project.id, 1, "Archive");
  assert.deepEqual(projectActions(state.projects[0]), [
    { label: "Restore", status: "In work" },
  ]);
  state = changeProjectStatus(state, created.project.id, 2, "In work");
  state = changeProjectStatus(state, created.project.id, 3, "Complete");
  assert.equal(
    state.projects[0].activity[0].summary,
    "Status: In work → Complete",
  );
  assert.equal(state.features, created.state.features);
});

test("held projects migrate to Archive with history and restore target preserved", () => {
  const created = createProject(makeSampleState(), machine);
  const legacy = {
    ...created.state,
    projects: [
      { ...created.project, status: "On hold", resumeStatus: "Planning" },
    ],
  };
  const restored = readState(JSON.stringify(legacy));
  assert.equal(restored.projects[0].status, "Archive");
  assert.deepEqual(restored.projects[0].activity, created.project.activity);
  assert.deepEqual(projectActions(restored.projects[0]), [
    { label: "Restore", status: "In work" },
  ]);
});

test("planned projects migrate to In work without losing their details or history", () => {
  const created = createProject(makeSampleState(), machine);
  const legacy = {
    ...created.state,
    projects: [
      { ...created.project, status: "Planning", resumeStatus: "Planning" },
    ],
  };
  const migrated = readState(JSON.stringify(legacy));
  assert.deepEqual(migrated.projects[0], created.project);
});

test("project deletion requires confirmation, preserves features and does not reuse numbers", () => {
  const created = createProject(makeSampleState(), machine);
  const state = linkProjectFeature(
    created.state,
    created.project.id,
    1,
    created.state.features[0].id,
    true,
  );
  assert.throws(
    () => deleteProject(state, created.project.id, 1, created.project.number),
    /another tab/,
  );
  assert.throws(
    () => deleteProject(state, created.project.id, 2, "wrong"),
    /Type the system number/,
  );
  const deleted = deleteProject(
    state,
    created.project.id,
    2,
    created.project.number,
  );
  assert.equal(deleted.projects.length, 0);
  assert.equal(deleted.features, state.features);
  assert.deepEqual(deleted.projectCounters, state.projectCounters);
  const next = createProject(deleted, machine);
  assert.notEqual(next.project.number, created.project.number);
  assert.deepEqual(readState(JSON.stringify(deleted)), deleted);
});

test("legacy browser data gains projects without changing features or feature counters", () => {
  const original = makeSampleState();
  const { projects, projectCounters, ...legacy } = original;
  const migrated = readState(JSON.stringify(legacy));
  assert.deepEqual(migrated.features, original.features);
  assert.deepEqual(migrated.counters, original.counters);
  assert.deepEqual(migrated.projects, []);
  assert.deepEqual(migrated.projectCounters, {});
});

test("both project types have independent annual numbers and survive reload", () => {
  const first = createProject(
    makeSampleState(),
    machine,
    "2026-12-20T00:00:00.000Z",
  );
  const second = createProject(first.state, custom, "2026-12-21T00:00:00.000Z");
  const third = createProject(
    second.state,
    machine,
    "2027-01-02T00:00:00.000Z",
  );
  assert.equal(first.project.number, "SYS-2026-001");
  assert.equal(second.project.number, "SYS-2026-002");
  assert.equal(third.project.number, "SYS-2027-001");
  assert.deepEqual(readState(JSON.stringify(third.state)), third.state);
  assert.deepEqual(first.state.counters, makeSampleState().counters);
});

test("multiple projects share one live feature, unlinking preserves it and records history", () => {
  const one = createProject(makeSampleState(), machine);
  const two = createProject(one.state, custom);
  const feature = two.state.features[0];
  let state = linkProjectFeature(
    two.state,
    one.project.id,
    1,
    feature.id,
    true,
  );
  state = linkProjectFeature(state, two.project.id, 1, feature.id, true);
  assert.equal(
    linkProjectFeature(state, one.project.id, 2, feature.id, true),
    state,
  );
  state = updateFeature(state, feature.id, feature.revision, {
    ...feature,
    title: "Shared improvement",
  });
  for (const p of state.projects)
    assert.equal(
      state.features.find((f) => f.id === p.featureIds[0])?.title,
      "Shared improvement",
    );
  state = linkProjectFeature(state, one.project.id, 2, feature.id, false);
  assert.equal(state.features.length, two.state.features.length);
  assert.equal(
    state.projects.find((p) => p.id === one.project.id)?.featureIds.length,
    0,
  );
  assert.match(
    state.projects.find((p) => p.id === one.project.id)!.activity[0].summary,
    /Unlinked/,
  );
  assert.deepEqual(readState(JSON.stringify(state)), state);
});

test("edits and project actions enforce revisions and record before/after history", () => {
  const created = createProject(makeSampleState(), machine);
  let state = updateProject(created.state, created.project.id, 1, {
    ...machine,
    phase: "Design",
    targetDate: "2027-03-01",
  });
  assert.match(
    state.projects[0].activity[0].summary,
    /Phase: Requirements → Design/,
  );
  assert.throws(
    () => updateProject(state, created.project.id, 1, machine),
    /another tab/,
  );
  assert.throws(
    () =>
      linkProjectFeature(
        state,
        created.project.id,
        1,
        state.features[0].id,
        true,
      ),
    /another tab/,
  );
  assert.throws(
    () => changeProjectStatus(state, created.project.id, 1, "In work", "Ready"),
    /another tab/,
  );
  state = changeProjectStatus(
    state,
    created.project.id,
    2,
    "Archive",
    "Waiting for requirements",
  );
  state = changeProjectStatus(
    state,
    created.project.id,
    3,
    "In work",
    "Requirements ready",
  );
  state = updateProject(state, created.project.id, 4, {
    ...state.projects[0],
    phase: "Prototype",
  });
  state = linkProjectFeature(
    state,
    created.project.id,
    5,
    state.features[0].id,
    true,
  );
  const unchangedFeatures = state.features;
  assert.throws(
    () => changeProjectStatus(state, created.project.id, 6, "Complete", ""),
    /summary or reason/,
  );
  state = changeProjectStatus(
    state,
    created.project.id,
    6,
    "Complete",
    "Remaining improvement deferred to next version",
  );
  assert.equal(state.features, unchangedFeatures);
  assert.match(state.projects[0].activity[0].summary, /not marked Complete/);
  state = changeProjectStatus(
    state,
    created.project.id,
    7,
    "In work",
    "Further validation required",
  );
  state = changeProjectStatus(
    state,
    created.project.id,
    8,
    "Cancelled",
    "Project stopped",
  );
  state = changeProjectStatus(
    state,
    created.project.id,
    9,
    "In work",
    "Project restarted",
  );
  assert.equal(state.projects[0].status, "In work");
  assert.throws(
    () =>
      changeProjectStatus(
        state,
        created.project.id,
        10,
        "In work",
        "Already started",
      ),
    /available system action/,
  );
});

test("feature permanent deletion removes project links and related activity without a tombstone", () => {
  const created = createProject(makeSampleState(), machine);
  const feature = created.state.features[0];
  const linked = linkProjectFeature(
    created.state,
    created.project.id,
    1,
    feature.id,
    true,
  );
  const deleted = deleteFeature(
    linked,
    feature.id,
    feature.revision,
    feature.number,
  );
  assert.equal(deleted.projects[0].featureIds.length, 0);
  assert.equal(deleted.projects[0].activity.length, 1);
  assert.equal(deleted.projects[0].revision, 3);
  assert.deepEqual(deleted.counters, linked.counters);
  assert.deepEqual(readState(JSON.stringify(deleted)), deleted);
});

test("reject invalid project fields, broken links, corrupt counters and duplicate IDs", () => {
  assert.throws(
    () => createProject(makeSampleState(), { ...custom, customer: "" }),
    /customer/,
  );
  assert.throws(
    () =>
      createProject(makeSampleState(), {
        ...machine,
        targetDate: "2027-02-30",
      }),
    /valid target date/,
  );
  assert.throws(
    () => createProject(makeSampleState(), { ...custom, phase: "Prototype" }),
    /valid system options/,
  );
  const created = createProject(makeSampleState(), machine);
  assert.throws(
    () => updateProject(created.state, created.project.id, 1, custom),
    /type cannot change/,
  );
  assert.throws(
    () =>
      linkProjectFeature(created.state, created.project.id, 1, "missing", true),
    /no longer available/,
  );
  assert.throws(
    () => readState(JSON.stringify({ ...created.state, projectCounters: {} })),
    /counter/,
  );
  assert.throws(
    () =>
      readState(
        JSON.stringify({
          ...created.state,
          projects: [created.project, created.project],
        }),
      ),
    /unique/,
  );
  assert.throws(
    () =>
      readState(
        JSON.stringify({
          ...created.state,
          projects: [{ ...created.project, featureIds: ["missing"] }],
        }),
      ),
    /could not be read/,
  );
});
