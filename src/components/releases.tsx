"use client";
import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import type { AppState, Feature } from "@/lib/domain";
import type { PdmItem } from "@/lib/pdm";
import {
  approvePart,
  currentApproval,
  latestRelease,
  newerRelease,
  releasePart,
} from "@/lib/releases";
import { Modal } from "./shared-ui";
import { drawingReleaseIssues } from "@/lib/drawings";
type Commit = (update: (s: AppState) => AppState) => Promise<void>;

export function RevisionNotice({
  part,
  revisionId,
  state,
  open,
}: {
  part: PdmItem;
  revisionId: string;
  state: AppState;
  open: (id: string, revisionId?: string) => void;
}) {
  const release = newerRelease(part, revisionId);
  if (!release) return null;
  const feature = state.features.find((f) => f.id === release.featureId);
  return (
    <p className="revision-warning">
      Newer revision released:{" "}
      <button
        className="text-button"
        onClick={() => open(part.id, release.modelRevisionId)}
      >
        Rev{release.number}
      </button>
      {feature ? ` through ${feature.workType} ${feature.number}` : ""}. Review
      the differences before releasing this work.
    </p>
  );
}

export function ReleaseControls({
  part,
  feature,
  revisionId,
  state,
  commit,
}: {
  part: PdmItem;
  feature: Feature;
  revisionId: string;
  state: AppState;
  commit: Commit;
}) {
  const [mode, setMode] = useState<"approve" | "release" | null>(null);
  const release = part.releases.find((r) => r.modelRevisionId === revisionId);
  const approval = currentApproval(state, part, revisionId, feature.id);
  const drawingIssues = drawingReleaseIssues(part, revisionId);
  if (release)
    return (
      <p className="muted">
        Release recorded · Rev{release.number} ·{" "}
        {new Date(release.at).toLocaleDateString()}
      </p>
    );
  if (feature.status !== "In-Work") return null;
  const oldApproval = part.approvals.some(
    (a) => a.modelRevisionId === revisionId && a.featureId === feature.id,
  );
  return (
    <div className="release-controls">
      <p className="muted">
        {approval
          ? "Engineering approval recorded"
          : oldApproval
            ? "Engineering review needs updating"
            : "Engineering approval pending"}
      </p>
      <div className="drawing-actions">
        <button className="button secondary" onClick={() => setMode("approve")}>
          {approval ? "Review approval" : "Record Engineering approval"}
        </button>
        <button
          className="button secondary"
          disabled={!approval || drawingIssues.length > 0}
          onClick={() => setMode("release")}
        >
          Record release
        </button>
      </div>
      {drawingIssues.length > 0 && (
        <div className="revision-warning">
          <strong>Drawings need review</strong>
          <ul>
            {drawingIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
          Open the part’s Drawings tab to assess requirements and record
          approvals.
        </div>
      )}
      {mode && (
        <ReleaseForm
          key={mode}
          part={part}
          feature={feature}
          revisionId={revisionId}
          state={state}
          commit={commit}
          mode={mode}
          close={() => setMode(null)}
        />
      )}
    </div>
  );
}
function ReleaseForm({
  part,
  feature,
  revisionId,
  state,
  commit,
  mode,
  close,
}: {
  part: PdmItem;
  feature: Feature;
  revisionId: string;
  state: AppState;
  commit: Commit;
  mode: "approve" | "release";
  close: () => void;
}) {
  const [baseRevision] = useState(part.revision);
  const existing = currentApproval(state, part, revisionId, feature.id);
  const [participants, setParticipants] = useState(
    existing?.participants ?? "",
  );
  const [meetingDate, setMeetingDate] = useState(existing?.meetingDate ?? "");
  const [notes, setNotes] = useState(existing?.notes ?? "");
  const [opsNotes, setOpsNotes] = useState(existing?.opsNotes ?? "");
  const [decision, setDecision] = useState(existing?.differenceDecision ?? "");
  const [differenceNotes, setDifferenceNotes] = useState(
    existing?.differenceNotes ?? "",
  );
  const [systemIds, setSystemIds] = useState(
    existing?.systemIds ??
      state.partChanges.find(
        (c) => c.resultPartId === part.id && c.resultRevisionId === revisionId,
      )?.systemIds ??
      [],
  );
  const [releasedBy, setReleasedBy] = useState("");
  const [authorized, setAuthorized] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const outdated = newerRelease(part, revisionId);
  const stale = part.revision !== baseRevision;
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const dismiss = () => {
    if (
      !busy &&
      (!dirty || window.confirm("Discard this unsaved release form?"))
    )
      close();
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const input = {
        partId: part.id,
        recordRevision: baseRevision,
        revisionId,
        featureId: feature.id,
      };
      await commit((s) =>
        mode === "approve"
          ? approvePart(s, {
              ...input,
              participants,
              meetingDate,
              notes,
              opsNotes,
              differenceDecision: decision,
              differenceNotes,
              systemIds,
            })
          : releasePart(s, { ...input, releasedBy, authorized }),
      );
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      label={mode === "approve" ? "Engineering approval" : "Record release"}
      wide
      onClose={dismiss}
    >
      <div className="modal-heading">
        <h2>
          {mode === "approve"
            ? "Engineering approval"
            : `Record Rev${(latestRelease(part)?.number ?? 0) + 1} release`}
        </h2>
        <button
          className="icon-button"
          aria-label="Close release form"
          onClick={dismiss}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      <form
        className="project-form"
        onSubmit={save}
        onChange={() => setDirty(true)}
      >
        <div className="modal-body">
          <p>
            <strong>
              {part.number} · {part.name}
            </strong>
            <br />
            {feature.workType} {feature.number} · Working Rev
            {part.modelRevisions.find((r) => r.id === revisionId)?.label}
          </p>
          <p className="pdm-notice">
            Prototype record only. No CAD files are published, drawing approvals
            granted, or machine configurations changed. Names and authorization
            are manually recorded until sign-in is connected.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          {stale && (
            <p role="alert" className="form-error">
              This part changed. Close and reopen this form.
            </p>
          )}
          <fieldset disabled={busy || stale}>
            {mode === "approve" ? (
              <>
                <label>
                  Engineering meeting date
                  <input
                    type="date"
                    required
                    value={meetingDate}
                    onChange={(e) => setMeetingDate(e.target.value)}
                  />
                </label>
                <label>
                  Engineering participants
                  <input
                    required
                    maxLength={2000}
                    value={participants}
                    onChange={(e) => setParticipants(e.target.value)}
                  />
                </label>
                <label>
                  Engineering approval notes
                  <textarea
                    required
                    maxLength={2000}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Record the team's approval and what was reviewed."
                  />
                </label>
                <p className="muted">
                  Odoo number: {part.odooNumber || "Not assigned"}. Assign
                  production numbers through Edit record after Ops confirms
                  them.
                </p>
                <label>
                  Ops numbering decision
                  <textarea
                    required
                    maxLength={2000}
                    value={opsNotes}
                    onChange={(e) => setOpsNotes(e.target.value)}
                    placeholder="Who confirmed the number, or why an internal R&D number applies."
                  />
                </label>
                <h3>Intended systems</h3>
                <p className="muted">
                  Record the receiving systems. This does not change their
                  configurations.
                </p>
                <div className="pdm-link-choices">
                  {state.projects
                    .filter((p) => p.status === "In work")
                    .map((p) => (
                      <label key={p.id}>
                        <input
                          type="checkbox"
                          checked={systemIds.includes(p.id)}
                          onChange={(e) =>
                            setSystemIds(
                              e.target.checked
                                ? [...systemIds, p.id]
                                : systemIds.filter((id) => id !== p.id),
                            )
                          }
                        />
                        <span>
                          {p.number} · {p.title}
                        </span>
                      </label>
                    ))}
                </div>
                {outdated && (
                  <>
                    <p className="revision-warning">
                      Newer revision released: Rev{outdated.number}. Engineering
                      must account for its differences before this work can be
                      released.
                    </p>
                    <label>
                      Review outcome
                      <select
                        required
                        value={decision}
                        onChange={(e) => setDecision(e.target.value)}
                      >
                        <option value="">Choose an outcome</option>
                        <option>Incorporated released changes</option>
                        <option>Proceed with intentional differences</option>
                      </select>
                    </label>
                    <label>
                      Differences and rationale
                      <textarea
                        required
                        maxLength={2000}
                        value={differenceNotes}
                        onChange={(e) => setDifferenceNotes(e.target.value)}
                      />
                    </label>
                    <p className="muted">
                      If this must coexist as an independent design, create a
                      variant and have Ops assign its own number instead.
                    </p>
                  </>
                )}
              </>
            ) : (
              <>
                <p>
                  Engineering approval: {existing?.participants} ·{" "}
                  {existing?.meetingDate}
                </p>
                <p>{existing?.notes}</p>
                <p>
                  The next released revision for this part is{" "}
                  <strong>Rev{(latestRelease(part)?.number ?? 0) + 1}</strong>.
                  Existing releases and working history will be preserved.
                </p>
                <label>
                  Released by
                  <input
                    required
                    maxLength={180}
                    value={releasedBy}
                    onChange={(e) => setReleasedBy(e.target.value)}
                  />
                </label>
                <label>
                  <input
                    type="checkbox"
                    required
                    checked={authorized}
                    onChange={(e) => setAuthorized(e.target.checked)}
                  />{" "}
                  I confirm the named person is authorized to record this
                  release.
                </label>
              </>
            )}
          </fieldset>
        </div>
        <div className="modal-footer">
          <button
            type="button"
            className="button secondary"
            onClick={dismiss}
            disabled={busy}
          >
            Cancel
          </button>
          <button className="button primary" disabled={busy || stale}>
            {busy
              ? "Saving…"
              : mode === "approve"
                ? "Record approval"
                : "Record release"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ReleaseHistory({
  part,
  state,
  open,
}: {
  part: PdmItem;
  state: AppState;
  open: (id: string, revisionId?: string) => void;
}) {
  if (!part.releases.length) return null;
  return (
    <section aria-label="Recorded releases">
      <h3>Recorded releases</h3>
      <p className="muted">
        Prototype records · CAD publication and system configuration updates are
        not connected.
      </p>
      {[...part.releases].reverse().map((r) => {
        const approval = part.approvals.find((a) => a.id === r.approvalId)!;
        const feature = state.features.find((f) => f.id === r.featureId);
        return (
          <article className="revision-row" key={r.id}>
            <div className="revision-heading">
              <h4>
                <button
                  className="change-revision-link"
                  onClick={() => open(part.id, r.modelRevisionId)}
                >
                  Rev{r.number}
                </button>
              </h4>
              {r.id === latestRelease(part)?.id && (
                <span className="revision-tag">Latest released</span>
              )}
              <time dateTime={r.at}>{new Date(r.at).toLocaleDateString()}</time>
            </div>
            <p>
              {feature ? `${feature.workType} ${feature.number} · ` : ""}
              {r.releasedBy}
            </p>
            <details className="revision-details">
              <summary>Approval & release details</summary>
              <dl>
                <dt>Engineering</dt>
                <dd>
                  {approval.participants} · {approval.meetingDate}
                </dd>
                <dt>Approval notes</dt>
                <dd>{approval.notes}</dd>
                <dt>Odoo number</dt>
                <dd>{r.odooNumber || "Internal R&D number"}</dd>
                <dt>Ops decision</dt>
                <dd>{approval.opsNotes}</dd>
                <dt>Intended systems</dt>
                <dd>
                  {r.systemIds
                    .map((id) => {
                      const s = state.projects.find((s) => s.id === id);
                      return s ? `${s.number} · ${s.title}` : "Removed system";
                    })
                    .join(", ")}
                </dd>
                {approval.differenceDecision && (
                  <>
                    <dt>Newer-release review</dt>
                    <dd>
                      {approval.differenceDecision}: {approval.differenceNotes}
                    </dd>
                  </>
                )}
              </dl>
            </details>
          </article>
        );
      })}
    </section>
  );
}
