import { createFeature, updateFeature, type AppState } from "./domain";
import { blankProject, createProject } from "./projects";
import { blankPdm, createPdmForChange } from "./pdm";
import {
  addDrawing,
  addDrawingVersion,
  approveDrawing,
  setDrawingRequirements,
  type DrawingType,
} from "./drawings";
import { approvePart, releasePart } from "./releases";
import { startPartChange } from "./part-changes";

export const PDM_EXAMPLE_MARKER =
  "Illustrative drawing workflow examples v1. No real CAD or production approvals.";
export function hasPdmExamples(s: AppState) {
  return s.projects.some((p) => p.description === PDM_EXAMPLE_MARKER);
}
export function addPdmExamples(initial: AppState): AppState {
  if (hasPdmExamples(initial)) return initial;
  const project = createProject(initial, {
    ...blankProject(),
    title: "Sample — Drawing workflow demonstration",
    description: PDM_EXAMPLE_MARKER,
    product: "Gigabot",
  });
  let s = project.state;
  function feature(title: string, type: "ECR" | "OCR") {
    const made = createFeature(s, {
      title: `Sample — ${title}`,
      description: PDM_EXAMPLE_MARKER,
      status: "Request",
      workType: "Unassigned",
      stage: "Not started",
      priority: "Medium",
      roadmap: false,
      owners: [],
      products: [s.products[0] ?? "All products"],
    });
    s = updateFeature(made.state, made.feature.id, made.feature.revision, {
      ...made.feature,
      workType: type,
      status: "In-Work",
    });
    return made.feature.id;
  }
  function part(
    name: string,
    featureId: string,
    kind: "Part" | "Assembly",
    description: string,
  ) {
    const made = createPdmForChange(
      s,
      featureId,
      {
        ...blankPdm(),
        name: `Sample — ${name}`,
        description: `${description}\n${PDM_EXAMPLE_MARKER}`,
        kind,
        purpose: "R&D / contract",
        owner: "Sample engineer",
      },
      "DEMO",
    );
    s = made.state;
    return made.item.id;
  }
  const item = (id: string) => s.pdmItems.find((p) => p.id === id)!;
  function requirements(id: string, types: DrawingType[]) {
    const p = item(id);
    s = setDrawingRequirements(
      s,
      id,
      p.revision,
      p.drawingRequirements.map((r) => ({
        ...r,
        status: types.includes(r.type) ? "Required" : "Not required",
        reason: types.includes(r.type)
          ? "Needed for this sample"
          : "Not needed for this illustrative design",
      })),
    );
  }
  function drawing(id: string, type: DrawingType, approved: boolean) {
    let p = item(id);
    s = addDrawing(
      s,
      id,
      p.revision,
      type,
      "Sample drafter",
      "Illustrative working drawing; no actual file.",
    );
    p = item(id);
    const d = p.drawings.find((d) => d.type === type)!;
    if (approved) approve(id, d.id);
    return d.id;
  }
  function approve(id: string, drawingId: string) {
    const p = item(id),
      d = p.drawings.find((d) => d.id === drawingId)!,
      v = d.versions.at(-1)!;
    s = approveDrawing(s, {
      partId: id,
      recordRevision: p.revision,
      drawingId,
      versionId: v.id,
      modelRevisionId: v.modelRevisionId,
      checkedBy: "Sample checker",
      approvedBy: "Sample Engineering team",
      notes: "Illustrative approval only; no real drawing reviewed.",
      kind: "Approval",
    });
  }
  function release(id: string, featureId: string) {
    let p = item(id);
    s = approvePart(s, {
      partId: id,
      recordRevision: p.revision,
      revisionId: p.modelRevisions.at(-1)!.id,
      featureId,
      participants: "Sample Engineering team",
      meetingDate: new Date().toISOString().slice(0, 10),
      notes: "Illustrative team approval; no production authorization.",
      differenceDecision: "",
      differenceNotes: "",
      systemIds: [project.project.id],
      opsNotes: "Illustrative R&D design retains internal DEMO identifier.",
    });
    p = item(id);
    s = releasePart(s, {
      partId: id,
      recordRevision: p.revision,
      revisionId: p.modelRevisions.at(-1)!.id,
      featureId,
      releasedBy: "Sample release manager",
      authorized: true,
    });
  }
  const releasedFeature = feature("Bed plate drawing package", "ECR");
  const plate = part(
    "Bed plate — released drawing package",
    releasedFeature,
    "Part",
    "Part Rev1 has Machining DWG Rev1 and Inspection DWG Rev2. Drawing numbers are independent of the part revision.",
  );
  requirements(plate, ["Machining", "Inspection"]);
  drawing(plate, "Machining", true);
  const inspection = drawing(plate, "Inspection", true);
  s = addDrawingVersion(
    s,
    plate,
    item(plate).revision,
    inspection,
    "Sample drafter",
    "Sample inspection dimension clarification; part geometry unchanged.",
  );
  approve(plate, inspection);
  release(plate, releasedFeature);

  const pendingFeature = feature("Toolhead assembly drawing review", "OCR");
  const assembly = part(
    "Toolhead assembly — approval pending",
    pendingFeature,
    "Assembly",
    "Assembly drawing is required and has two working versions awaiting approval. Inspection and Machining are not required. Part release is blocked.",
  );
  requirements(assembly, ["Assembly"]);
  const assemblyDrawing = drawing(assembly, "Assembly", false);
  s = addDrawingVersion(
    s,
    assembly,
    item(assembly).revision,
    assemblyDrawing,
    "Sample drafter",
    "Sample bolt sequence clarified after assembly trial; awaiting Engineering review.",
  );

  const reuseFeature = feature("Cable guide revision", "ECR");
  const guide = part(
    "Cable guide — unchanged drawing applies",
    reuseFeature,
    "Part",
    "Part Rev1 is released. Working Rev1.1 has an explicit applicability review retaining Machining DWG Rev1; it awaits part Engineering approval and release.",
  );
  requirements(guide, ["Machining"]);
  const guideDrawing = drawing(guide, "Machining", true);
  release(guide, reuseFeature);
  let p = item(guide);
  const changed = startPartChange(s, {
    featureId: reuseFeature,
    sourcePartId: guide,
    sourceRecordRevision: p.revision,
    sourceRevisionId: p.modelRevisions.at(-1)!.id,
    mode: "Revise existing part",
    systemIds: [project.project.id],
    notes:
      "Illustrative model-only cleanup; the unchanged drawing remains applicable. No printed title-block change in this example.",
    variantName: "",
    initials: "DEMO",
  });
  s = changed.state;
  p = item(guide);
  s = approveDrawing(s, {
    partId: guide,
    recordRevision: p.revision,
    drawingId: guideDrawing,
    versionId: p.drawings[0].versions[0].id,
    modelRevisionId: changed.change.resultRevisionId,
    checkedBy: "Sample checker",
    approvedBy: "Sample Engineering team",
    notes:
      "Illustrative applicability review: dimensions and printed PRT REV need no change. If either changes, a new approved drawing is needed.",
    kind: "Applicability",
  });
  return s;
}
