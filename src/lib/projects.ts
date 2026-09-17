import {
  parseDriveLink,
  type AppState,
  type Activity,
  type Priority,
  type DocumentLink,
} from "./domain";

export const PRODUCT_FAMILIES: readonly string[] = [
  "Gigabot",
  "Gigabot X",
  "Terabot",
  "Terabot X",
];

export const PROJECT_TYPES = [
  "Machine development",
  "Custom customer machine",
] as const;
export const PROJECT_PHASES = {
  "Machine development": [
    "Requirements",
    "Design",
    "Prototype",
    "Validation",
    "Release readiness",
  ],
  "Custom customer machine": [
    "Requirements",
    "Design",
    "Build",
    "Acceptance testing",
    "Delivery readiness",
  ],
};
export const PROJECT_STATUSES = [
  "In work",
  "Archive",
  "Complete",
  "Cancelled",
] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type ProjectFields = {
  title: string;
  description: string;
  type: (typeof PROJECT_TYPES)[number];
  priority: Priority;
  owners: string[];
  product: string;
  version: string;
  customer: string;
  orderReference: string;
  targetDate: string;
  phase: string;
};
export type ProjectActivity = Activity & { featureId?: string };
export type Project = ProjectFields & {
  id: string;
  number: string;
  revision: number;
  status: ProjectStatus;
  resumeStatus: "In work";
  createdAt: string;
  updatedAt: string;
  featureIds: string[];
  activity: ProjectActivity[];
  documents: DocumentLink[];
};
const labels: Record<keyof ProjectFields, string> = {
  title: "Title",
  description: "Description",
  type: "System type",
  priority: "Priority",
  owners: "Owners",
  product: "Product / base machine",
  version: "Version",
  customer: "Customer",
  orderReference: "Order reference",
  targetDate: "Target date",
  phase: "Phase",
};
const event = (
  summary: string,
  at: string,
  featureId?: string,
): ProjectActivity => ({
  id: crypto.randomUUID(),
  actor: "Demo user",
  summary,
  at,
  ...(featureId ? { featureId } : {}),
});
export const blankProject = (): ProjectFields => ({
  title: "",
  description: "",
  type: "Machine development",
  priority: "Medium",
  owners: [],
  product: "",
  version: "",
  customer: "",
  orderReference: "",
  targetDate: "",
  phase: "Requirements",
});
export function projectFields(project: Project): ProjectFields {
  return Object.fromEntries(
    Object.keys(labels).map((key) => [
      key,
      project[key as keyof ProjectFields],
    ]),
  ) as ProjectFields;
}
export function validateProject(input: ProjectFields): ProjectFields {
  for (const key of Object.keys(labels) as (keyof ProjectFields)[]) {
    if (key === "owners") {
      if (
        !Array.isArray(input.owners) ||
        input.owners.some((v) => typeof v !== "string" || !v.trim())
      )
        throw new Error("Choose valid system owners.");
    } else if (typeof input[key] !== "string")
      throw new Error("Invalid system details.");
  }
  if (!input.title.trim() || input.title.trim().length > 140)
    throw new Error("Give the system a title of up to 140 characters.");
  if (!input.description.trim())
    throw new Error("Describe the system objective.");
  if (
    !PROJECT_TYPES.includes(input.type) ||
    !["High", "Medium", "Low"].includes(input.priority) ||
    !PROJECT_PHASES[input.type].includes(input.phase)
  )
    throw new Error("Choose valid system options.");
  if (!input.product.trim())
    throw new Error("Enter the product or base machine.");
  if (input.type === "Custom customer machine" && !input.customer.trim())
    throw new Error("Enter the customer or company name.");
  if (
    input.targetDate &&
    (!/^\d{4}-\d{2}-\d{2}$/.test(input.targetDate) ||
      !Number.isFinite(Date.parse(input.targetDate)) ||
      new Date(input.targetDate).toISOString().slice(0, 10) !==
        input.targetDate)
  )
    throw new Error("Choose a valid target date.");
  return Object.fromEntries(
    Object.keys(labels).map((key) => [
      key,
      key === "owners"
        ? [...new Set(input.owners)]
        : (input[key as keyof ProjectFields] as string).trim(),
    ]),
  ) as ProjectFields;
}
function currentProject(state: AppState, id: string, revision: number) {
  const project = state.projects.find((p) => p.id === id);
  if (!project)
    throw new Error("This system is no longer available. Close and reopen it.");
  if (project.revision !== revision)
    throw new Error(
      "This system changed in another tab. Discard your edits or close and reopen it to load the latest version.",
    );
  return project;
}
function replace(
  state: AppState,
  project: Project,
  changes: Partial<Project>,
  summary: string,
  featureId?: string,
): AppState {
  const now = new Date().toISOString();
  const next = {
    ...project,
    ...changes,
    revision: project.revision + 1,
    updatedAt: now,
    activity: [event(summary, now, featureId), ...project.activity],
  };
  return {
    ...state,
    projects: state.projects.map((p) => (p.id === project.id ? next : p)),
  };
}
export function createProject(
  state: AppState,
  input: ProjectFields,
  now = new Date().toISOString(),
) {
  const fields = validateProject(input);
  const year = now.slice(0, 4);
  const sequence = (state.projectCounters[year] ?? 0) + 1;
  const number = `SYS-${year}-${String(sequence).padStart(3, "0")}`;
  if (state.projects.some((p) => p.number === number))
    throw new Error("The system number is already in use.");
  const project: Project = {
    ...fields,
    id: crypto.randomUUID(),
    number,
    revision: 1,
    status: "In work",
    resumeStatus: "In work",
    createdAt: now,
    updatedAt: now,
    featureIds: [],
    activity: [event("Created this system", now)],
    documents: [],
  };
  return {
    project,
    state: {
      ...state,
      projects: [project, ...state.projects],
      projectCounters: { ...state.projectCounters, [year]: sequence },
    },
  };
}
export function updateProject(
  state: AppState,
  id: string,
  revision: number,
  input: ProjectFields,
): AppState {
  const current = currentProject(state, id, revision);
  const next = validateProject(input);
  // Type is stable after creation so phase and customer context cannot be silently discarded.
  if (next.type !== current.type)
    throw new Error("System type cannot change after creation.");
  const display = (v: string | string[]) =>
    (Array.isArray(v) ? v.join(", ") : v) || "Not set";
  const changes = (Object.keys(labels) as (keyof ProjectFields)[])
    .filter((key) => JSON.stringify(current[key]) !== JSON.stringify(next[key]))
    .map(
      (key) =>
        `${labels[key]}: ${display(current[key])} → ${display(next[key])}`,
    );
  return changes.length
    ? replace(state, current, next, changes.join("\n"))
    : state;
}
export function projectActions(
  project: Project,
): { label: string; status: ProjectStatus }[] {
  if (project.status === "Complete")
    return [{ label: "Restore", status: "In work" }];
  if (project.status === "Cancelled" || project.status === "Archive")
    return [{ label: "Restore", status: project.resumeStatus }];
  return [
    { label: "Complete", status: "Complete" },
    { label: "Archive", status: "Archive" },
    { label: "Cancel system", status: "Cancelled" },
  ];
}
export function changeProjectStatus(
  state: AppState,
  id: string,
  revision: number,
  status: ProjectStatus,
  note = "",
): AppState {
  const current = currentProject(state, id, revision);
  if (!projectActions(current).some((a) => a.status === status))
    throw new Error("Choose an available system action.");
  const unresolved = current.featureIds.filter(
    (id) => state.features.find((f) => f.id === id)?.status !== "Complete",
  ).length;
  if (status === "Complete" && unresolved && !note.trim())
    throw new Error(
      "Add a summary or reason for completing with unresolved linked features.",
    );
  return replace(
    state,
    current,
    {
      status,
      resumeStatus: "In work",
    },
    `Status: ${current.status} → ${status}${note.trim() ? `\n${note.trim()}` : ""}${status === "Complete" && unresolved ? `\nCompleted with ${unresolved} linked feature(s) not marked Complete.` : ""}`,
  );
}
export function deleteProject(
  state: AppState,
  id: string,
  revision: number,
  confirmation: string,
): AppState {
  const current = currentProject(state, id, revision);
  if (confirmation.trim() !== current.number)
    throw new Error(
      "Type the system number exactly to confirm permanent deletion.",
    );
  // Features and their history are independent; counters prevent number reuse.
  return { ...state, projects: state.projects.filter((p) => p.id !== id), software: state.software.map(s => {
    const systemIds = s.systemIds.filter(systemId => systemId !== id);
    const activity = s.activity.filter(a => a.systemId !== id);
    return systemIds.length !== s.systemIds.length || activity.length !== s.activity.length ? { ...s, systemIds, activity, revision: s.revision + 1 } : s;
  }) };
}
export function linkProjectFeature(
  state: AppState,
  id: string,
  revision: number,
  featureId: string,
  linked: boolean,
): AppState {
  const current = currentProject(state, id, revision);
  const feature = state.features.find((f) => f.id === featureId);
  if (!feature) throw new Error("This feature is no longer available.");
  if (current.featureIds.includes(featureId) === linked) return state;
  return replace(
    state,
    current,
    {
      featureIds: linked
        ? [...current.featureIds, featureId]
        : current.featureIds.filter((id) => id !== featureId),
    },
    `${linked ? "Linked" : "Unlinked"} feature ${feature.number}: ${feature.title}`,
    featureId,
  );
}

