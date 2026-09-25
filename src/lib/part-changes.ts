import { newId } from "./browser-support";
import { nextWorkingLabel } from "./releases";
import type { AppState } from "./domain";
import { createPdm } from "./pdm";
import type { PartChange, ModelRevision } from "./model-revisions";

export type StartPartChange = {
  featureId: string;
  sourcePartId: string;
  sourceRecordRevision: number;
  sourceRevisionId: string;
  mode: PartChange["mode"];
  systemIds: string[];
  notes: string;
  variantName: string;
  initials: string;
};
export function startPartChange(
  state: AppState,
  input: StartPartChange,
  now = new Date().toISOString(),
) {
  const feature = state.features.find((f) => f.id === input.featureId);
  if (
    !feature ||
    feature.workType === "Unassigned" ||
    feature.status !== "In-Work"
  )
    throw new Error("Start part changes from an active ECR or OCR.");
  const source = state.pdmItems.find((p) => p.id === input.sourcePartId);
  if (!source || source.revision !== input.sourceRecordRevision)
    throw new Error(
      "The source part changed elsewhere. Close this form and select it again.",
    );
  const sourceRevision = source.modelRevisions.find(
    (r) => r.id === input.sourceRevisionId,
  );
  if (!sourceRevision) throw new Error("Choose an existing source revision.");
  if (!["Revise existing part", "Create variant"].includes(input.mode))
    throw new Error("Choose a revision or a variant.");
  if (
    !Array.isArray(input.systemIds) ||
    !input.systemIds.length ||
    input.systemIds.some(
      (id) =>
        !state.projects.some((p) => p.id === id && p.status === "In work"),
    )
  )
    throw new Error("Choose at least one active target system.");
  if (
    typeof input.notes !== "string" ||
    !input.notes.trim() ||
    input.notes.trim().length > 2000
  )
    throw new Error("Describe the proposed change in up to 2,000 characters.");
  let next = state;
  let result = source;
  let model: ModelRevision;
  if (input.mode === "Create variant") {
    const made = createPdm(
      state,
      {
        name: input.variantName,
        description: source.description,
        kind: source.kind,
        purpose: source.purpose,
        owner: source.owner,
        odooNumber: "",
        featureIds: [feature.id],
      },
      input.initials,
      now,
    );
    next = made.state;
    result = made.item;
    model = {
      ...result.modelRevisions[0],
      notes: input.notes.trim(),
      source: { partId: source.id, revisionId: sourceRevision.id },
    };
  } else {
    model = {
      id: newId(),
      label: nextWorkingLabel(source),
      status: "Draft",
      createdAt: now,
      notes: input.notes.trim(),
      source: { partId: source.id, revisionId: sourceRevision.id },
    };
  }
  const change: PartChange = {
    id: newId(),
    featureId: feature.id,
    sourcePartId: source.id,
    sourceRevisionId: sourceRevision.id,
    resultPartId: result.id,
    resultRevisionId: model.id,
    mode: input.mode,
    systemIds: [...new Set(input.systemIds)],
    notes: input.notes.trim(),
    createdAt: now,
    opsDecision: "Pending Ops",
  };
  const summary = `${input.mode}: ${source.number} Rev${sourceRevision.label} → ${result.number} Rev${model.label}. Ops numbering decision pending.`;
  next = {
    ...next,
    features: next.features.map((f) =>
      f.id === feature.id
        ? {
            ...f,
            revision: f.revision + 1,
            updatedAt: now,
            activity: [
              { id: newId(), at: now, actor: "Demo user", summary },
              ...f.activity,
            ],
          }
        : f,
    ),
    partChanges: [change, ...next.partChanges],
    pdmItems: next.pdmItems.map((p) => {
      if (p.id !== source.id && p.id !== result.id) return p;
      const updated =
        p.id === result.id
          ? {
              ...p,
              workingRevision: model.label,
              modelRevisions:
                input.mode === "Create variant"
                  ? [model]
                  : [...p.modelRevisions, model],
              featureIds: [...new Set([...p.featureIds, feature.id])],
            }
          : p;
      return {
        ...updated,
        revision: p.revision + 1,
        updatedAt: now,
        activity: [
          {
            id: newId(),
            at: now,
            actor: "Demo user",
            summary,
            featureId: feature.id,
          },
          ...p.activity,
        ],
      };
    }),
  };
  return { state: next, change };
}
