import { newId } from "./browser-support";
import {
  parseDriveLink,
  type AppState,
  type Activity,
  type DocumentLink,
  type Priority,
} from "./domain";
export const SOFTWARE_TYPES = ["Change request", "Bug report"] as const;
export const SOFTWARE_STAGES = [
  "Request",
  "In work",
  "Testing",
  "Complete",
] as const;
export const SOFTWARE_STATUSES = [
  "Request",
  "In work",
  "Testing",
  "Complete",
  "Archive",
  "Declined",
  "Cancelled",
] as const;
export type SoftwareStatus = (typeof SOFTWARE_STATUSES)[number];
export type SoftwareFields = {
  title: string;
  description: string;
  type: (typeof SOFTWARE_TYPES)[number];
  priority: Priority;
  owners: string[];
  application: string;
  version: string;
  steps: string;
  expected: string;
  actual: string;
};
export type Software = SoftwareFields & {
  id: string;
  number: string;
  revision: number;
  status: SoftwareStatus;
  resumeStatus: "Request" | "In work" | "Testing";
  createdAt: string;
  updatedAt: string;
  featureLinks: { featureId: string; required: boolean }[];
  systemIds: string[];
  documents: DocumentLink[];
  activity: (Activity & { featureId?: string; systemId?: string })[];
};
export const blankSoftware = (
  type: SoftwareFields["type"] = "Change request",
): SoftwareFields => ({
  title: "",
  description: "",
  type,
  priority: "Medium",
  owners: [],
  application: "",
  version: "",
  steps: "",
  expected: "",
  actual: "",
});
export const softwareProgress = (s: Software) =>
  SOFTWARE_STAGES.some((stage) => stage === s.status)
    ? s.status
    : s.resumeStatus;
const keys = Object.keys(blankSoftware()) as (keyof SoftwareFields)[];
export const softwareFields = (s: Software) =>
  Object.fromEntries(keys.map((k) => [k, s[k]])) as SoftwareFields;
