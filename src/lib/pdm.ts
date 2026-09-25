import { newId } from "./browser-support";
import {
  validateReleases,
  type EngineeringApproval,
  type PartRelease,
} from "./releases";
import type { Activity, AppState } from "./domain";
import {
  initialModelRevision,
  validateModelRevisions,
  type ModelRevision,
} from "./model-revisions";
import {
  blankDrawingRequirements,
  validateDrawings,
  type Drawing,
  type DrawingRequirement,
} from "./drawings";

export const PDM_KINDS = ["Part", "Assembly"] as const;
export const PDM_PURPOSES = ["Production", "R&D / contract"] as const;
export type PdmFields = {
  name: string;
  description: string;
  kind: (typeof PDM_KINDS)[number];
  purpose: (typeof PDM_PURPOSES)[number];
  owner: string;
  odooNumber: string;
  featureIds: string[];
};
export type PdmItem = PdmFields & {
  id: string;
  number: string;
  creatorInitials: string;
  revision: number; // Record concurrency version; independent of the CAD revision.
  workingRevision: string;
  modelRevisions: ModelRevision[];
  approvals: EngineeringApproval[];
  releases: PartRelease[];
  status: "Draft";
  createdAt: string;
  updatedAt: string;
  activity: (Activity & { featureId?: string })[];
  drawings: Drawing[];
  drawingRequirements: DrawingRequirement[];
};
export const blankPdm = (): PdmFields => ({
  name: "",
  description: "",
  kind: "Part",
  purpose: "Production",
  owner: "",
  odooNumber: "",
  featureIds: [],
});
export function pdmFields(item: PdmItem): PdmFields {
  return Object.fromEntries(
    Object.keys(blankPdm()).map((key) => [key, item[key as keyof PdmFields]]),
  ) as PdmFields;
}
function validate(
  fields: PdmFields,
  state: AppState,
  excludeId?: string,
): PdmFields {
  if (
    !fields ||
    [fields.name, fields.description, fields.owner, fields.odooNumber].some(
      (v) => typeof v !== "string",
    ) ||
    !Array.isArray(fields.featureIds) ||
    fields.featureIds.some((id) => typeof id !== "string")
  )
    throw new Error("Invalid PDM details.");
  const name = fields.name.trim(),
    odooNumber = fields.odooNumber.trim();
  if (!name || name.length > 180)
    throw new Error("Enter a part name of up to 180 characters.");
  if (
    !PDM_KINDS.includes(fields.kind) ||
    !PDM_PURPOSES.includes(fields.purpose)
  )
    throw new Error("Choose valid part options.");
  if (odooNumber && !/^\d{1,30}$/.test(odooNumber))
    throw new Error("Enter the numeric Odoo part number without brackets.");
  if (
    odooNumber &&
    state.pdmItems.some(
      (p) => p.id !== excludeId && p.odooNumber === odooNumber,
    )
  )
    throw new Error("That Odoo number already belongs to another PDM record.");
  if (
    fields.featureIds.some(
      (id) =>
        !state.features.some((f) => f.id === id && f.workType !== "Unassigned"),
    )
  )
    throw new Error("Link only existing ECRs or OCRs.");
  return {
    ...fields,
    name,
    description: fields.description.trim(),
    owner: fields.owner.trim(),
    odooNumber,
    featureIds: [...new Set(fields.featureIds)],
  };
}
function event(
  summary: string,
  at: string,
  featureId?: string,
): PdmItem["activity"][number] {
  return {
    id: newId(),
    actor: "Demo user",
    at,
    summary,
    ...(featureId ? { featureId } : {}),
  };
}
function linkEvents(
  state: AppState,
  before: string[],
  after: string[],
  now: string,
) {
  return [...new Set([...before, ...after])]
    .filter((id) => before.includes(id) !== after.includes(id))
    .map((id) => {
      const f = state.features.find((f) => f.id === id)!;
      return event(
        `${after.includes(id) ? "Linked" : "Unlinked"} ${f.workType} ${f.number}`,
        now,
        id,
      );
    });
}
export function createPdm(
  state: AppState,
  fields: PdmFields,
  initials: string,
  now = new Date().toISOString(),
) {
  const normalized = validate(fields, state);
  const creatorInitials = initials.trim().toUpperCase();
  if (!/^[A-Z]{2,5}$/.test(creatorInitials))
    throw new Error("Enter 2 to 5 letters for the creator's initials.");
  const sequence = state.pdmCounter + 1;
  if (!Number.isSafeInteger(sequence))
    throw new Error("The internal part counter needs recovery.");
  const id = newId();
  const item: PdmItem = {
    ...normalized,
    id,
    modelRevisions: [initialModelRevision(id, now)],
    approvals: [],
    releases: [],
    number: `${creatorInitials}-${String(sequence).padStart(5, "0")}`,
    creatorInitials,
    revision: 1,
    workingRevision: "0.1",
    status: "Draft",
    drawings: [],
    drawingRequirements: blankDrawingRequirements(),
    createdAt: now,
    updatedAt: now,
    activity: [
      ...linkEvents(state, [], normalized.featureIds, now),
      event("Created draft at Rev0.1", now),
    ],
  };
  return {
    item,
    state: {
      ...state,
      pdmCounter: sequence,
      pdmItems: [item, ...state.pdmItems],
    },
  };
}
export function createPdmForChange(
  state: AppState,
  featureId: string,
  fields: PdmFields,
  initials: string,
  now = new Date().toISOString(),
) {
  const feature = state.features.find((f) => f.id === featureId);
  if (
    !feature ||
    feature.workType === "Unassigned" ||
    feature.status !== "In-Work"
  )
    throw new Error(
      "Create parts from an active ECR or OCR. This change may have been closed or deleted; reopen it before continuing.",
    );
  return createPdm(
    state,
    { ...fields, featureIds: [...new Set([featureId, ...fields.featureIds])] },
    initials,
    now,
  );
}
export function updatePdm(
  state: AppState,
  id: string,
  revision: number,
  fields: PdmFields,
  now = new Date().toISOString(),
): AppState {
  const current = state.pdmItems.find((p) => p.id === id);
  if (!current) throw new Error("This PDM record is no longer available.");
  if (current.revision !== revision)
    throw new Error(
      "This record changed elsewhere. Discard your edits and reopen it before saving.",
    );
  const normalized = validate(fields, state, id);
  if (
    current.approvals.some(
      (a) => a.featureId && !normalized.featureIds.includes(a.featureId),
    ) ||
    state.partChanges.some(
      (c) =>
        c.resultPartId === id &&
        c.featureId &&
        !normalized.featureIds.includes(c.featureId),
    )
  )
    throw new Error(
      "Keep links to ECRs/OCRs with recorded revision work. Their source history must be preserved.",
    );
  const changed = (Object.keys(blankPdm()) as (keyof PdmFields)[]).filter(
    (key) => key !== "featureIds" && current[key] !== normalized[key],
  );
  const labels: Record<string, string> = {
    name: "Name",
    description: "Description",
    kind: "Record type",
    purpose: "Use",
    owner: "Owner",
    odooNumber: "Odoo number",
  };
  const events = [
    ...linkEvents(state, current.featureIds, normalized.featureIds, now),
    ...changed.map((key) =>
      event(
        `${labels[key]}: ${current[key] || "Not set"} → ${normalized[key] || "Not set"}`,
        now,
      ),
    ),
  ];
  if (!events.length) return state;
  return {
    ...state,
    pdmItems: state.pdmItems.map((p) =>
      p.id === id
        ? {
            ...p,
            ...normalized,
            revision: p.revision + 1,
            updatedAt: now,
            activity: [...events, ...p.activity],
          }
        : p,
    ),
  };
}
export function validatePdmState(state: AppState) {
  if (state.pdmItems === undefined) state.pdmItems = [];
  if (state.pdmCounter === undefined && state.pdmItems.length === 0)
    state.pdmCounter = 0;
  if (
    !Array.isArray(state.pdmItems) ||
    !Number.isSafeInteger(state.pdmCounter) ||
    state.pdmCounter < 0
  )
    throw new Error("Invalid saved PDM data.");
  const ids = new Set(),
    numbers = new Set(),
    sequences = new Set();
  for (const p of state.pdmItems) {
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      typeof p.creatorInitials !== "string" ||
      !/^[A-Z]{2,5}$/.test(p.creatorInitials) ||
      typeof p.number !== "string" ||
      !new RegExp(`^${p.creatorInitials}-[0-9]{5,}$`).test(p.number) ||
      !Number.isSafeInteger(p.revision) ||
      p.revision < 1 ||
      p.status !== "Draft" ||
      typeof p.workingRevision !== "string" ||
      ![p.createdAt, p.updatedAt].every(
        (d) => typeof d === "string" && Number.isFinite(Date.parse(d)),
      ) ||
      !Array.isArray(p.activity)
    )
      throw new Error("A saved PDM record could not be read.");
    validate(p, state, p.id);
    validateModelRevisions(p);
    validateDrawings(p);
    validateReleases(p);
    const seq = Number(p.number.split("-")[1]);
    if (
      !Number.isSafeInteger(seq) ||
      seq < 1 ||
      seq > state.pdmCounter ||
      ids.has(p.id) ||
      numbers.has(p.number) ||
      sequences.has(seq) ||
      new Set(p.featureIds).size !== p.featureIds.length
    )
      throw new Error("Saved PDM identifiers or links need recovery.");
    ids.add(p.id);
    numbers.add(p.number);
    sequences.add(seq);
    for (const a of p.activity)
      if (
        !a ||
        typeof a.id !== "string" ||
        typeof a.actor !== "string" ||
        typeof a.summary !== "string" ||
        typeof a.at !== "string" ||
        !Number.isFinite(Date.parse(a.at)) ||
        (a.featureId !== undefined &&
          !state.features.some((f) => f.id === a.featureId))
      )
        throw new Error("Saved PDM activity could not be read.");
  }
}
