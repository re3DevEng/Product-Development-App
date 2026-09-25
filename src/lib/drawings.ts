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
  revisionLabel: string;
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
  draftRevision: string;
  approvedRevision: number | null;
  approvals: DrawingApproval[];
  versions: DrawingVersion[];
};
export type DrawingApproval = {
  id: string;
  number: number;
  versionId: string;
  modelRevisionId: string;
  checkedBy: string;
  approvedBy: string;
  notes: string;
  at: string;
  kind: "Approval" | "Applicability";
};
export function drawingRevisionLabel(d: Drawing, versionId: string): string {
  const v = d.versions.find((v) => v.id === versionId)!;
  if (v.revisionLabel) return v.revisionLabel;
  const major = Math.max(
    0,
    ...(d.approvals ?? [])
      .filter(
        (a) =>
          a.kind === "Approval" &&
          a.at <= v.at &&
          d.versions.findIndex((old) => old.id === a.versionId) <
            d.versions.indexOf(v),
      )
      .map((a) => a.number),
  );
  const baseline = (d.approvals ?? []).find(
    (a) => a.kind === "Approval" && a.number === major,
  );
  const earlier = d.versions
    .slice(0, d.versions.indexOf(v))
    .filter(
      (old) =>
        !baseline ||
        (old.at >= baseline.at &&
          d.versions.findIndex((r) => r.id === baseline.versionId) <
            d.versions.indexOf(old)),
    );
  return `${major}.${earlier.length + 1}`;
}
export function nextDrawingRevision(d: Drawing): string {
  const major = d.approvedRevision ?? 0;
  const minors = d.versions
    .map((v) => drawingRevisionLabel(d, v.id))
    .filter((label) => label.startsWith(`${major}.`))
    .map((label) => Number(label.split(".")[1]));
  return `${major}.${Math.max(0, ...minors) + 1}`;
}
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
    revisionLabel: `0.${number}`,
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
    approvals: [],
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
  next.revisionLabel = nextDrawingRevision(drawing);
  return replace(
    state,
    item,
    {
      drawings: item.drawings.map((d) =>
        d.id === drawingId
          ? {
              ...d,
              draftRevision: next.revisionLabel,
              versions: [...d.versions, next],
            }
          : d,
      ),
    },
    `${drawing.type} drawing: recorded draft Rev${next.revisionLabel} for model Rev${next.modelRevision}`,
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
      !/^\d+\.[1-9]\d*$/.test(d.draftRevision) ||
      !Array.isArray(d.versions) ||
      !d.versions.length
    )
      throw new Error("A saved drawing could not be read.");
    ids.add(d.id);
    types.add(d.type);
    if (d.approvals === undefined) d.approvals = [];
    if (!Array.isArray(d.approvals))
      throw new Error("Invalid drawing approvals.");
    d.versions.forEach((v, i) => {
      if (v && v.revisionLabel === undefined)
        v.revisionLabel = drawingRevisionLabel(d, v.id);
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
        !/^\d+\.[1-9]\d*$/.test(v.revisionLabel) ||
        d.versions.some(
          (other) => other !== v && other.revisionLabel === v.revisionLabel,
        ) ||
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
    d.draftRevision = d.versions.at(-1)!.revisionLabel;
    let number = 0;
    const approvedVersions = new Set<string>();
    for (const a of d.approvals) {
      const v = d.versions.find((v) => v.id === a?.versionId);
      if (
        !a ||
        !v ||
        !a.id ||
        ids.has(a.id) ||
        !item.modelRevisions.some((r) => r.id === a.modelRevisionId) ||
        ![a.checkedBy, a.approvedBy, a.notes].every(
          (s) => typeof s === "string" && !!s.trim() && s.length <= 2000,
        ) ||
        typeof a.at !== "string" ||
        !Number.isFinite(Date.parse(a.at))
      )
        throw new Error("Invalid drawing approval history.");
      if (a.kind === "Approval") {
        if (
          a.number !== ++number ||
          approvedVersions.has(v.id) ||
          a.modelRevisionId !== v.modelRevisionId ||
          !v.drawnBy.trim()
        )
          throw new Error("Invalid approved drawing revision.");
        approvedVersions.add(v.id);
      } else if (
        a.kind !== "Applicability" ||
        !d.approvals.some(
          (prior) =>
            prior.kind === "Approval" &&
            prior.versionId === v.id &&
            prior.number === a.number,
        ) ||
        !approvedVersions.has(v.id)
      ) {
        throw new Error("Invalid drawing applicability review.");
      }
      ids.add(a.id);
    }
    if (d.approvedRevision !== (number || null))
      throw new Error("Invalid approved drawing revision.");
  }
}