const labels: Record<keyof SoftwareFields, string> = {
  title: "Title",
  description: "Description",
  type: "Type",
  priority: "Priority",
  owners: "Owners",
  application: "Application / component",
  version: "Version",
  steps: "Steps to reproduce",
  expected: "Expected behavior",
  actual: "Actual behavior",
};
function validate(fields: SoftwareFields): SoftwareFields {
  for (const k of keys)
    if (
      k === "owners"
        ? !Array.isArray(fields.owners) ||
          fields.owners.some((v) => typeof v !== "string" || !v.trim())
        : typeof fields[k] !== "string"
    )
      throw new Error("Invalid software details.");
  if (
    !fields.title.trim() ||
    fields.title.trim().length > 140 ||
    !fields.description.trim()
  )
    throw new Error("Add a title (up to 140 characters) and description.");
  if (
    !SOFTWARE_TYPES.includes(fields.type) ||
    !["High", "Medium", "Low"].includes(fields.priority)
  )
    throw new Error("Choose valid software options.");
  return Object.fromEntries(
    keys.map((k) => [
      k,
      k === "owners"
        ? [...new Set(fields.owners)]
        : (fields[k] as string).trim(),
    ]),
  ) as SoftwareFields;
}
const event = (summary: string): Activity => ({
  id: newId(),
  actor: "Demo user",
  at: new Date().toISOString(),
  summary,
});
function current(state: AppState, id: string, revision: number) {
  const s = state.software.find((s) => s.id === id);
  if (!s) throw new Error("This software item is no longer available.");
  if (s.revision !== revision)
    throw new Error(
      "This software item changed elsewhere. Close and reopen it before saving.",
    );
  return s;
}
function replace(
  state: AppState,
  s: Software,
  change: Partial<Software>,
  summary: string,
  ref: { featureId?: string; systemId?: string } = {},
): AppState {
  return {
    ...state,
    software: state.software.map((item) =>
      item.id === s.id
        ? {
            ...s,
            ...change,
            revision: s.revision + 1,
            updatedAt: new Date().toISOString(),
            activity: [{ ...event(summary), ...ref }, ...s.activity],
          }
        : item,
    ),
  };
}
export function createSoftware(
  state: AppState,
  fields: SoftwareFields,
  now = new Date().toISOString(),
) {
  const year = now.slice(0, 4),
    sequence = (state.softwareCounters[year] ?? 0) + 1;
  const item: Software = {
    ...validate(fields),
    id: newId(),
    number: `SW-${year}-${String(sequence).padStart(3, "0")}`,
    revision: 1,
    status: "Request",
    resumeStatus: "Request",
    createdAt: now,
    updatedAt: now,
    featureLinks: [],
    systemIds: [],
    documents: [],
    activity: [{ ...event("Created this software item"), at: now }],
  };
  return {
    item,
    state: {
      ...state,
      softwareCounters: { ...state.softwareCounters, [year]: sequence },
      software: [item, ...state.software],
    },
  };
}
export function updateSoftware(
  state: AppState,
  id: string,
  revision: number,
  fields: SoftwareFields,
) {
  const s = current(state, id, revision),
    next = validate(fields);
  const changes = keys
    .filter((k) => JSON.stringify(next[k]) !== JSON.stringify(s[k]))
    .map(
      (k) =>
        `${labels[k]}: ${String(s[k]) || "Not set"} → ${String(next[k]) || "Not set"}`,
    );
  return changes.length ? replace(state, s, next, changes.join("\n")) : state;
}
export function softwareActions(
  s: Software,
): { label: string; status: SoftwareStatus }[] {
  if (["Complete", "Archive", "Declined", "Cancelled"].includes(s.status))
    return [
      {
        label: "Restore",
        status: s.status === "Complete" ? "In work" : s.resumeStatus,
      },
    ];
  return [
    ...(s.status === "Request"
      ? [{ label: "Start work", status: "In work" as const }]
      : s.status === "In work"
        ? [{ label: "Ready for testing", status: "Testing" as const }]
        : [
            { label: "Return to development", status: "In work" as const },
            { label: "Complete", status: "Complete" as const },
          ]),
    { label: "Archive", status: "Archive" },
    {
      label: s.status === "Request" ? "Decline" : "Cancel work",
      status: s.status === "Request" ? "Declined" : "Cancelled",
    },
  ];
}
export function changeSoftwareStatus(
  state: AppState,
  id: string,
  revision: number,
  status: SoftwareStatus,
) {
  const s = current(state, id, revision);
  if (!softwareActions(s).some((a) => a.status === status))
    throw new Error("Choose an available software action.");
  return replace(
    state,
    s,
    {
      status,
      resumeStatus: ["Request", "In work", "Testing"].includes(s.status)
        ? (s.status as Software["resumeStatus"])
        : s.resumeStatus,
    },
    `Status: ${s.status} → ${status}`,
  );
}
export function softwareDependencies(state: AppState, featureId: string) {
  return state.software.filter(
    (s) =>
      s.status !== "Complete" &&
      s.featureLinks.some((l) => l.featureId === featureId && l.required),
  );
}
export function linkSoftwareFeature(
  state: AppState,
  id: string,
  revision: number,
  featureId: string,
  required: boolean | null,
) {
  const s = current(state, id, revision),
    f = state.features.find((f) => f.id === featureId);
  if (!f) throw new Error("This feature is no longer available.");
  const old = s.featureLinks.find((l) => l.featureId === featureId);
  if ((required === null && !old) || old?.required === required) return state;
  if (required && s.status !== "Complete" && f.status === "Complete")
    throw new Error(
      "Restore this feature before adding unfinished required software.",
    );
  const featureLinks = s.featureLinks.filter((l) => l.featureId !== featureId);
  if (required !== null) featureLinks.push({ featureId, required });
  return replace(
    state,
    s,
    { featureLinks },
    `${required === null ? "Unlinked" : old ? "Updated link to" : "Linked"} feature ${f.number}: ${f.title}${required === null ? "" : required ? " · Required for completion" : " · Related"}`,
    { featureId },
  );
}
export function linkSoftwareSystem(
  state: AppState,
  id: string,
  revision: number,
  systemId: string,
  linked: boolean,
) {
  const s = current(state, id, revision),
    p = state.projects.find((p) => p.id === systemId);
  if (!p) throw new Error("This system is no longer available.");
  if (s.systemIds.includes(systemId) === linked) return state;
  return replace(
    state,
    s,
    {
      systemIds: linked
        ? [...s.systemIds, systemId]
        : s.systemIds.filter((id) => id !== systemId),
    },
    `${linked ? "Linked" : "Unlinked"} system ${p.number}: ${p.title}`,
    { systemId },
  );
}
export function addSoftwareDocument(
  state: AppState,
  id: string,
  revision: number,
  title: string,
  url: string,
) {
  const s = current(state, id, revision),
    link = parseDriveLink(url);
  if (!title.trim()) throw new Error("Give this document a name.");
  if (s.documents.some((d) => d.fileId === link.fileId))
    throw new Error("This file is already linked.");
  return replace(
    state,
    s,
    {
      documents: [
        ...s.documents,
        {
          ...link,
          id: newId(),
          title: title.trim(),
          role: "Supporting file",
        },
      ],
    },
    `Linked document: ${title.trim()}`,
  );
}
export function validateSoftwareState(state: AppState) {
  if (state.software === undefined && state.softwareCounters === undefined) {
    state.software = [];
    state.softwareCounters = {};
  }
  if (
    !Array.isArray(state.software) ||
    !state.softwareCounters ||
    typeof state.softwareCounters !== "object" ||
    Array.isArray(state.softwareCounters) ||
    Object.values(state.softwareCounters).some(
      (n) => !Number.isSafeInteger(n) || n < 0,
    )
  )
    throw new Error("Invalid saved software data.");
  const date = (v: unknown) =>
    typeof v === "string" && Number.isFinite(Date.parse(v));
  for (const s of state.software) {
    // Undo the short-lived engineering review model while retaining all history.
    const legacy = s as Software & { stage?: string };
    if (legacy && legacy.stage !== undefined) {
      if (["ORR", "Final Review"].includes(legacy.stage)) {
        if (s.status === "In work") s.status = "Testing";
        if (s.resumeStatus === "In work") s.resumeStatus = "Testing";
      }
      delete legacy.stage;
    }
    if (
      !s ||
      typeof s.id !== "string" ||
      !s.id ||
      typeof s.number !== "string" ||
      !/^SW-\d{4}-\d{3,}$/.test(s.number) ||
      !Number.isSafeInteger(s.revision) ||
      s.revision < 1 ||
      !SOFTWARE_STATUSES.includes(s.status) ||
      !["Request", "In work", "Testing"].includes(s.resumeStatus) ||
      !date(s.createdAt) ||
      !date(s.updatedAt) ||
      !Array.isArray(s.featureLinks) ||
      !Array.isArray(s.systemIds) ||
      !Array.isArray(s.documents) ||
      !Array.isArray(s.activity)
    )
      throw new Error("A saved software item could not be read.");
    validate(s);
    if (
      s.featureLinks.some(
        (l) =>
          !l ||
          typeof l.required !== "boolean" ||
          !state.features.some((f) => f.id === l.featureId),
      ) ||
      new Set(s.featureLinks.map((l) => l.featureId)).size !==
        s.featureLinks.length ||
      s.systemIds.some((id) => !state.projects.some((p) => p.id === id)) ||
      new Set(s.systemIds).size !== s.systemIds.length
    )
      throw new Error("Invalid software relationships.");
    for (const d of s.documents)
      if (
        !d ||
        typeof d.id !== "string" ||
        typeof d.title !== "string" ||
        d.role !== "Supporting file" ||
        typeof d.url !== "string" ||
        parseDriveLink(d.url).fileId !== d.fileId
      )
        throw new Error("Invalid software document.");
    for (const a of s.activity)
      if (
        !a ||
        typeof a.id !== "string" ||
        typeof a.actor !== "string" ||
        typeof a.summary !== "string" ||
        !date(a.at) ||
        (a.featureId !== undefined &&
          !state.features.some((f) => f.id === a.featureId)) ||
        (a.systemId !== undefined &&
          !state.projects.some((p) => p.id === a.systemId))
      )
        throw new Error("Invalid software activity.");
    const [, year, sequence] = s.number.split("-");
    if ((state.softwareCounters[year] ?? 0) < Number(sequence))
      throw new Error("Software counter needs recovery.");
  }
  if (
    new Set(state.software.map((s) => s.id)).size !== state.software.length ||
    new Set(state.software.map((s) => s.number)).size !== state.software.length
  )
    throw new Error("Software identifiers must be unique.");
}
