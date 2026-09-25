import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSampleState } from "../src/lib/seed";
import { readState } from "../src/lib/domain";
import { addPdmExamples } from "../src/lib/pdm-examples";
import { drawingReleaseIssues } from "../src/lib/drawings";

test("drawing examples preserve existing records, validate, and are added only once", () => {
  const initial = makeSampleState();
  const next = addPdmExamples(initial);
  assert.deepEqual(
    next.features.filter((f) =>
      initial.features.some((old) => old.id === f.id),
    ),
    initial.features,
  );
  assert.equal(next.pdmItems.length, 3);
  assert.equal(next.features.length, initial.features.length + 3);
  assert.deepEqual(readState(JSON.stringify(next)), next);
  assert.equal(addPdmExamples(next), next);
  const plate = next.pdmItems.find((p) => p.name.includes("Bed plate"))!;
  assert.equal(plate.releases[0].number, 1);
  assert.deepEqual(
    plate.drawings.map((d) => d.approvedRevision),
    [1, 2],
  );
  const assembly = next.pdmItems.find((p) => p.kind === "Assembly")!;
  assert.equal(assembly.drawings[0].versions.length, 2);
  assert.equal(
    drawingReleaseIssues(assembly, assembly.modelRevisions[0].id).length,
    1,
  );
  const guide = next.pdmItems.find((p) => p.name.includes("Cable guide"))!;
  assert.equal(guide.workingRevision, "1.1");
  assert.equal(guide.drawings[0].approvedRevision, 1);
  assert.deepEqual(
    drawingReleaseIssues(guide, guide.modelRevisions.at(-1)!.id),
    [],
  );
});
