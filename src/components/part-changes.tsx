"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { AppState, Feature } from "@/lib/domain";
import type { PdmItem } from "@/lib/pdm";
import { startPartChange } from "@/lib/part-changes";
import { type PartChange } from "@/lib/model-revisions";
import { nextWorkingLabel, latestRelease } from "@/lib/releases";
import { ReleaseControls, ReleaseHistory, RevisionNotice } from "./releases";
import { Modal, SelectionButtons } from "./shared-ui";
type Commit = (change: (state: AppState) => AppState) => Promise<void>;

function LatestPartRevisionBadge({
  part,
  revisionId,
}: {
  part: PdmItem;
  revisionId: string;
}) {
  const release = part.releases.find((r) => r.modelRevisionId === revisionId);
  const label = release
    ? release.id === latestRelease(part)?.id
      ? "Latest released"
      : null
    : part.modelRevisions.at(-1)?.id === revisionId
      ? "Latest working"
      : null;
  return label ? <span className="revision-tag">{label}</span> : null;
}

export function PartChanges({
  state,
  feature,
  commit,
  create,
  open,
}: {
  state: AppState;
  feature: Feature;
  commit: Commit;
  create: () => void;
  open: (id: string, revisionId?: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const linked = state.pdmItems.filter((p) =>
    p.featureIds.includes(feature.id),
  );
  const changes = state.partChanges.filter((c) => c.featureId === feature.id);
  const partIds = [
    ...new Set([
      ...changes.map((c) => c.resultPartId),
      ...linked.map((p) => p.id),
    ]),
  ];
  return (
    <section className="overview-section">
      <h3>Parts & assemblies</h3>
      {feature.workType !== "Unassigned" && feature.status === "In-Work" && (
        <div className="drawing-actions">
          <button className="button secondary" onClick={create}>
            <Plus size={15} />
            New part / assembly
          </button>
          <button className="button secondary" onClick={() => setAdding(true)}>
            Change existing part
          </button>
        </div>
      )}
      {partIds.map((id) => {
        const part = state.pdmItems.find((p) => p.id === id)!;
        const history = changes
          .filter((c) => c.resultPartId === id)
          .sort(
            (a, b) =>
              part.modelRevisions.findIndex(
                (r) => r.id === b.resultRevisionId,
              ) -
              part.modelRevisions.findIndex((r) => r.id === a.resultRevisionId),
          );
        const [latest, ...earlier] = history;
        return (
          <section
            key={id}
            className="part-change-group"
            aria-label={`${part.number} revision group`}
          >
            <h4 className="change-part-heading">
              <button
                className="change-part-link"
                onClick={() => open(part.id)}
              >
                <span className="change-part-identity">
                  <strong className="change-part-number">{part.number}</strong>
                  <small>{part.kind}</small>
                </span>
                <strong>{part.name}</strong>
              </button>
            </h4>
            {latest ? (
              <>
                <ChangeCard
                  change={latest}
                  state={state}
                  open={open}
                  latestLabel={`Latest in ${feature.workType}`}
                />
                {!!earlier.length && (
                  <details className="part-change-history">
                    <summary
                      aria-label={`Earlier revisions for ${part.number} (${earlier.length})`}
                    >
                      Earlier revisions ({earlier.length})
                    </summary>
                    {earlier.map((c) => (
                      <ChangeCard
                        key={c.id}
                        change={c}
                        state={state}
                        open={open}
                      />
                    ))}
                  </details>
                )}
              </>
            ) : (
              <div className="revision-context">
                <button
                  className="text-button"
                  onClick={() => open(part.id, part.modelRevisions[0].id)}
                >
                  Rev
                  {part.releases.find(
                    (r) => r.modelRevisionId === part.modelRevisions[0].id,
                  )?.number ?? part.modelRevisions[0].label}
                </button>
                <span>Linked initial revision</span>
                <LatestPartRevisionBadge
                  part={part}
                  revisionId={part.modelRevisions[0].id}
                />
              </div>
            )}
            <ReleaseControls
              part={part}
              feature={feature}
              revisionId={latest?.resultRevisionId ?? part.modelRevisions[0].id}
              state={state}
              commit={commit}
            />
            {!latest && (
              <RevisionNotice
                part={part}
                revisionId={part.modelRevisions[0].id}
                state={state}
                open={open}
              />
            )}
          </section>
        );
      })}
      {!linked.length && !changes.length && (
        <p className="muted">
          {feature.workType === "Unassigned"
            ? "Assign ECR or OCR to develop parts for this feature."
            : feature.status !== "In-Work"
              ? "Restore this change to develop a part or assembly."
              : "Create a new part, or start from a revision already in the library."}
        </p>
      )}
      {adding && (
        <ChangeForm
          state={state}
          feature={feature}
          commit={commit}
          close={() => setAdding(false)}
        />
      )}
    </section>
  );
}
function ChangeCard({
  change: c,
  state,
  open,
  latestLabel,
}: {
  change: PartChange;
  state: AppState;
  open: (id: string, revisionId?: string) => void;
  latestLabel?: string;
}) {
  const source = state.pdmItems.find((p) => p.id === c.sourcePartId)!;
  const result = state.pdmItems.find((p) => p.id === c.resultPartId)!;
  const sourceRev = source.modelRevisions.find(
    (r) => r.id === c.sourceRevisionId,
  )!;
  const resultRev = result.modelRevisions.find(
    (r) => r.id === c.resultRevisionId,
  )!;
  const release = result.releases.find(
    (r) => r.modelRevisionId === resultRev.id,
  );
  const sourceRelease = source.releases.find(
    (r) => r.modelRevisionId === sourceRev.id,
  );
  return (
    <article className="revision-row change-summary">
      <div className="revision-heading">
        <h4>
          <button
            className="change-revision-link"
            onClick={() => open(result.id, resultRev.id)}
          >
            Rev{release?.number ?? resultRev.label}
          </button>
        </h4>
        <span className="revision-tag">
          {release ? "Release recorded" : "Draft"}
        </span>
        {latestLabel && <span className="revision-tag">{latestLabel}</span>}
        <LatestPartRevisionBadge part={result} revisionId={resultRev.id} />
        <time dateTime={c.createdAt}>
          {new Date(c.createdAt).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </time>
      </div>
      <div className="revision-context">
        <span>
          {c.mode === "Create variant" ? "Variant of " : "From "}
          <button
            className="text-button"
            onClick={() => open(source.id, sourceRev.id)}
          >
            {source.id !== result.id && `${source.number} `}Rev
            {sourceRelease?.number ?? sourceRev.label}
          </button>
        </span>
      </div>
      <p className="drawing-notes">{c.notes}</p>
      <RevisionNotice
        part={result}
        revisionId={resultRev.id}
        state={state}
        open={open}
      />
      <details className="revision-details">
        <summary
          aria-label={`Details for ${result.number} Rev${resultRev.label}`}
        >
          Details
        </summary>
        <dl>
          <dt>Intended systems</dt>
          <dd>
            {c.systemIds
              .map((id) => {
                const p = state.projects.find((p) => p.id === id)!;
                return `${p.number} · ${p.title}`;
              })
              .join(", ") ||
              "No target systems remain; choose targets before release."}
          </dd>
          <dt>Ops numbering</dt>
          <dd>
            {release
              ? result.approvals.find((a) => a.id === release.approvalId)
                  ?.opsNotes
              : "Confirm at Engineering approval"}
          </dd>
          <dt>Release</dt>
          <dd>
            {release
              ? `Rev${release.number} recorded`
              : "Not released"}
          </dd>
          <dt>Working revision</dt>
          <dd>Rev{resultRev.label}</dd>
          <dt>Recorded</dt>
          <dd>{new Date(c.createdAt).toLocaleString()}</dd>
        </dl>
      </details>
    </article>
  );
}

export function ModelRevisionHistory({
  item,
  state,
  open,
  selectedRevisionId,
}: {
  item: PdmItem;
  state: AppState;
  open: (id: string, revisionId?: string) => void;
  selectedRevisionId?: string;
}) {
  return (
    <section aria-label="Model revision history">
      <ReleaseHistory part={item} state={state} open={open} />
      <h3>Development history</h3>
      <p className="muted">Working revisions stay in history after release.</p>
      {[...item.modelRevisions]
        .reverse()
        .sort(
          (a, b) =>
            Number(b.id === selectedRevisionId) -
            Number(a.id === selectedRevisionId),
        )
        .map((r) => {
          const change = state.partChanges.find(
            (c) => c.resultPartId === item.id && c.resultRevisionId === r.id,
          );
          const feature = state.features.find(
            (f) => f.id === change?.featureId,
          );
          const source = state.pdmItems.find((p) => p.id === r.source?.partId);
          const sourceRevision = source?.modelRevisions.find(
            (revision) => revision.id === r.source?.revisionId,
          );
          const release = item.releases.find(
            (release) => release.modelRevisionId === r.id,
          );
          return (
            <article
              className={`revision-row ${r.id === selectedRevisionId ? "selected-model-revision" : ""}`}
              key={r.id}
            >
              <div className="revision-heading">
                <h4>Rev{r.label}</h4>
                {release && (
                  <span className="revision-tag">
                    Released as Rev{release.number}
                  </span>
                )}
                {!release && r.label === item.workingRevision && (
                  <span className="revision-tag">Latest working</span>
                )}
                {r.id === selectedRevisionId && (
                  <span className="revision-tag">Selected</span>
                )}
                <time dateTime={r.createdAt}>
                  {new Date(r.createdAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </time>
              </div>
              <div className="revision-context">
                {feature && (
                  <strong>
                    {feature.workType} {feature.number}
                  </strong>
                )}
                {source && sourceRevision && (
                  <span>
                    {source.id === item.id ? "From " : "Variant of "}
                    <button
                      className="text-button"
                      onClick={() => open(source.id, sourceRevision.id)}
                    >
                      {source.id !== item.id && `${source.number} `}Rev
                      {sourceRevision.label}
                    </button>
                  </span>
                )}
              </div>
              <p className="drawing-notes">{r.notes}</p>
              <RevisionNotice
                part={item}
                revisionId={r.id}
                state={state}
                open={open}
              />
              {change && (
                <details className="revision-details">
                  <summary aria-label={`Details for Rev${r.label}`}>
                    Details
                  </summary>
                  <dl>
                    <dt>Intended systems</dt>
                    <dd>
                      {change.systemIds
                        .map((id) => {
                          const system = state.projects.find(
                            (p) => p.id === id,
                          )!;
                          return `${system.number} · ${system.title}`;
                        })
                        .join(", ") ||
                        "No target systems remain; choose targets before release."}
                    </dd>
                    <dt>Ops numbering</dt>
                    <dd>
                      {release
                        ? "Recorded with release"
                        : "Confirm at Engineering approval"}
                    </dd>
                    <dt>Recorded</dt>
                    <dd>{new Date(r.createdAt).toLocaleString()}</dd>
                  </dl>
                </details>
              )}
            </article>
          );
        })}
    </section>
  );
}

function ChangeForm({
  state,
  feature,
  commit,
  close,
}: {
  state: AppState;
  feature: Feature;
  commit: Commit;
  close: () => void;
}) {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<PdmItem | null>(null);
  const [revisionId, setRevisionId] = useState("");
  const [mode, setMode] = useState<PartChange["mode"]>("Revise existing part");
  const [systemIds, setSystemIds] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [variantName, setVariantName] = useState("");
  const [initials, setInitials] = useState("");
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const stale =
    source &&
    state.pdmItems.find((p) => p.id === source.id)?.revision !==
      source.revision;
  const dirty = !!source || !!notes || !!systemIds.length;
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const dismiss = () => {
    if (
      !busy &&
      (!dirty || window.confirm("Discard this unsaved part change?"))
    )
      close();
  };
  async function save(e: FormEvent) {
    e.preventDefault();
    if (!source) return;
    setBusy(true);
    setError("");
    try {
      await commit(
        (s) =>
          startPartChange(s, {
            featureId: feature.id,
            sourcePartId: source.id,
            sourceRecordRevision: source.revision,
            sourceRevisionId: revisionId,
            mode,
            systemIds,
            notes,
            variantName,
            initials,
          }).state,
      );
      close();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const systems = state.projects.filter((p) => p.status === "In work");
  return (
    <Modal wide label="Change existing part" onClose={dismiss}>
      <div className="modal-heading">
        <h2>Change existing part</h2>
        <button
          className="icon-button"
          aria-label="Close part change"
          onClick={dismiss}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      <form className="project-form" onSubmit={save}>
        <div className="modal-body">
          <p className="muted">
            {feature.workType} {feature.number} · {feature.title}
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {stale && (
            <p className="form-error" role="alert">
              The source changed elsewhere. Close this form and select it again.
            </p>
          )}
          {!source ? (
            <>
              <label>
                Find a part or assembly
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Name, internal ID, or Odoo number"
                />
              </label>
              <div className="pdm-part-picker">
                {state.pdmItems
                  .filter((p) =>
                    `${p.number} ${p.name} ${p.odooNumber}`
                      .toLowerCase()
                      .includes(search.toLowerCase()),
                  )
                  .map((p) => (
                    <button
                      type="button"
                      className="pdm-row"
                      key={p.id}
                      onClick={() => {
                        const previous = state.partChanges.find(
                          (c) =>
                            c.featureId === feature.id &&
                            c.resultPartId === p.id,
                        );
                        setSource(p);
                        setRevisionId(
                          previous?.resultRevisionId ??
                            latestRelease(p)?.modelRevisionId ??
                            p.modelRevisions[p.modelRevisions.length - 1].id,
                        );
                        setSystemIds(
                          previous?.systemIds.filter((id) =>
                            systems.some((s) => s.id === id),
                          ) ?? [],
                        );
                        setVariantName(`${p.name} variant`);
                      }}
                    >
                      <span className="pdm-row-main">
                        <span>
                          {p.number} · {p.kind}
                        </span>
                        <strong>{p.name}</strong>
                        <small>
                          {p.modelRevisions.length} draft revision(s)
                        </small>
                      </span>
                    </button>
                  ))}
              </div>
              {!state.pdmItems.length && (
                <p>
                  Create a part or assembly first. It will then be available as
                  a source.
                </p>
              )}
            </>
          ) : (
            <fieldset disabled={busy || !!stale}>
              <h3>
                {source.number} · {source.name}
              </h3>
              <button
                className="text-button"
                type="button"
                onClick={() => setSource(null)}
              >
                Choose a different part
              </button>
              <label>
                Source model revision
                <select
                  value={revisionId}
                  onChange={(e) => setRevisionId(e.target.value)}
                >
                  {[...source.modelRevisions].reverse().map((r) => (
                    <option key={r.id} value={r.id}>
                      {source.releases.some(
                        (release) => release.modelRevisionId === r.id,
                      )
                        ? `Rev${source.releases.find((release) => release.modelRevisionId === r.id)!.number} · Release recorded (working ${r.label})`
                        : `Rev${r.label} · Draft`}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                The selected source and its drawing history will be preserved.
                Recorded releases are prototype metadata; CAD files are not
                connected.
              </p>
              {state.partChanges.some(
                (c) =>
                  c.sourcePartId === source.id &&
                  c.featureId !== feature.id &&
                  state.features.some(
                    (f) =>
                      f.id === c.featureId &&
                      !["Cancelled", "Declined"].includes(f.status),
                  ),
              ) && (
                <p className="pdm-notice">
                  Another ECR/OCR is changing this part. Parallel work does not
                  block release. If another revision releases first, Engineering
                  must review its differences before releasing this work.
                </p>
              )}
              <SelectionButtons
                label="Change approach"
                value={mode}
                options={["Revise existing part", "Create variant"]}
                onChange={(value) => setMode(value as PartChange["mode"])}
              />
              <p className="muted">
                {mode === "Revise existing part"
                  ? `Keep ${source.number} and create working Rev${nextWorkingLabel(source)}. Working labels do not reserve a release number. The next whole revision is assigned at release.`
                  : "Assign a new internal ID, start at Rev0.1, and retain the source link. The Odoo number stays pending Ops; drawings are not copied or approved automatically."}
              </p>
              {mode === "Create variant" && (
                <>
                  <label>
                    Variant name
                    <input
                      required
                      maxLength={180}
                      value={variantName}
                      onChange={(e) => setVariantName(e.target.value)}
                    />
                  </label>
                  <label>
                    Creator initials
                    <input
                      required
                      pattern="[A-Za-z]{2,5}"
                      maxLength={5}
                      value={initials}
                      onChange={(e) =>
                        setInitials(e.target.value.toUpperCase())
                      }
                    />
                  </label>
                </>
              )}
              <h3>Intended systems</h3>
              <p className="muted">
                Select at least one. This records intent; it does not update a
                released machine configuration.
              </p>
              <div className="pdm-link-choices">
                {systems.map((p) => (
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
              {!systems.length && (
                <p className="form-error">
                  Create an active system before starting this change.
                </p>
              )}
              <label>
                Proposed change
                <textarea
                  required
                  rows={4}
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What will change and why?"
                />
              </label>
            </fieldset>
          )}
        </div>
        <div className="modal-footer">
          <button
            className="button secondary"
            type="button"
            onClick={dismiss}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            className="button primary"
            type="submit"
            disabled={!source || busy || !!stale || !systemIds.length}
          >
            {busy
              ? "Saving…"
              : mode === "Create variant"
                ? "Create variant"
                : "Start revision"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