export function addProjectDocument(
  state: AppState,
  id: string,
  revision: number,
  title: string,
  raw: string,
): AppState {
  const current = currentProject(state, id, revision);
  if (!title.trim()) throw new Error("Give this document a name.");
  const link = parseDriveLink(raw);
  if (current.documents.some((d) => d.fileId === link.fileId))
    throw new Error("This file is already linked to this system.");
  return replace(
    state,
    current,
    {
      documents: [
        ...current.documents,
        {
          ...link,
          id: crypto.randomUUID(),
          title: title.trim(),
          role: "Supporting file",
        },
      ],
    },
    `Linked document: ${title.trim()}`,
  );
}

export function validateProjectState(state: AppState) {
  // Additive migration for browser data saved before Projects existed.
  if (state.projects === undefined && state.projectCounters === undefined) {
    state.projects = [];
    state.projectCounters = {};
  }
  if (
    !Array.isArray(state.projects) ||
    !state.projectCounters ||
    typeof state.projectCounters !== "object" ||
    Array.isArray(state.projectCounters) ||
    Object.values(state.projectCounters).some(
      (v) => !Number.isSafeInteger(v) || v < 0,
    )
  )
    throw new Error("Invalid saved systems.");
  const date = (v: unknown) =>
    typeof v === "string" && Number.isFinite(Date.parse(v));
  for (const p of state.projects) {
    if (
      p &&
      typeof p.number === "string" &&
      /^PRJ-\d{4}-\d{3,}$/.test(p.number)
    ) {
      p.number = p.number.replace(/^PRJ-/, "SYS-");
    }
    if (p && p.documents === undefined) p.documents = [];
    // Preserve saved held projects and their activity when adopting Archive.
    if (p && (p.status as string) === "On hold") p.status = "Archive";
    if (p && (p.status as string) === "Planning") p.status = "In work";
    if (p && (p.resumeStatus as string) === "Planning")
      p.resumeStatus = "In work";
    if (
      !p ||
      typeof p.id !== "string" ||
      !p.id ||
      typeof p.number !== "string" ||
      !/^SYS-\d{4}-\d{3,}$/.test(p.number) ||
      !Number.isSafeInteger(p.revision) ||
      p.revision < 1 ||
      !PROJECT_STATUSES.includes(p.status) ||
      p.resumeStatus !== "In work" ||
      !date(p.createdAt) ||
      !date(p.updatedAt) ||
      !Array.isArray(p.featureIds) ||
      new Set(p.featureIds).size !== p.featureIds.length ||
      p.featureIds.some((id) => !state.features.some((f) => f.id === id)) ||
      !Array.isArray(p.activity)
    )
      throw new Error("A saved system could not be read.");
    validateProject(p);
    if (!Array.isArray(p.documents))
      throw new Error("System documents could not be read.");
    for (const d of p.documents) {
      if (
        !d ||
        typeof d.id !== "string" ||
        typeof d.title !== "string" ||
        !d.title.trim() ||
        d.role !== "Supporting file" ||
        typeof d.url !== "string" ||
        parseDriveLink(d.url).fileId !== d.fileId
      )
        throw new Error("A saved system document link could not be read.");
    }
    if (new Set(p.documents.map((d) => d.fileId)).size !== p.documents.length)
      throw new Error("System document links must be unique.");
    const [, year, seq] = p.number.split("-");
    if ((state.projectCounters[year] ?? 0) < Number(seq))
      throw new Error("The system counter needs recovery.");
    for (const a of p.activity)
      if (
        !a ||
        typeof a.id !== "string" ||
        typeof a.actor !== "string" ||
        typeof a.summary !== "string" ||
        !date(a.at) ||
        (a.featureId !== undefined &&
          !state.features.some((f) => f.id === a.featureId))
      )
        throw new Error("System activity could not be read.");
  }
  if (
    new Set(state.projects.map((p) => p.id)).size !== state.projects.length ||
    new Set(state.projects.map((p) => p.number)).size !== state.projects.length
  )
    throw new Error("System identifiers must be unique.");
}