export function drawingApprovalFor(d: Drawing, modelRevisionId: string) {
  // A newer working version for this exact model requires a fresh approval.
  const version = [...d.versions]
    .reverse()
    .find((v) => v.modelRevisionId === modelRevisionId);
  return [...d.approvals]
    .reverse()
    .find(
      (a) =>
        a.modelRevisionId === modelRevisionId &&
        (!version || a.versionId === version.id),
    );
}

export function drawingReleaseIssues(
  item: PdmItem,
  modelRevisionId: string,
): string[] {
  return item.drawingRequirements.flatMap((r) => {
    if (r.status === "Not assessed")
      return [`${r.type}: assess whether this drawing is required.`];
    if (r.status === "Not required") return [];
    const drawing = item.drawings.find((d) => d.type === r.type);
    return drawing && drawingApprovalFor(drawing, modelRevisionId)
      ? []
      : [`${r.type}: approval needed for this part revision.`];
  });
}

export function approveDrawing(
  state: AppState,
  input: {
    partId: string;
    recordRevision: number;
    drawingId: string;
    versionId: string;
    modelRevisionId: string;
    checkedBy: string;
    approvedBy: string;
    notes: string;
    kind: DrawingApproval["kind"];
  },
  at = new Date().toISOString(),
): AppState {
  const item = current(state, input.partId, input.recordRevision);
  const drawing = item.drawings.find((d) => d.id === input.drawingId);
  const v = drawing?.versions.find((v) => v.id === input.versionId);
  if (
    !drawing ||
    !v ||
    !item.modelRevisions.some((r) => r.id === input.modelRevisionId)
  )
    throw new Error("Choose an existing drawing version and part revision.");
  if (
    ![input.checkedBy, input.approvedBy, input.notes].every(
      (s) => typeof s === "string" && !!s.trim() && s.length <= 2000,
    )
  )
    throw new Error("Record Checked by, Approved by, and review notes.");
  const latest = [...drawing.versions]
    .reverse()
    .find((v) => v.modelRevisionId === input.modelRevisionId);
  let number: number;
  if (input.kind === "Approval") {
    if (v.modelRevisionId !== input.modelRevisionId || latest?.id !== v.id)
      throw new Error(
        "Approve the latest working drawing version for its associated part revision.",
      );
    if (!v.drawnBy.trim())
      throw new Error(
        "Record a working version with Drawn by filled in before approval.",
      );
    if (
      drawing.approvals.some(
        (a) => a.kind === "Approval" && a.versionId === v.id,
      )
    )
      throw new Error("This drawing version is already approved.");
    number = (drawing.approvedRevision ?? 0) + 1;
  } else if (input.kind === "Applicability") {
    const original = drawing.approvals.find(
      (a) => a.kind === "Approval" && a.versionId === v.id,
    );
    if (!original)
      throw new Error(
        "Choose an approved drawing version for an applicability review.",
      );
    if (latest && latest.id !== v.id)
      throw new Error(
        "A working drawing exists for this part revision. Approve that version instead.",
      );
    if (drawingApprovalFor(drawing, input.modelRevisionId))
      throw new Error(
        "This part revision already has a current drawing approval.",
      );
    number = original.number;
  } else throw new Error("Choose approval or applicability review.");
  const approval: DrawingApproval = {
    id: newId(),
    number,
    versionId: v.id,
    modelRevisionId: input.modelRevisionId,
    checkedBy: input.checkedBy.trim(),
    approvedBy: input.approvedBy.trim(),
    notes: input.notes.trim(),
    kind: input.kind,
    at,
  };
  return replace(
    state,
    item,
    {
      drawings: item.drawings.map((d) =>
        d.id === drawing.id
          ? {
              ...d,
              approvedRevision:
                input.kind === "Approval" ? number : d.approvedRevision,
              approvals: [...d.approvals, approval],
            }
          : d,
      ),
    },
    `${drawing.type} drawing Rev${number}: ${input.kind === "Approval" ? "approved" : "approved as still applicable"} for model Rev${item.modelRevisions.find((r) => r.id === input.modelRevisionId)!.label}. Checked by ${approval.checkedBy}; approved by ${approval.approvedBy}. ${approval.notes}`,
    at,
  );
}
