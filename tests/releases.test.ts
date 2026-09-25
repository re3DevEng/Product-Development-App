import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSampleState } from "../src/lib/seed";
import { readState, deleteFeature, type AppState } from "../src/lib/domain";
import {
  blankProject,
  createProject,
  deleteProject,
} from "../src/lib/projects";
import { blankPdm, createPdm, pdmFields, updatePdm } from "../src/lib/pdm";
import { startPartChange } from "../src/lib/part-changes";
import {
  addDrawing,
  setDrawingRequirements,
  approveDrawing,
  addDrawingVersion,
  drawingReleaseIssues,
} from "../src/lib/drawings";
import {
  approvePart,
  releasePart,
  newerRelease,
  currentApproval,
  nextWorkingLabel,
  type ApprovalInput,
} from "../src/lib/releases";

function fixture() {
  const system = createProject(makeSampleState(), {
    ...blankProject(),
    title: "Test system",
    description: "Release fixture",
    product: "Gigabot",
  });
  const features = system.state.features.filter(
    (f) => f.status === "In-Work" && f.workType !== "Unassigned",
  );
  const made = createPdm(
    system.state,
    {
      ...blankPdm(),
      name: "Test bracket",
      odooNumber: "12345",
      featureIds: [features[0].id, features[1].id],
    },
    "QA",
  );
  const partId = made.item.id;
  const a = startPartChange(made.state, {
    featureId: features[0].id,
    sourcePartId: partId,
    sourceRecordRevision: made.item.revision,
    sourceRevisionId: made.item.modelRevisions[0].id,
    mode: "Revise existing part",
    systemIds: [system.project.id],
    notes: "Branch A",
    variantName: "",
    initials: "QA",
  });
  const b = startPartChange(a.state, {
    featureId: features[1].id,
    sourcePartId: partId,
    sourceRecordRevision: a.state.pdmItems[0].revision,
    sourceRevisionId: made.item.modelRevisions[0].id,
    mode: "Revise existing part",
    systemIds: [system.project.id],
    notes: "Branch B",
    variantName: "",
    initials: "QA",
  });
  const input = (state: AppState, branch = a.change): ApprovalInput => ({
    partId,
    recordRevision: state.pdmItems.find((p) => p.id === partId)!.revision,
    revisionId: branch.resultRevisionId,
    featureId: branch.featureId!,
    participants: "Engineering team",
    meetingDate: "2026-09-25",
    notes: "Team approved this exact draft",
    differenceDecision: "",
    differenceNotes: "",
    systemIds: [system.project.id],
    opsNotes: "Ops confirms existing number",
  });
  const release = (state: AppState, branch = a.change) =>
    releasePart(state, {
      ...input(state, branch),
      releasedBy: "Test release manager",
      authorized: true,
    });
  const state = setDrawingRequirements(
    b.state,
    partId,
    b.state.pdmItems[0].revision,
    b.state.pdmItems[0].drawingRequirements.map((r) => ({
      ...r,
      status: "Not required",
      reason: "No drawing needed in this metadata test",
    })),
  );
  return { state, a: a.change, b: b.change, partId, input, release };
}

