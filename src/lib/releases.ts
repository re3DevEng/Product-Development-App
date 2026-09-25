import { newId } from "./browser-support";
import type { AppState } from "./domain";
import type { PdmItem } from "./pdm";
import { drawingReleaseIssues } from "./drawings";

export type EngineeringApproval = {
  id: string;
  modelRevisionId: string;
  featureId: string | null;
  reviewedReleaseId: string | null;
  snapshot: string;
  participants: string;
  meetingDate: string;
  notes: string;
  differenceDecision: string;
  differenceNotes: string;
  systemIds: string[];
  opsNotes: string;
  at: string;
};
export type PartRelease = {
  id: string;
  number: number;
  modelRevisionId: string;
  approvalId: string;
  featureId: string | null;
  systemIds: string[];
  odooNumber: string;
  releasedBy: string;
  at: string;
};
export const latestRelease = (p: PdmItem) => p.releases?.at(-1);
export function nextWorkingLabel(p: PdmItem) {
  const major = latestRelease(p)?.number ?? 0;
  const steps = p.modelRevisions
    .filter((r) => r.label.startsWith(`${major}.`))
    .map((r) => Number(r.label.split(".")[1]));
  return `${major}.${Math.max(0, ...steps) + 1}`;
}
export function newerRelease(p: PdmItem, revisionId: string) {
  const latest = latestRelease(p);
  if (!latest || p.releases.some((r) => r.modelRevisionId === revisionId))
    return undefined;
  const visited = new Set<string>();
  let id: string | undefined = revisionId;
  while (id && !visited.has(id)) {
    if (id === latest.modelRevisionId) return undefined;
    visited.add(id);
    const r = p.modelRevisions.find((r) => r.id === id);
    id = r?.source?.partId === p.id ? r.source.revisionId : undefined;
  }
  return latest;
}
function targets(
  state: AppState,
  p: PdmItem,
  revisionId: string,
  featureId: string,
) {
  return (
    state.partChanges.find(
      (c) =>
        c.resultPartId === p.id &&
        c.resultRevisionId === revisionId &&
        c.featureId === featureId,
    )?.systemIds ?? []
  );
}
function snapshot(
  state: AppState,
  p: PdmItem,
  revisionId: string,
  featureId: string,
) {
  return JSON.stringify({
    name: p.name,
    kind: p.kind,
    purpose: p.purpose,
    odooNumber: p.odooNumber,
    model: p.modelRevisions.find((r) => r.id === revisionId),
    drawings: p.drawings,
    requirements: p.drawingRequirements,
    systems: targets(state, p, revisionId, featureId),
  });
}
function eligible(
  state: AppState,
  partId: string,
  recordRevision: number,
  revisionId: string,
  featureId: string,
) {
  const p = state.pdmItems.find((p) => p.id === partId);
  if (!p || p.revision !== recordRevision)
    throw new Error("The part changed. Close and reopen this form.");
  if (
    !state.features.some(
      (f) =>
        f.id === featureId &&
        f.status === "In-Work" &&
        f.workType !== "Unassigned",
    ) ||
    !p.featureIds.includes(featureId)
  )
    throw new Error("Use an active linked ECR/OCR.");
  const changes = state.partChanges.filter(
    (c) => c.resultPartId === partId && c.featureId === featureId,
  );
  const last = [...p.modelRevisions]
    .reverse()
    .find((r) => changes.some((c) => c.resultRevisionId === r.id));
  if (revisionId !== (last?.id ?? p.modelRevisions[0].id))
    throw new Error("Approve the latest revision in this ECR/OCR.");
  if (p.releases.some((r) => r.modelRevisionId === revisionId))
    throw new Error("This revision is already released.");
  if (p.purpose === "Production" && !p.odooNumber)
    throw new Error("Ops must assign an Odoo number before approval.");
  return p;
}
function log(
  state: AppState,
  p: PdmItem,
  featureId: string,
  summary: string,
  at: string,
) {
  const event = { id: newId(), actor: "Demo user", summary, at };
  return {
    ...state,
    pdmItems: state.pdmItems.map((item) =>
      item.id === p.id
        ? {
            ...p,
            revision: p.revision + 1,
            updatedAt: at,
            activity: [{ ...event, featureId }, ...p.activity],
          }
        : item,
    ),
    features: state.features.map((f) =>
      f.id === featureId
        ? {
            ...f,
            revision: f.revision + 1,
            updatedAt: at,
            activity: [event, ...f.activity],
          }
        : f,
    ),
  };
}
export type ApprovalInput = {
  partId: string;
  recordRevision: number;
  revisionId: string;
  featureId: string;
  participants: string;
  meetingDate: string;
  notes: string;
  differenceDecision: string;
  differenceNotes: string;
  systemIds: string[];
  opsNotes: string;
};
export function approvePart(
  state: AppState,
  input: ApprovalInput,
  at = new Date().toISOString(),
) {
  const p = eligible(
    state,
    input.partId,
    input.recordRevision,
    input.revisionId,
    input.featureId,
  );
  if (
    !Array.isArray(input.systemIds) ||
    !input.systemIds.length ||
    new Set(input.systemIds).size !== input.systemIds.length ||
    input.systemIds.some(
      (id) =>
        !state.projects.some((s) => s.id === id && s.status === "In work"),
    )
  )
    throw new Error("Choose the intended active systems for this release.");
  if (
    typeof input.opsNotes !== "string" ||
    !input.opsNotes.trim() ||
    input.opsNotes.length > 2000
  )
    throw new Error(
      "Record Ops' numbering decision, or explain use of an internal R&D number.",
    );
  if (
    ![input.participants, input.notes].every(
      (s) => typeof s === "string" && s.trim() && s.length <= 2000,
    ) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(input.meetingDate) ||
    !Number.isFinite(Date.parse(input.meetingDate))
  )
    throw new Error(
      "Enter the meeting date, participants, and Engineering approval notes.",
    );
  if (
    newerRelease(p, input.revisionId) &&
    (![
      "Incorporated released changes",
      "Proceed with intentional differences",
    ].includes(input.differenceDecision) ||
      !input.differenceNotes.trim() ||
      input.differenceNotes.length > 2000)
  )
    throw new Error(
      "Record Engineering's review of the newer release before approval. For an independent design, create a variant instead.",
    );
  const approval: EngineeringApproval = {
    id: newId(),
    modelRevisionId: input.revisionId,
    featureId: input.featureId,
    reviewedReleaseId: latestRelease(p)?.id ?? null,
    snapshot: snapshot(state, p, input.revisionId, input.featureId),
    participants: input.participants.trim(),
    meetingDate: input.meetingDate,
    notes: input.notes.trim(),
    differenceDecision: newerRelease(p, input.revisionId)
      ? input.differenceDecision
      : "",
    differenceNotes: newerRelease(p, input.revisionId)
      ? input.differenceNotes.trim()
      : "",
    systemIds: [...input.systemIds],
    opsNotes: input.opsNotes.trim(),
    at,
  };
  return log(
    state,
    { ...p, approvals: [...p.approvals, approval] },
    input.featureId,
    `Engineering approval recorded for ${p.number} working Rev${p.modelRevisions.find((r) => r.id === input.revisionId)!.label} (prototype).`,
    at,
  );
}
export function currentApproval(
  state: AppState,
  p: PdmItem,
  revisionId: string,
  featureId: string,
) {
  return [...p.approvals]
    .reverse()
    .find(
      (a) =>
        a.modelRevisionId === revisionId &&
        a.featureId === featureId &&
        a.reviewedReleaseId === (latestRelease(p)?.id ?? null) &&
        a.systemIds.every((id) =>
          state.projects.some((s) => s.id === id && s.status === "In work"),
        ) &&
        a.snapshot === snapshot(state, p, revisionId, featureId),
    );
}
export function releasePart(
  state: AppState,
  input: {
    partId: string;
    recordRevision: number;
    revisionId: string;
    featureId: string;
    releasedBy: string;
    authorized: boolean;
  },
  at = new Date().toISOString(),
) {
  const p = eligible(
    state,
    input.partId,
    input.recordRevision,
    input.revisionId,
    input.featureId,
  );
  const approval = currentApproval(state, p, input.revisionId, input.featureId);
  if (!approval)
    throw new Error(
      "Engineering approval is missing or outdated. Review the current revision and latest release again.",
    );
  const drawingIssues = drawingReleaseIssues(p, input.revisionId);
  if (drawingIssues.length)
    throw new Error(
      `Drawings are not ready for release. ${drawingIssues.join(" ")}`,
    );
  if (
    input.authorized !== true ||
    !input.releasedBy.trim() ||
    input.releasedBy.length > 180
  )
    throw new Error(
      "Record the release person's name and confirm authorization.",
    );
  const release: PartRelease = {
    id: newId(),
    number: p.releases.length + 1,
    modelRevisionId: input.revisionId,
    approvalId: approval.id,
    featureId: input.featureId,
    systemIds: [...approval.systemIds],
    odooNumber: p.odooNumber,
    releasedBy: input.releasedBy.trim(),
    at,
  };
  return log(
    state,
    { ...p, releases: [...p.releases, release] },
    input.featureId,
    `Recorded prototype release: ${p.number} Rev${release.number}. No CAD files published.`,
    at,
  );
}
export function validateReleases(p: PdmItem) {
  if (p.approvals === undefined) p.approvals = [];
  if (p.releases === undefined) p.releases = [];
  if (!Array.isArray(p.approvals) || !Array.isArray(p.releases))
    throw new Error("Invalid release history.");
  const text = (v: unknown) => typeof v === "string" && !!v.trim();
  const date = (v: unknown) =>
    text(v) && Number.isFinite(Date.parse(v as string));
  const ids = new Set<string>();
  for (const a of p.approvals) {
    if (
      !a ||
      !text(a.id) ||
      ids.has(a.id) ||
      !p.modelRevisions.some((r) => r.id === a.modelRevisionId) ||
      !(a.featureId === null || text(a.featureId)) ||
      !(a.reviewedReleaseId === null || text(a.reviewedReleaseId)) ||
      ![a.snapshot, a.participants, a.notes].every(text) ||
      !date(a.meetingDate) ||
      !date(a.at) ||
      typeof a.differenceDecision !== "string" ||
      typeof a.differenceNotes !== "string"
    )
      throw new Error("Invalid Engineering approval history.");
    if (
      !Array.isArray(a.systemIds) ||
      !a.systemIds.length ||
      !a.systemIds.every(text) ||
      new Set(a.systemIds).size !== a.systemIds.length ||
      !text(a.opsNotes)
    )
      throw new Error("Invalid approval targets or Ops decision.");
    ids.add(a.id);
  }
  const models = new Set<string>();
  p.releases.forEach((r, index) => {
    const a = p.approvals.find((a) => a.id === r.approvalId);
    if (
      !r ||
      !text(r.id) ||
      ids.has(r.id) ||
      r.number !== index + 1 ||
      models.has(r.modelRevisionId) ||
      !a ||
      a.modelRevisionId !== r.modelRevisionId ||
      a.featureId !== r.featureId ||
      a.reviewedReleaseId !== (p.releases[index - 1]?.id ?? null) ||
      !Array.isArray(r.systemIds) ||
      !r.systemIds.every(text) ||
      JSON.stringify(r.systemIds) !== JSON.stringify(a.systemIds) ||
      typeof r.odooNumber !== "string" ||
      !text(r.releasedBy) ||
      !date(r.at)
    )
      throw new Error("Invalid part release history.");
    ids.add(r.id);
    models.add(r.modelRevisionId);
  });
  if (
    p.approvals.some(
      (a) =>
        a.reviewedReleaseId !== null &&
        !p.releases.some((r) => r.id === a.reviewedReleaseId),
    )
  )
    throw new Error("Approval references a missing release.");
}
