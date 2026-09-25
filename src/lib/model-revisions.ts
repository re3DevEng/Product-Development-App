import type { AppState } from "./domain";
import type { PdmItem } from "./pdm";

export type ModelRevision = {
  id: string;
  label: string;
  status: "Draft";
  createdAt: string;
  notes: string;
  source: { partId: string; revisionId: string } | null;
};
export type PartChange = {
  id: string;
  featureId: string | null;
  sourcePartId: string;
  sourceRevisionId: string;
  resultPartId: string;
  resultRevisionId: string;
  mode: "Revise existing part" | "Create variant";
  systemIds: string[];
  notes: string;
  createdAt: string;
  opsDecision: "Pending Ops";
};
// Deterministic identity makes an unsaved additive migration stable across tabs.
export const initialModelRevision = (
  id: string,
  at: string,
): ModelRevision => ({
  id: `${id}:model:0.1`,
  label: "0.1",
  status: "Draft",
  createdAt: at,
  notes: "Initial development revision",
  source: null,
});
export function validateModelRevisions(item: PdmItem) {
  if (item.modelRevisions === undefined)
    item.modelRevisions = [initialModelRevision(item.id, item.createdAt)];
  if (!Array.isArray(item.modelRevisions) || !item.modelRevisions.length)
    throw new Error("Model revision history is missing.");
  const ids = new Set(),
    labels = new Set();
  item.modelRevisions.forEach((r, index) => {
    if (
      !r ||
      typeof r.id !== "string" ||
      !r.id ||
      ids.has(r.id) ||
      !/^(0|[1-9]\d*)\.[1-9]\d*$/.test(r.label) ||
      labels.has(r.label) ||
      r.status !== "Draft" ||
      typeof r.notes !== "string" ||
      !r.notes.trim() ||
      typeof r.createdAt !== "string" ||
      !Number.isFinite(Date.parse(r.createdAt)) ||
      (r.source !== null &&
        (!r.source ||
          typeof r.source.partId !== "string" ||
          typeof r.source.revisionId !== "string"))
    )
      throw new Error("Invalid model revision history.");
    ids.add(r.id);
    labels.add(r.label);
  });
  if (
    item.workingRevision !==
    item.modelRevisions[item.modelRevisions.length - 1].label
  )
    throw new Error("The working model revision does not match its history.");
}
export function overlappingChanges(state: AppState, change: PartChange) {
  // Informational parallel-work lookup only; this never blocks a release.
  // Actual newer-release notices follow the result identity and source lineage.
  const unresolved = (c: PartChange) =>
    c.featureId &&
    state.features.some(
      (f) =>
        f.id === c.featureId && !["Cancelled", "Declined"].includes(f.status),
    );
  return unresolved(change)
    ? state.partChanges.filter(
        (c) =>
          c.id !== change.id &&
          c.featureId !== change.featureId &&
          c.sourcePartId === change.sourcePartId &&
          unresolved(c),
      )
    : [];
}
export function validatePartChanges(state: AppState) {
  if (state.partChanges === undefined) state.partChanges = [];
  if (!Array.isArray(state.partChanges))
    throw new Error("Invalid part change history.");
  const ids = new Set(),
    results = new Set();
  for (const c of state.partChanges) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !c.id ||
      ids.has(c.id) ||
      !["Revise existing part", "Create variant"].includes(c.mode) ||
      c.opsDecision !== "Pending Ops" ||
      (c.featureId !== null &&
        !state.features.some(
          (f) => f.id === c.featureId && f.workType !== "Unassigned",
        )) ||
      !Array.isArray(c.systemIds) ||
      new Set(c.systemIds).size !== c.systemIds.length ||
      c.systemIds.some((id) => !state.projects.some((p) => p.id === id)) ||
      typeof c.notes !== "string" ||
      !c.notes.trim() ||
      c.notes.length > 2000 ||
      typeof c.createdAt !== "string" ||
      !Number.isFinite(Date.parse(c.createdAt))
    )
      throw new Error("A saved part change could not be read.");
    const source = state.pdmItems.find((p) => p.id === c.sourcePartId);
    const result = state.pdmItems.find((p) => p.id === c.resultPartId);
    const sourceRev = source?.modelRevisions.find(
      (r) => r.id === c.sourceRevisionId,
    );
    const resultRev = result?.modelRevisions.find(
      (r) => r.id === c.resultRevisionId,
    );
    const key = `${c.resultPartId}/${c.resultRevisionId}`;
    if (
      !sourceRev ||
      !resultRev ||
      results.has(key) ||
      resultRev.source?.partId !== c.sourcePartId ||
      resultRev.source?.revisionId !== c.sourceRevisionId ||
      (c.mode === "Revise existing part"
        ? source !== result ||
          source!.modelRevisions.indexOf(sourceRev) >=
            result!.modelRevisions.indexOf(resultRev)
        : source === result || result!.modelRevisions[0] !== resultRev) ||
      (c.featureId && !result!.featureIds.includes(c.featureId))
    )
      throw new Error("A part change has a broken source or result link.");
    ids.add(c.id);
    results.add(key);
  }
  for (const p of state.pdmItems)
    for (const r of p.modelRevisions)
      if (
        r.source &&
        !state.partChanges.some(
          (c) => c.resultPartId === p.id && c.resultRevisionId === r.id,
        )
      )
        throw new Error(
          "A derived model revision is missing its change record.",
        );
}