test("part release blocks unassessed, missing, unapproved and wrong-model drawings; exact approval enables release", () => {
  const f = fixture();
  let s = setDrawingRequirements(
    f.state,
    f.partId,
    f.state.pdmItems[0].revision,
    f.state.pdmItems[0].drawingRequirements.map((r) => ({
      ...r,
      status: "Not assessed",
    })),
  );
  s = approvePart(s, f.input(s));
  assert.throws(() => f.release(s), /assess whether/);
  s = setDrawingRequirements(
    s,
    f.partId,
    s.pdmItems[0].revision,
    s.pdmItems[0].drawingRequirements.map((r) => ({
      ...r,
      status: r.type === "Machining" ? "Required" : "Not required",
      reason: "Only machining drawing needed",
    })),
  );
  s = approvePart(s, f.input(s));
  assert.throws(() => f.release(s), /Machining: approval needed/);
  s = addDrawing(
    s,
    f.partId,
    s.pdmItems[0].revision,
    "Machining",
    "Drafter",
    "Branch B drawing",
    undefined,
    f.b.resultRevisionId,
  );
  const d = s.pdmItems[0].drawings[0];
  const drawingInput = {
    partId: f.partId,
    recordRevision: s.pdmItems[0].revision,
    drawingId: d.id,
    versionId: d.versions[0].id,
    modelRevisionId: f.b.resultRevisionId,
    checkedBy: "Checker",
    approvedBy: "Team",
    notes: "Reviewed",
    kind: "Approval" as const,
  };
  s = approveDrawing(s, drawingInput);
  s = approvePart(s, f.input(s));
  assert.throws(() => f.release(s), /Machining: approval needed/);
  s = addDrawingVersion(
    s,
    f.partId,
    s.pdmItems[0].revision,
    d.id,
    "Drafter",
    "Branch A drawing",
    undefined,
    f.a.resultRevisionId,
  );
  s = approvePart(s, f.input(s));
  assert.throws(() => f.release(s), /Machining: approval needed/);
  s = approveDrawing(s, {
    ...drawingInput,
    recordRevision: s.pdmItems[0].revision,
    versionId: s.pdmItems[0].drawings[0].versions.at(-1)!.id,
    modelRevisionId: f.a.resultRevisionId,
  });
  assert.throws(() => f.release(s), /missing or outdated/);
  s = approvePart(s, f.input(s));
  assert.deepEqual(
    drawingReleaseIssues(s.pdmItems[0], f.a.resultRevisionId),
    [],
  );
  s = f.release(s);
  assert.equal(s.pdmItems[0].releases[0].number, 1);
  assert.deepEqual(readState(JSON.stringify(s)), s);
  const preserved = structuredClone(s.pdmItems[0].releases[0]);
  s = addDrawingVersion(
    s,
    f.partId,
    s.pdmItems[0].revision,
    d.id,
    "Drafter",
    "Later edit",
    undefined,
    f.a.resultRevisionId,
  );
  assert.deepEqual(s.pdmItems[0].releases[0], preserved);
  assert.ok(drawingReleaseIssues(s.pdmItems[0], f.a.resultRevisionId).length);
});
test("parallel work does not block first release; the other branch requires newer-release review and gets Rev2", () => {
  const f = fixture();
  const approved = approvePart(f.state, f.input(f.state));
  assert.equal(approved.pdmItems[0].releases.length, 0);
  const first = f.release(approved);
  assert.equal(first.pdmItems[0].releases[0].number, 1);
  assert.equal(
    newerRelease(first.pdmItems[0], f.b.resultRevisionId)?.number,
    1,
  );
  assert.equal(
    newerRelease(first.pdmItems[0], f.a.resultRevisionId),
    undefined,
  );
  assert.throws(
    () => approvePart(first, f.input(first, f.b)),
    /review of the newer release/,
  );
  const secondApproval = approvePart(first, {
    ...f.input(first, f.b),
    differenceDecision: "Proceed with intentional differences",
    differenceNotes:
      "Engineering accepts geometry differences for the selected system.",
  });
  const second = f.release(secondApproval, f.b);
  assert.deepEqual(
    second.pdmItems[0].releases.map((r) => r.number),
    [1, 2],
  );
  assert.deepEqual(
    second.pdmItems[0].releases[0],
    first.pdmItems[0].releases[0],
  );
  assert.deepEqual(
    second.pdmItems[0].modelRevisions,
    f.state.pdmItems[0].modelRevisions,
  );
  assert.deepEqual(second.projects, f.state.projects);
  assert.deepEqual(readState(JSON.stringify(second)), second);
  assert.equal(nextWorkingLabel(second.pdmItems[0]), "2.1");
});
test("another release invalidates approval and duplicate or stale release attempts fail", () => {
  const f = fixture();
  let s = approvePart(f.state, f.input(f.state, f.b));
  s = approvePart(s, f.input(s));
  const staleInput = { ...f.input(s), releasedBy: "Test", authorized: true };
  s = f.release(s);
  assert.equal(
    currentApproval(s, s.pdmItems[0], f.b.resultRevisionId, f.b.featureId!),
    undefined,
  );
  assert.throws(() => f.release(s, f.b), /missing or outdated/);
  assert.throws(() => f.release(s), /already released/);
  assert.throws(() => releasePart(s, staleInput), /part changed/);
});
test("new model iterations, drawing edits and Ops edits require updated approval", () => {
  const f = fixture();
  const s = approvePart(f.state, f.input(f.state));
  const p = s.pdmItems[0];
  const drawing = addDrawing(
    s,
    p.id,
    p.revision,
    "Machining",
    "QA",
    "New drawing",
  );
  assert.throws(() => f.release(drawing), /missing or outdated/);
  const edited = updatePdm(s, p.id, p.revision, {
    ...pdmFields(p),
    odooNumber: "67890",
  });
  assert.throws(() => f.release(edited), /missing or outdated/);
  const iteration = startPartChange(s, {
    featureId: f.a.featureId!,
    sourcePartId: p.id,
    sourceRecordRevision: p.revision,
    sourceRevisionId: f.a.resultRevisionId,
    mode: "Revise existing part",
    systemIds: f.a.systemIds,
    notes: "Another test iteration",
    variantName: "",
    initials: "QA",
  });
  assert.throws(() => f.release(iteration.state), /latest revision/);
  assert.equal(
    currentApproval(
      iteration.state,
      iteration.state.pdmItems[0],
      iteration.change.resultRevisionId,
      f.a.featureId!,
    ),
    undefined,
  );
});
test("variants have independent release numbering and no outdated notice from their source", () => {
  const f = fixture();
  const variant = startPartChange(f.state, {
    featureId: f.b.featureId!,
    sourcePartId: f.partId,
    sourceRecordRevision: f.state.pdmItems[0].revision,
    sourceRevisionId: f.b.sourceRevisionId,
    mode: "Create variant",
    systemIds: f.b.systemIds,
    notes: "Independent geometry",
    variantName: "Custom bracket",
    initials: "QA",
  });
  let s = f.release(approvePart(variant.state, f.input(variant.state)));
  let p = s.pdmItems.find((p) => p.id === variant.change.resultPartId)!;
  assert.equal(newerRelease(p, p.modelRevisions[0].id), undefined);
  assert.equal(p.releases.length, 0);
  assert.equal(p.odooNumber, "");
  const input = {
    ...f.input(s, f.b),
    partId: p.id,
    recordRevision: p.revision,
    revisionId: p.modelRevisions[0].id,
  };
  assert.throws(() => approvePart(s, input), /Ops must assign/);
  s = updatePdm(s, p.id, p.revision, { ...pdmFields(p), odooNumber: "54321" });
  p = s.pdmItems.find((p) => p.id === input.partId)!;
  s = setDrawingRequirements(
    s,
    p.id,
    p.revision,
    p.drawingRequirements.map((r) => ({
      ...r,
      status: "Not required",
      reason: "Variant test requires no drawings",
    })),
  );
  p = s.pdmItems.find((p) => p.id === input.partId)!;
  s = approvePart(s, { ...input, recordRevision: p.revision });
  p = s.pdmItems.find((v) => v.id === input.partId)!;
  s = releasePart(s, {
    ...input,
    recordRevision: p.revision,
    releasedBy: "Test",
    authorized: true,
  });
  assert.equal(
    s.pdmItems.find((p) => p.id === input.partId)!.releases[0].number,
    1,
  );
  assert.deepEqual(readState(JSON.stringify(s)), s);
});
test("released baselines start new working revisions with lineage and no stale notice", () => {
  const f = fixture();
  const s = f.release(approvePart(f.state, f.input(f.state)));
  const p = s.pdmItems[0];
  const next = startPartChange(s, {
    featureId: f.a.featureId!,
    sourcePartId: p.id,
    sourceRecordRevision: p.revision,
    sourceRevisionId: f.a.resultRevisionId,
    mode: "Revise existing part",
    systemIds: f.a.systemIds,
    notes: "Next development cycle",
    variantName: "",
    initials: "QA",
  });
  assert.equal(next.state.pdmItems[0].workingRevision, "1.1");
  assert.equal(
    newerRelease(next.state.pdmItems[0], next.change.resultRevisionId),
    undefined,
  );
  assert.deepEqual(readState(JSON.stringify(next.state)), next.state);
});
test("approval inputs, authorization and system deletion are checked", () => {
  const f = fixture();
  for (const patch of [
    { participants: "" },
    { opsNotes: "" },
    { systemIds: [] },
    { meetingDate: "no-date" },
  ])
    assert.throws(() =>
      approvePart(f.state, { ...f.input(f.state), ...patch }),
    );
  const s = approvePart(f.state, f.input(f.state));
  assert.throws(
    () =>
      releasePart(s, { ...f.input(s), releasedBy: "Test", authorized: false }),
    /authorization/,
  );
  const system = s.projects[0];
  const removed = deleteProject(s, system.id, system.revision, system.number);
  assert.throws(() => f.release(removed), /missing or outdated/);
});
test("old saves migrate release arrays; deleting an ECR preserves release identity without its link", () => {
  const f = fixture();
  const legacy = JSON.parse(JSON.stringify(f.state));
  delete legacy.pdmItems[0].approvals;
  delete legacy.pdmItems[0].releases;
  assert.deepEqual(readState(JSON.stringify(legacy)), f.state);
  const s = f.release(approvePart(f.state, f.input(f.state)));
  const feature = s.features.find((v) => v.id === f.a.featureId)!;
  const removed = deleteFeature(
    s,
    feature.id,
    feature.revision,
    feature.number,
  );
  assert.equal(removed.pdmItems[0].releases[0].featureId, null);
  assert.deepEqual(readState(JSON.stringify(removed)), removed);
  const bad = JSON.parse(JSON.stringify(s));
  bad.pdmItems[0].releases[0].number = 3;
  assert.throws(() => readState(JSON.stringify(bad)), /release history/);
});
