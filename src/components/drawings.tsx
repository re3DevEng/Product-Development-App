"use client";
import { useEffect, useState, type FormEvent } from "react";
import { FileText, Plus, X } from "lucide-react";
import type { AppState } from "@/lib/domain";
import type { PdmItem } from "@/lib/pdm";
import {
  DRAWING_TYPES,
  REQUIREMENT_STATES,
  addDrawing,
  addDrawingVersion,
  approveDrawing,
  drawingApprovalFor,
  setDrawingRequirements,
  type DrawingRequirement,
  type DrawingType,
} from "@/lib/drawings";
import { Modal, SelectionButtons } from "./shared-ui";
type Commit = (change: (state: AppState) => AppState) => Promise<void>;
type Form = {
  mode: "new" | "version" | "requirements" | "approval" | "applicability";
  base: PdmItem;
  drawingId?: string;
};

export function DrawingsSection({
  item,
  commit,
}: {
  item: PdmItem;
  commit: Commit;
}) {
  const [form, setForm] = useState<Form | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [coverageModelId, setCoverageModelId] = useState(
    item.modelRevisions.at(-1)!.id,
  );
  const coverageModel =
    item.modelRevisions.find((r) => r.id === coverageModelId) ??
    item.modelRevisions.at(-1)!;
  return (
    <section aria-label="Drawings for this record">
      <div className="overview-section-heading">
        <h3>
          Drawings <span>{item.drawings.length}</span>
        </h3>
        <button
          className="button secondary"
          disabled={item.drawings.length === DRAWING_TYPES.length}
          onClick={() => setForm({ mode: "new", base: item })}
        >
          <Plus size={15} />
          Add drawing
        </button>
      </div>
      <p className="muted">
        Record drawing versions and reviews here. Each drawing type keeps its
        own approved revision. These are local records; CAD files and
        authenticated sign-off are not connected yet.
      </p>
      <section
        className="drawing-requirements"
        aria-label="Drawing requirements"
      >
        <div className="overview-section-heading">
          <h3>Required drawing types</h3>
          <button
            className="text-button"
            onClick={() => setForm({ mode: "requirements", base: item })}
          >
            Edit requirements
          </button>
        </div>
        <label className="field">
          Check drawing coverage for
          <select
            value={coverageModel.id}
            onChange={(e) => setCoverageModelId(e.target.value)}
          >
            {item.modelRevisions.map((r) => (
              <option key={r.id} value={r.id}>
                Working Rev{r.label}
                {item.releases.some(
                  (release) => release.modelRevisionId === r.id,
                )
                  ? ` · Released Rev${item.releases.find((release) => release.modelRevisionId === r.id)!.number}`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        {item.drawingRequirements.map((r) => {
          const drawing = item.drawings.find((d) => d.type === r.type);
          return (
            <div className="drawing-requirement" key={r.type}>
              <strong>{r.type}</strong>
              <span>{r.status}</span>
              <small>
                {r.status === "Required"
                  ? drawing && drawingApprovalFor(drawing, coverageModel.id)
                    ? `Approved for working model Rev${coverageModel.label}`
                    : drawing?.versions.some(
                          (v) => v.modelRevisionId === coverageModel.id,
                        )
                      ? `Draft for model Rev${coverageModel.label} exists · approval pending`
                      : `No drawing version for model Rev${coverageModel.label}`
                  : r.status === "Not assessed"
                    ? "Needs assessment"
                    : ""}
                {r.reason && <span> · {r.reason}</span>}
              </small>
            </div>
          );
        })}
      </section>
      {!item.drawings.length && (
        <div className="empty-state">
          <FileText size={28} />
          <h3>No drawing records yet</h3>
          <p>
            Add the drawing types you need. Each keeps its own revision and
            working-version history.
          </p>
        </div>
      )}
      <div className="drawing-cards">
        {item.drawings.map((d) => {
          const latest = d.versions[d.versions.length - 1];
          const approved = d.approvals.find(
            (a) => a.kind === "Approval" && a.versionId === latest.id,
          );
          return (
            <article className="drawing-card" key={d.id}>
              <div className="overview-section-heading">
                <h3>{d.type} drawing</h3>
                <span className="muted">
                  {approved ? "Approved" : "Approval pending"}
                </span>
              </div>
              <dl className="drawing-meta">
                <div>
                  <dt>Model revision (PRT REV)</dt>
                  <dd>Rev{latest.modelRevision}</dd>
                </div>
                <div>
                  <dt>
                    {approved
                      ? "Drawing revision (DWGREV)"
                      : "Drawing draft (DWGREV)"}
                  </dt>
                  <dd>Rev{approved?.number ?? d.draftRevision}</dd>
                </div>
                <div>
                  <dt>Working version</dt>
                  <dd>{latest.version}</dd>
                </div>
                <div>
                  <dt>Approved drawing revision</dt>
                  <dd>
                    {d.approvedRevision ? `Rev${d.approvedRevision}` : "None"}
                  </dd>
                </div>
                <div>
                  <dt>Drawn by</dt>
                  <dd>{latest.drawnBy || "Not recorded"}</dd>
                </div>
              </dl>
              <p className="drawing-notes">{latest.notes}</p>
              <div className="drawing-actions">
                <button
                  className="button secondary"
                  onClick={() =>
                    setForm({ mode: "approval", base: item, drawingId: d.id })
                  }
                >
                  Approve drawing
                </button>
                {!!d.approvals.length && (
                  <button
                    className="button secondary"
                    onClick={() =>
                      setForm({
                        mode: "applicability",
                        base: item,
                        drawingId: d.id,
                      })
                    }
                  >
                    Confirm still applicable
                  </button>
                )}
                <button
                  className="button secondary"
                  onClick={() =>
                    setForm({ mode: "version", base: item, drawingId: d.id })
                  }
                >
                  Record working version
                </button>
                <button
                  className="text-button"
                  aria-expanded={expanded === d.id}
                  aria-controls={`drawing-history-${d.id}`}
                  onClick={() => setExpanded(expanded === d.id ? null : d.id)}
                >
                  {expanded === d.id ? "Hide" : "View"} version history (
                  {d.versions.length})
                </button>
              </div>
              {!!d.approvals.length && (
                <details className="revision-details">
                  <summary>Approval history ({d.approvals.length})</summary>
                  {[...d.approvals].reverse().map((a) => (
                    <article key={a.id}>
                      <strong>
                        DWG Rev{a.number} ·{" "}
                        {a.kind === "Applicability"
                          ? "Still applicable"
                          : "Approved"}
                      </strong>
                      <p>
                        Part working Rev
                        {
                          item.modelRevisions.find(
                            (r) => r.id === a.modelRevisionId,
                          )?.label
                        }{" "}
                        · Drawing version{" "}
                        {d.versions.find((v) => v.id === a.versionId)?.version}
                      </p>
                      <p>
                        Drawn by{" "}
                        {d.versions.find((v) => v.id === a.versionId)?.drawnBy}{" "}
                        · Checked by {a.checkedBy} · Approved by {a.approvedBy}
                      </p>
                      <p>{a.notes}</p>
                      <small>{new Date(a.at).toLocaleString()}</small>
                    </article>
                  ))}
                </details>
              )}
              {expanded === d.id && (
                <div id={`drawing-history-${d.id}`} className="pdm-activity">
                  {[...d.versions].reverse().map((v) => (
                    <article key={v.id}>
                      <strong>
                        Working version {v.version} · Model Rev{v.modelRevision}
                      </strong>
                      <p>{v.notes}</p>
                      <small>
                        Drawn by {v.drawnBy || "not recorded"} · Recorded by{" "}
                        {v.actor} · {new Date(v.at).toLocaleString()}
                      </small>
                    </article>
                  ))}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {form && (
        <DrawingForm
          form={form}
          item={item}
          commit={commit}
          close={() => setForm(null)}
        />
      )}
    </section>
  );
}

function DrawingForm({
  form,
  item,
  commit,
  close,
}: {
  form: Form;
  item: PdmItem;
  commit: Commit;
  close: () => void;
}) {
  const drawing = form.base.drawings.find((d) => d.id === form.drawingId);
  const previous = drawing?.versions[drawing.versions.length - 1];
  const initialModelId =
    previous?.modelRevisionId ??
    form.base.modelRevisions[form.base.modelRevisions.length - 1].id;
  const [modelRevisionId, setModelRevisionId] = useState(initialModelId);
  const available = DRAWING_TYPES.filter(
    (type) => !form.base.drawings.some((d) => d.type === type),
  );
  const [type, setType] = useState<DrawingType>(available[0] ?? "Machining");
  const [drawnBy, setDrawnBy] = useState(previous?.drawnBy ?? "");
  const [notes, setNotes] = useState("");
  const [checkedBy, setCheckedBy] = useState("");
  const [approvedBy, setApprovedBy] = useState("");
  const [versionId, setVersionId] = useState(
    form.mode === "applicability"
      ? (drawing?.approvals.findLast((a) => a.kind === "Approval")?.versionId ??
          "")
      : (previous?.id ?? ""),
  );
  const isApproval = form.mode === "approval" || form.mode === "applicability";
  const [requirements, setRequirements] = useState(
    form.base.drawingRequirements.map((r) => ({ ...r })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const stale = item.revision !== form.base.revision;
  const isRequirements = form.mode === "requirements";
  const dirty = isRequirements
    ? JSON.stringify(requirements) !==
      JSON.stringify(form.base.drawingRequirements)
    : !!checkedBy ||
      !!approvedBy ||
      versionId !== (previous?.id ?? "") ||
      modelRevisionId !== initialModelId ||
      !!notes ||
      drawnBy !== (previous?.drawnBy ?? "") ||
      type !== (available[0] ?? "Machining");
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const dismiss = () => {
    if (!busy && (!dirty || window.confirm("Discard unsaved drawing changes?")))
      close();
  };
  const title = isApproval
    ? form.mode === "applicability"
      ? "Confirm drawing still applicable"
      : "Approve drawing"
    : isRequirements
      ? "Drawing requirements"
      : drawing
        ? `${drawing.type}: new working version`
        : "Add drawing record";
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await commit((s) =>
        isApproval
          ? approveDrawing(s, {
              partId: item.id,
              recordRevision: form.base.revision,
              drawingId: drawing!.id,
              versionId,
              modelRevisionId,
              checkedBy,
              approvedBy,
              notes,
              kind:
                form.mode === "applicability" ? "Applicability" : "Approval",
            })
          : isRequirements
            ? setDrawingRequirements(
                s,
                item.id,
                form.base.revision,
                requirements,
              )
            : drawing
              ? addDrawingVersion(
                  s,
                  item.id,
                  form.base.revision,
                  drawing.id,
                  drawnBy,
                  notes,
                  undefined,
                  modelRevisionId,
                )
              : addDrawing(
                  s,
                  item.id,
                  form.base.revision,
                  type,
                  drawnBy,
                  notes,
                  undefined,
                  modelRevisionId,
                ),
      );
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function requirement(type: DrawingType, change: Partial<DrawingRequirement>) {
    setRequirements((current) =>
      current.map((r) => (r.type === type ? { ...r, ...change } : r)),
    );
  }
  return (
    <Modal label={title} onClose={dismiss}>
      <div className="modal-heading">
        <h2>{title}</h2>
        <button
          className="icon-button"
          aria-label="Close drawing form"
          disabled={busy}
          onClick={dismiss}
        >
          <X size={18} />
        </button>
      </div>
      <form className="project-form" onSubmit={save}>
        <div className="modal-body">
          <p className="muted">
            {item.number} · {item.name}
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {stale && (
            <p className="form-error" role="alert">
              This record changed elsewhere. Close this form and reopen it
              before saving.
            </p>
          )}
          <fieldset disabled={busy || stale}>
            {isApproval ? (
              <>
                <p className="pdm-notice">
                  {form.mode === "applicability"
                    ? "Keep the existing DWG revision and record why the unchanged drawing applies. If the printed PRT REV or drawing content must change, record a new working version and approve it instead."
                    : "Approve an exact working drawing version. The DWG revision increases once on approval, independently of the part revision."}
                </p>
                <p className="muted">
                  Names record the team’s review. Sign-in and CAD file
                  verification are not connected yet.
                </p>
                <label>
                  Drawing working version
                  <select
                    value={versionId}
                    onChange={(e) => {
                      setVersionId(e.target.value);
                      if (form.mode === "approval")
                        setModelRevisionId(
                          drawing!.versions.find(
                            (v) => v.id === e.target.value,
                          )!.modelRevisionId,
                        );
                    }}
                  >
                    <option value="" disabled>
                      Choose a version
                    </option>
                    {drawing!.versions
                      .filter(
                        (v) =>
                          form.mode !== "applicability" ||
                          drawing!.approvals.some(
                            (a) =>
                              a.kind === "Approval" && a.versionId === v.id,
                          ),
                      )
                      .map((v) => (
                        <option key={v.id} value={v.id}>
                          Version {v.version} · Part working Rev
                          {v.modelRevision}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Part revision covered
                  <select
                    value={modelRevisionId}
                    disabled={form.mode === "approval"}
                    onChange={(e) => setModelRevisionId(e.target.value)}
                  >
                    {form.base.modelRevisions.map((r) => (
                      <option key={r.id} value={r.id}>
                        Working Rev{r.label}
                        {form.base.releases.some(
                          (release) => release.modelRevisionId === r.id,
                        )
                          ? ` · Released Rev${form.base.releases.find((release) => release.modelRevisionId === r.id)!.number}`
                          : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Checked by
                  <input
                    required
                    maxLength={100}
                    value={checkedBy}
                    onChange={(e) => setCheckedBy(e.target.value)}
                  />
                </label>
                <label>
                  Approved by / Engineering participants
                  <input
                    required
                    maxLength={2000}
                    value={approvedBy}
                    onChange={(e) => setApprovedBy(e.target.value)}
                  />
                </label>
                <label>
                  Review notes
                  <textarea
                    required
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                  />
                </label>
              </>
            ) : isRequirements ? (
              <>
                <p>
                  Assess each type independently. Marking a drawing required
                  does not approve it.
                </p>
                {requirements.map((r) => (
                  <section className="drawing-requirement-form" key={r.type}>
                    <SelectionButtons
                      label={`${r.type} requirement`}
                      value={r.status}
                      options={REQUIREMENT_STATES}
                      onChange={(value) =>
                        requirement(r.type, {
                          status: value as DrawingRequirement["status"],
                        })
                      }
                    />
                    <label>
                      {r.type} reason
                      {r.status === "Not required"
                        ? " (required)"
                        : " (optional)"}
                      <textarea
                        rows={2}
                        maxLength={1000}
                        required={r.status === "Not required"}
                        value={r.reason}
                        onChange={(e) =>
                          requirement(r.type, { reason: e.target.value })
                        }
                      />
                    </label>
                  </section>
                ))}
              </>
            ) : (
              <>
                {!drawing && (
                  <SelectionButtons
                    label="Drawing type"
                    value={type}
                    options={available}
                    onChange={(v) => setType(v as DrawingType)}
                  />
                )}
                <p className="pdm-notice">
                  Model Rev
                  {
                    form.base.modelRevisions.find(
                      (r) => r.id === modelRevisionId,
                    )?.label
                  }{" "}
                  · Drawing draft Rev
                  {`${drawing?.approvedRevision ?? 0}.1`} · Working version{" "}
                  {(previous?.version ?? 0) + 1}
                  <br />
                  This records development progress. It does not upload a file
                  or approve a revision.
                </p>
                <label>
                  Associated model revision
                  <select
                    value={modelRevisionId}
                    onChange={(e) => setModelRevisionId(e.target.value)}
                  >
                    {form.base.modelRevisions.map((r) => (
                      <option key={r.id} value={r.id}>
                        Rev{r.label} · {r.status}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Drawn by
                  <input
                    maxLength={100}
                    value={drawnBy}
                    onChange={(e) => setDrawnBy(e.target.value)}
                    placeholder="Drawing author"
                  />
                </label>
                <label>
                  Working version notes
                  <textarea
                    required
                    rows={4}
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={
                      drawing
                        ? "Describe what changed since the previous working version"
                        : "Describe the initial drawing and its purpose"
                    }
                  />
                </label>
              </>
            )}
          </fieldset>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={dismiss}
          >
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={busy || stale || (isRequirements && !dirty)}
          >
            {busy
              ? "Saving…"
              : isApproval
                ? "Record drawing approval"
                : isRequirements
                  ? "Save requirements"
                  : drawing
                    ? "Save working version"
                    : "Create drawing"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
