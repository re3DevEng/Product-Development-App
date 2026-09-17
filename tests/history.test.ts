import { test } from "node:test";
import assert from "node:assert/strict";
import { makeSampleState } from "../src/lib/seed";
import {
  blankProject,
  createProject,
  changeProjectStatus,
} from "../src/lib/projects";
import { historyItems } from "../src/lib/history";

test("shared history combines both record types by status and removes restored projects", () => {
  const created = createProject(makeSampleState(), {
    ...blankProject(),
    title: "History example",
    description: "Verify shared history",
    product: "Gigabot",
  });
  let state = changeProjectStatus(
    created.state,
    created.project.id,
    1,
    "Archive",
  );
  for (const status of ["Archive", "Complete", "Cancelled"] as const) {
    if (status !== "Archive") {
      const p = state.projects[0];
      state = changeProjectStatus(state, p.id, p.revision, "In work");
      state = changeProjectStatus(state, p.id, p.revision + 1, status);
    }
    const items = historyItems(state, status);
    assert.equal(items.filter((i) => i.kind === "System").length, 1);
    assert.equal(
      items.filter((i) => i.kind === "Feature").length,
      state.features.filter((f) => f.status === status).length,
    );
    assert.equal(
      items.find((i) => i.kind === "System")?.id,
      created.project.id,
    );
  }
  assert.ok(historyItems(state, "Declined").every((i) => i.kind === "Feature"));
  const p = state.projects[0];
  state = changeProjectStatus(state, p.id, p.revision, "In work");
  assert.ok(
    historyItems(state, "Cancelled").every((i) => i.kind === "Feature"),
  );
});
