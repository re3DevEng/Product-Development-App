import type { PdmItem } from "./pdm";
import {
  DRAWING_TYPES,
  drawingApprovalFor,
  drawingRevisionLabel,
  type Drawing,
  type DrawingRequirement,
} from "./drawings";

export function partRevisionLabel(item: PdmItem, revisionId: string) {
  const release = item.releases.find((r) => r.modelRevisionId === revisionId);
  return release
    ? `Part Rev${release.number} · Released`
    : `Part Rev${item.modelRevisions.find((r) => r.id === revisionId)?.label ?? "?"} · In development`;
}

export function drawingSummary(item: PdmItem, revisionId: string) {
  const release = item.releases.find((r) => r.modelRevisionId === revisionId);
  let drawings = item.drawings;
  let requirements = item.drawingRequirements;
  let available = true;
  if (release) {
    // Read the package reviewed at release, never later edits to the live drawings.
    const approval = item.approvals.find((a) => a.id === release.approvalId);
    try {
      const snapshot = JSON.parse(approval?.snapshot ?? "null");
      if (
        !Array.isArray(snapshot?.drawings) ||
        !Array.isArray(snapshot?.requirements)
      )
        throw new Error("No package");
      drawings = snapshot.drawings as Drawing[];
      requirements = snapshot.requirements as DrawingRequirement[];
    } catch {
      available = false;
      drawings = [];
      requirements = [];
    }
  }
  return DRAWING_TYPES.map((type) => {
    const requirement = requirements.find((r) => r.type === type);
    const drawing = drawings.find((d) => d.type === type);
    const approval = drawing
      ? drawingApprovalFor(
          { ...drawing, approvals: drawing.approvals ?? [] },
          revisionId,
        )
      : undefined;
    const version =
      drawing?.versions.find((v) => v.id === approval?.versionId) ??
      [...(drawing?.versions ?? [])]
        .reverse()
        .find((v) => v.modelRevisionId === revisionId);
    const notRequired = requirement?.status === "Not required";
    return {
      type,
      revision: notRequired
        ? "—"
        : approval
          ? `DWG Rev${approval.number}`
          : version
            ? "Unapproved draft"
            : "—",
      status: !available
        ? "Release package unavailable"
        : notRequired
          ? "Not required"
          : approval
            ? approval.kind === "Applicability"
              ? "Approved · reused unchanged"
              : "Approved"
            : release
              ? "No approved drawing recorded"
              : version
                ? "Awaiting approval"
                : "No drawing matched",
      detail: notRequired
        ? requirement.reason
        : requirement?.status === "Not assessed"
          ? "Requirement not assessed"
          : "",
      version:
        version && drawing
          ? drawingRevisionLabel(drawing, version.id)
          : undefined,
    };
  });
}
