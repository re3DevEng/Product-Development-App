import { newId } from "./browser-support";
import type { AppState } from "./domain";
import type { PdmItem } from "./pdm";

export const DRAWING_TYPES = ["Machining", "Inspection", "Assembly"] as const;
export type DrawingType = (typeof DRAWING_TYPES)[number];
export const REQUIREMENT_STATES = [
  "Not assessed",
  "Required",
  "Not required",
] as const;
export type DrawingRequirement = {
  type: DrawingType;
  status: (typeof REQUIREMENT_STATES)[number];
  reason: string;
};
export type DrawingVersion = {
  id: string;
  version: number;
  modelRevision: string;
  modelRevisionId: string;
  drawnBy: string;
  notes: string;
  at: string;
  actor: string;
};
export type Drawing = {
  id: string;
  type: DrawingType;
  draftRevision: "0.1";
  approvedRevision: null;
  versions: DrawingVersion[];
};
export const blankDrawingRequirements = (): DrawingRequirement[] =>
  DRAWING_TYPES.map((type) => ({ type, status: "Not assessed", reason: "" }));
function current(state: AppState, id: string, revision: number) {
  const item = state.pdmItems.find((p) => p.id === id);
  if (!item) throw new Error("This part or assembly is no longer available.");
  if (item.revision !== revision)
    throw new Error(
      "This record changed elsewhere. Close this form and reopen it to use the latest version.",
    );
  return item;
}
function replace(
  state: AppState,
  item: PdmItem,
  fields: Partial<PdmItem>,
  summary: string,
  at: string,
): AppState {
  return {
    ...state,
    pdmItems: state.pdmItems.map((p) =>
      p.id === item.id
        ? {
            ...p,
            ...fields,
            revision: p.revision + 1,
            updatedAt: at,
            activity: [
              { id: newId(), actor: "Demo user", at, summary },
              ...p.activity,
            ],
          }
        : p,
    ),
  };
}
function version(
  item: PdmItem,
  number: number,
  drawnBy: string,
  notes: string,
  at: string,
  modelRevisionId?: string,
): DrawingVersion {
  const model = modelRevisionId
    ? item.modelRevisions.find((r) => r.id === modelRevisionId)
    : item.modelRevisions.find((r) => r.label === item.workingRevision);
  if (!model)
    throw new Error(
      "Choose an existing model revision for this drawing version.",
    );
  if (
    typeof drawnBy !== "string" ||
    drawnBy.trim().length > 100 ||
    typeof notes !== "string" ||
    !notes.trim() ||
    notes.trim().length > 2000
  )
    throw new Error(
      "Describe this working version (up to 2,000 characters); keep Drawn by under 100 characters.",
    );
  return {
    id: newId(),
    version: number,
    modelRevision: model.label,
    modelRevisionId: model.id,
    drawnBy: drawnBy.trim(),
    notes: notes.trim(),
    at,
    actor: "Demo user",
  };
}
export function addDrawing(
  state: AppState,
  partId: string,
  revision: number,
  type: DrawingType,
  drawnBy: string,
  notes: string,
  now = new Date().toISOString(),
  modelRevisionId?: string,
): AppState {
  const item = current(state, partId, revision);
  if (!DRAWING_TYPES.includes(type))
    throw new Error("Choose Machining, Inspection, or Assembly.");
  if (item.drawings.some((d) => d.type === type))
    throw new Error(
      "This drawing type already exists. Record a new working version instead.",
    );
  const drawing: Drawing = {
    id: newId(),
    type,
    draftRevision: "0.1",
    approvedRevision: null,
    versions: [version(item, 1, drawnBy, notes, now, modelRevisionId)],
  };
  return replace(
    state,
    item,
    { drawings: [...item.drawings, drawing] },
    `Created ${type} drawing: draft Rev0.1, working version 1, model Rev${drawing.versions[0].modelRevision}`,
    now,
  );
}
export function addDrawingVersion(
  state: AppState,
  partId: string,
  revision: number,
  drawingId: string,
  drawnBy: string,
  notes: string,
  now = new Date().toISOString(),
  modelRevisionId?: string,
): AppState {
  const item = current(state, partId, revision);
  const drawing = item.drawings.find((d) => d.id === drawingId);
  if (!drawing) throw new Error("This drawing is no longer available.");
  const next = version(
    item,
    drawing.versions.length + 1,
    drawnBy,
    notes,
    now,
    modelRevisionId,
  );
  return replace(
    state,
    item,
    {
      drawings: item.drawings.map((d) =>
        d.id === drawingId ? { ...d, versions: [...d.versions, next] } : d,
      ),
    },
    `${drawing.type} drawing: recorded working version ${next.version} for model Rev${next.modelRevision}; draft remains Rev${drawing.draftRevision}`,
    now,
  );
}
function checkRequirements(requirements: DrawingRequirement[]) {
  if (
    !Array.isArray(requirements) ||
    requirements.length !== DRAWING_TYPES.length ||
    new Set(requirements.map((r) => r?.type)).size !== DRAWING_TYPES.length ||
    requirements.some(
      (r) =>
        !r ||
        !DRAWING_TYPES.includes(r.type) ||
        !REQUIREMENT_STATES.includes(r.status) ||
        typeof r.reason !== "string" ||
        r.reason.length > 1000 ||
        (r.status === "Not required" && !r.reason.trim()),
    )
  )
    throw new Error(
      "Assess each drawing type and give a reason for any type marked Not required.",
    );
}
export function setDrawingRequirements(
  state: AppState,
  partId: string,
  revision: number,
  requirements: DrawingRequirement[],
  now = new Date().toISOString(),
): AppState {
  const item = current(state, partId, revision);
  checkRequirements(requirements);
  const next = DRAWING_TYPES.map((type) => {
    const r = requirements.find((r) => r.type === type)!;
    return { ...r, reason: r.reason.trim() };
  });
  const changes = next.filter(
    (r) =>
      JSON.stringify(r) !==
      JSON.stringify(
        item.drawingRequirements.find((old) => old.type === r.type),
      ),
  );
  if (!changes.length) return state;
  const summary = changes
    .map((r) => {
      const old = item.drawingRequirements.find((old) => old.type === r.type)!;
      return `${r.type}: ${old.status}${old.reason ? ` (${old.reason})` : ""} → ${r.status}${r.reason ? ` (${r.reason})` : ""}`;
    })
    .join("\n");
  return replace(
    state,
    item,
    { drawingRequirements: next },
    `Drawing requirements updated\n${summary}`,
    now,
  );
}
export function validateDrawings(item: PdmItem) {
  if (item.drawings === undefined) item.drawings = [];
  if (item.drawingRequirements === undefined)
    item.drawingRequirements = blankDrawingRequirements();
  checkRequirements(item.drawingRequirements);
  if (!Array.isArray(item.drawings)) throw new Error("Invalid saved drawings.");
  const ids = new Set(),
    types = new Set(),
    versionIds = new Set();
  for (const d of item.drawings) {
    if (
      !d ||
      typeof d.id !== "string" ||
      !d.id ||
      ids.has(d.id) ||
      !DRAWING_TYPES.includes(d.type) ||
      types.has(d.type) ||
      d.draftRevision !== "0.1" ||
      d.approvedRevision !== null ||
      !Array.isArray(d.versions) ||
      !d.versions.length
    )
      throw new Error("A saved drawing could not be read.");
    ids.add(d.id);
    types.add(d.type);
    d.versions.forEach((v, i) => {
      if (v && v.modelRevisionId === undefined)
        v.modelRevisionId =
          item.modelRevisions.find((r) => r.label === v.modelRevision)?.id ??
          "";
      if (
        !v ||
        typeof v.id !== "string" ||
        !v.id ||
        versionIds.has(v.id) ||
        v.version !== i + 1 ||
        !item.modelRevisions.some(
          (r) => r.id === v.modelRevisionId && r.label === v.modelRevision,
        ) ||
        typeof v.drawnBy !== "string" ||
        v.drawnBy.length > 100 ||
        typeof v.notes !== "string" ||
        !v.notes.trim() ||
        v.notes.length > 2000 ||
        typeof v.at !== "string" ||
        !Number.isFinite(Date.parse(v.at)) ||
        typeof v.actor !== "string"
      )
        throw new Error("A saved drawing version could not be read.");
      versionIds.add(v.id);
    });
  }
}
