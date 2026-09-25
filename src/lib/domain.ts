import { newId } from "./browser-support";
import { validatePdmState, type PdmItem } from "./pdm";
import { validatePartChanges, type PartChange } from "./model-revisions";
import { validateProjectState, type Project } from "./projects";
import {
  validateSoftwareState,
  softwareDependencies,
  type Software,
} from "./software";

export const STATUSES = [
  "Request",
  "In-Work",
  "Complete",
  "Archive",
  "Declined",
  "Cancelled",
] as const;
export const PRIORITIES = ["High", "Medium", "Low"] as const;
export const WORK_TYPES = ["Unassigned", "ECR", "OCR"] as const;
export const STAGES = {
  Unassigned: ["Not started"],
  ECR: ["Not started", "SRR", "PDR", "CDR", "ORR", "Final Review"],
  OCR: ["Not started", "Final Review"],
};
export type Status = (typeof STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type WorkType = (typeof WORK_TYPES)[number];
export type DocumentLink = {
  id: string;
  fileId: string;
  title: string;
  role: "Supporting file" | "ECR" | "OCR";
  url: string;
};
export type Activity = {
  id: string;
  at: string;
  actor: string;
  summary: string;
};
export type FeatureFields = {
  title: string;
  description: string;
  status: Status;
  priority: Priority;
  workType: WorkType;
  stage: string;
  roadmap: boolean;
  owners: string[];
  products: string[];
};
export type Feature = FeatureFields & {
  id: string;
  number: string;
  revision: number;
  hasStarted: boolean;
  createdAt: string;
  updatedAt: string;
  submittedBy: string;
  documents: DocumentLink[];
  activity: Activity[];
};
export type AppState = {
  schema: 1;
  features: Feature[];
  products: string[];
  members: string[];
  counters: Record<string, number>;
  projects: Project[];
  projectCounters: Record<string, number>;
  software: Software[];
  softwareCounters: Record<string, number>;
  pdmItems: PdmItem[];
  pdmCounter: number;
  partChanges: PartChange[];
};
export const isActive = (f: Feature) =>
  f.status === "Request" || f.status === "In-Work";
const ACTOR = "Demo user";
const event = (summary: string, at: string): Activity => ({
  id: newId(),
  at,
  actor: ACTOR,
  summary,
});

export function validateFields(fields: FeatureFields): FeatureFields {
  if (!fields.title.trim()) throw new Error("Give this request a short title.");
  if (fields.title.trim().length > 140)
    throw new Error("Keep the title under 140 characters.");
  if (!fields.description.trim())
    throw new Error("Describe the problem or proposed improvement.");
  if (
    !STATUSES.includes(fields.status) ||
    !PRIORITIES.includes(fields.priority) ||
    !WORK_TYPES.includes(fields.workType)
  )
    throw new Error("Choose valid workflow options.");
  if (!STAGES[fields.workType].includes(fields.stage))
    throw new Error("Choose a review stage for this work type.");
  if (fields.status === "In-Work" && fields.workType === "Unassigned")
    throw new Error("Choose ECR or OCR before starting work.");
  if (!fields.products.length)
    throw new Error("Choose at least one affected product.");
  return {
    title: fields.title.trim(),
    description: fields.description.trim(),
    status: fields.status,
    priority: fields.priority,
    workType: fields.workType,
    stage: fields.stage,
    roadmap: fields.roadmap,
    owners: [...new Set(fields.owners)],
    products: [...new Set(fields.products)],
  };
}

export function createFeature(
  state: AppState,
  input: FeatureFields,
  now = new Date().toISOString(),
): { state: AppState; feature: Feature } {
  const fields = validateFields(input);
  if (fields.status !== "Request" || fields.workType !== "Unassigned")
    throw new Error("New features must begin as unassigned requests.");
  const year = now.slice(0, 4);
  const sequence = (state.counters[year] ?? 0) + 1;
  const number = `${year}-${String(sequence).padStart(3, "0")}`;
  if (state.features.some((f) => f.number === number))
    throw new Error(
      "The feature number is already in use. Restore the sample data or check its counter.",
    );
  const feature: Feature = {
    ...fields,
    id: newId(),
    number,
    revision: 1,
    hasStarted: false,
    createdAt: now,
    updatedAt: now,
    submittedBy: ACTOR,
    documents: [],
    activity: [event("Submitted this request", now)],
  };
  return {
    state: {
      ...state,
      counters: { ...state.counters, [year]: sequence },
      features: [feature, ...state.features],
    },
    feature,
  };
}

export function updateFeature(
  state: AppState,
  id: string,
  revision: number,
  input: FeatureFields,
  now = new Date().toISOString(),
): AppState {
  const current = requireCurrent(state, id, revision);
  if (current.hasStarted && input.status === "Request")
    throw new Error(
      "Work has already started. This feature cannot return to Request.",
    );
  if (current.hasStarted && input.workType === "Unassigned")
    throw new Error("Work has already started. Keep an ECR or OCR work type.");
  const next = validateFields({
    ...input,
    status:
      input.status === "Request" &&
      input.workType !== "Unassigned" &&
      current.workType === "Unassigned"
        ? "In-Work"
        : input.status,
  });
  const hasStarted = current.hasStarted || next.workType !== "Unassigned";
  if (
    next.status === "Complete" &&
    current.status !== "Complete" &&
    softwareDependencies(state, id).length
  )
    throw new Error(
      "Complete the required software first, or explicitly change its link to Related before completing this feature.",
    );
  if (hasStarted && next.status === "Declined")
    throw new Error("Work has already started. Use Cancel instead of Decline.");
  if (
    !hasStarted &&
    (next.status === "Cancelled" || next.status === "Complete")
  )
    throw new Error(
      "Start work before completing or cancelling a feature. Use Decline for a request.",
    );
  const changes: string[] = [];
  const labels: Record<keyof FeatureFields, string> = {
    title: "Title",
    description: "Description",
    status: "Status",
    priority: "Priority",
    workType: "Work type",
    stage: "Review stage",
    roadmap: "Roadmap",
    owners: "Owners",
    products: "Products",
  };
  const display = (value: unknown) =>
    Array.isArray(value)
      ? value.join(", ") || "None"
      : typeof value === "boolean"
        ? value
          ? "Included"
          : "Not included"
        : String(value);
  for (const key of Object.keys(labels) as (keyof FeatureFields)[]) {
    if (JSON.stringify(current[key]) !== JSON.stringify(next[key]))
      changes.push(
        `${labels[key]}: ${display(current[key])} → ${display(next[key])}`,
      );
  }
  if (!changes.length) return state;
  return replace(state, {
    ...current,
    ...next,
    hasStarted,
    revision: current.revision + 1,
    updatedAt: now,
    activity: [event(changes.join("\n"), now), ...current.activity],
  });
}

export function deleteFeature(
  state: AppState,
  id: string,
  revision: number,
  confirmation: string,
): AppState {
  const current = requireCurrent(state, id, revision);
  if (confirmation.trim() !== current.number)
    throw new Error(
      "Type the feature number exactly to confirm permanent deletion.",
    );
  // The number counter stays monotonic; no deleted record or deletion event is retained.
  return {
    ...state,
    features: state.features.filter((f) => f.id !== id),
    partChanges: state.partChanges.map((c) =>
      c.featureId === id ? { ...c, featureId: null } : c,
    ),
    pdmItems: state.pdmItems.map((p) => {
      const featureIds = p.featureIds.filter((featureId) => featureId !== id);
      const activity = p.activity.filter((a) => a.featureId !== id);
      return featureIds.length !== p.featureIds.length ||
        activity.length !== p.activity.length
        ? {
            ...p,
            featureIds,
            activity,
            approvals: p.approvals.map((a) =>
              a.featureId === id ? { ...a, featureId: null } : a,
            ),
            releases: p.releases.map((r) =>
              r.featureId === id ? { ...r, featureId: null } : r,
            ),
            revision: p.revision + 1,
          }
        : p;
    }),
    software: state.software.map((s) => {
      const featureLinks = s.featureLinks.filter((l) => l.featureId !== id);
      const activity = s.activity.filter((a) => a.featureId !== id);
      return featureLinks.length !== s.featureLinks.length ||
        activity.length !== s.activity.length
        ? { ...s, featureLinks, activity, revision: s.revision + 1 }
        : s;
    }),
    projects: state.projects.map((p) => {
      const activity = p.activity.filter((a) => a.featureId !== id);
      const featureIds = p.featureIds.filter((featureId) => featureId !== id);
      return activity.length !== p.activity.length ||
        featureIds.length !== p.featureIds.length
        ? { ...p, activity, featureIds, revision: p.revision + 1 }
        : p;
    }),
  };
}

function requireCurrent(state: AppState, id: string, revision: number) {
  const current = state.features.find((f) => f.id === id);
  if (!current)
    throw new Error(
      "This feature is no longer available. Close it and refresh the list.",
    );
  if (current.revision !== revision)
    throw new Error(
      "This feature changed in another tab. Close and reopen it to review the latest version before saving.",
    );
  return current;
}
function replace(state: AppState, feature: Feature): AppState {
  return {
    ...state,
    features: state.features.map((f) => (f.id === feature.id ? feature : f)),
  };
}

export function parseDriveLink(raw: string): { fileId: string; url: string } {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new Error("Paste a complete Google Drive or Google Docs file link.");
  }
  if (
    url.protocol !== "https:" ||
    !["drive.google.com", "docs.google.com"].includes(url.hostname) ||
    url.username ||
    url.password ||
    url.port
  )
    throw new Error("Use a secure Google Drive or Google Docs link.");
  const id =
    url.pathname.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] ??
    (url.pathname === "/open" ? url.searchParams.get("id") : null);
  if (!id || !/^[a-zA-Z0-9_-]{10,}$/.test(id))
    throw new Error(
      "Use a link to an individual file, not a folder or Google Drive home page.",
    );
  return { fileId: id, url: `https://drive.google.com/file/d/${id}/view` };
}

