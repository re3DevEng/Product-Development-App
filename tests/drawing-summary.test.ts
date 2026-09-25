import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSampleState } from "../src/lib/seed";
import { addPdmExamples } from "../src/lib/pdm-examples";
import { drawingSummary, partRevisionLabel } from "../src/lib/drawing-summary";
import { addDrawingVersion } from "../src/lib/drawings";

test("drawing mapping shows independent DWG revisions and preserves the released package after later edits", () => {
  let s = addPdmExamples(makeSampleState());
  const p = s.pdmItems.find((p) => p.name.includes("Bed plate"))!;
  const model = p.modelRevisions[0].id;
  const rows = drawingSummary(p, model);
  assert.equal(partRevisionLabel(p, model), "Part Rev1 · Released");
  assert.deepEqual(
    rows.map((r) => r.revision),
    ["DWG Rev1", "DWG Rev2", "—"],
  );
  assert.equal(rows[2].status, "Not required");
  s = addDrawingVersion(
    s,
    p.id,
    p.revision,
    p.drawings[0].id,
    "Sample",
    "Later change",
    undefined,
    model,
  );
  assert.deepEqual(
    drawingSummary(
      s.pdmItems.find((v) => v.id === p.id)!,
      model,
    ),
    rows,
  );
  const guide = s.pdmItems.find((p) => p.name.includes("Cable guide"))!;
  assert.equal(
    drawingSummary(guide, guide.modelRevisions.at(-1)!.id)[0].status,
    "Approved · reused unchanged",
  );
  const assembly = s.pdmItems.find((p) => p.kind === "Assembly")!;
  assert.equal(
    drawingSummary(assembly, assembly.modelRevisions[0].id)[2].status,
    "Awaiting approval",
  );
});