export function addDocument(
  state: AppState,
  id: string,
  revision: number,
  title: string,
  role: DocumentLink["role"],
  raw: string,
): AppState {
  const current = requireCurrent(state, id, revision);
  if (!title.trim()) throw new Error("Give this document a name.");
  const link = parseDriveLink(raw);
  if (current.documents.some((d) => d.fileId === link.fileId))
    throw new Error("This file is already linked to this feature.");
  const now = new Date().toISOString();
  return replace(state, {
    ...current,
    revision: current.revision + 1,
    updatedAt: now,
    documents: [
      ...current.documents,
      { ...link, id: newId(), title: title.trim(), role },
    ],
    activity: [
      event(`Linked ${role}: ${title.trim()}`, now),
      ...current.activity,
    ],
  });
}

export function readState(raw: string): AppState {
  const value = JSON.parse(raw) as AppState;
  const strings = (a: unknown): a is string[] =>
    Array.isArray(a) && a.every((v) => typeof v === "string");
  const date = (s: unknown) =>
    typeof s === "string" && Number.isFinite(Date.parse(s));
  if (
    !value ||
    value.schema !== 1 ||
    !Array.isArray(value.features) ||
    !strings(value.products) ||
    !strings(value.members) ||
    !value.counters ||
    typeof value.counters !== "object" ||
    Array.isArray(value.counters) ||
    Object.values(value.counters).some((n) => !Number.isSafeInteger(n) || n < 0)
  )
    throw new Error("Unsupported saved sample data.");
  for (const f of value.features) {
    if (
      !f ||
      typeof f.id !== "string" ||
      typeof f.number !== "string" ||
      !/^\d{4}-\d{3,}$/.test(f.number) ||
      !Number.isSafeInteger(f.revision) ||
      f.revision < 1 ||
      !date(f.createdAt) ||
      !date(f.updatedAt) ||
      typeof f.submittedBy !== "string" ||
      typeof f.title !== "string" ||
      typeof f.description !== "string" ||
      typeof f.roadmap !== "boolean" ||
      !strings(f.owners) ||
      !strings(f.products) ||
      !Array.isArray(f.documents) ||
      !Array.isArray(f.activity)
    )
      throw new Error("A saved sample record could not be read.");
    for (const d of f.documents) {
      if (
        !d ||
        typeof d.id !== "string" ||
        typeof d.title !== "string" ||
        !["ECR", "OCR", "Supporting file"].includes(d.role) ||
        typeof d.url !== "string" ||
        parseDriveLink(d.url).fileId !== d.fileId
      )
        throw new Error("A saved document link could not be read.");
    }
    for (const a of f.activity)
      if (
        !a ||
        typeof a.id !== "string" ||
        typeof a.actor !== "string" ||
        typeof a.summary !== "string" ||
        !date(a.at)
      )
        throw new Error("Saved activity could not be read.");
    // Upgrade existing browser samples in place, without resetting user-created data.
    if (f.hasStarted === undefined) {
      f.hasStarted =
        f.workType !== "Unassigned" ||
        ["In-Work", "Complete", "Cancelled"].includes(f.status) ||
        f.activity.some((a) => /Status: [^\n]*\bIn-Work\b/.test(a.summary));
      if (f.hasStarted && f.status === "Request") {
        f.status = "In-Work";
        if (f.workType === "Unassigned") {
          const change = f.activity
            .map((a) =>
              a.summary.match(
                /Work type: (Unassigned|ECR|OCR) → (Unassigned|ECR|OCR)/,
              ),
            )
            .find(Boolean);
          const recovered =
            change?.[2] !== "Unassigned" ? change?.[2] : change?.[1];
          if (recovered === "ECR" || recovered === "OCR")
            f.workType = recovered;
        }
      }
    }
    if (typeof f.hasStarted !== "boolean")
      throw new Error("Invalid saved work-start state.");
    if (f.hasStarted && f.status === "Request")
      throw new Error("Started work cannot be a request.");
    // Legacy work with missing classification remains In-Work and must choose ECR/OCR before editing.
    validateFields(
      f.hasStarted && f.workType === "Unassigned" && f.status === "In-Work"
        ? { ...f, status: "Request" }
        : f,
    );
    const [year, seq] = f.number.split("-");
    if ((value.counters[year] ?? 0) < Number(seq))
      throw new Error("The saved feature counter needs recovery.");
  }
  if (
    new Set(value.features.map((f) => f.id)).size !== value.features.length ||
    new Set(value.features.map((f) => f.number)).size !== value.features.length
  )
    throw new Error("Saved feature identifiers must be unique.");
  validateProjectState(value);
  validateSoftwareState(value);
  validatePdmState(value);
  validatePartChanges(value);
  return value;
}
