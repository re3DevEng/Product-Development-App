"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Plus, X } from "lucide-react";
import type { AppState, Feature } from "@/lib/domain";
import type { PdmItem } from "@/lib/pdm";
import { startPartChange } from "@/lib/part-changes";
import { overlappingChanges, type PartChange } from "@/lib/model-revisions";
import { Modal, SelectionButtons } from "./shared-ui";
type Commit = (change: (state: AppState) => AppState) => Promise<void>;

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
      {changes.map((c) => (
        <ChangeCard key={c.id} change={c} state={state} open={open} />
      ))}
      <div className="pdm-related">
        {linked.map((p) => (
          <button
            className="button secondary"
            key={p.id}
            onClick={() => open(p.id)}
          >
            {p.number} · {p.name}
          </button>
        ))}
      </div>
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
}: {
  change: PartChange;
  state: AppState;
  open: (id: string, revisionId?: string) => void;
}) {
  const source = state.pdmItems.find((p) => p.id === c.sourcePartId)!;
  const result = state.pdmItems.find((p) => p.id === c.resultPartId)!;
  const sourceRev = source.modelRevisions.find(
    (r) => r.id === c.sourceRevisionId,
  )!;
  const resultRev = result.modelRevisions.find(
    (r) => r.id === c.resultRevisionId,
  )!;
  const overlaps = overlappingChanges(state, c);
  return (
    <article className="drawing-card">
      <h4>
        {c.mode} · Draft Rev{resultRev.label}
      </h4>
      <p>
        <button
          className="text-button"
          onClick={() => open(source.id, sourceRev.id)}
        >
          {source.number} Rev{sourceRev.label}
        </button>{" "}
        →{" "}
        <button
          className="text-button"
          onClick={() => open(result.id, resultRev.id)}
        >
          {result.number} Rev{resultRev.label}
        </button>
      </p>
      <p className="drawing-notes">{c.notes}</p>
      <p className="muted">
        Intended systems:{" "}
        {c.systemIds
          .map((id) => {
            const p = state.projects.find((p) => p.id === id)!;
            return `${p.number} · ${p.title}`;
          })
          .join(", ") ||
          "No target systems remain; choose targets before release."}
      </p>
      <p className="muted">Ops numbering decision pending · Not released</p>
      {!!overlaps.length && (
        <p className="pdm-notice" role="status">
          Reconciliation required before release: this source part is also being
          changed in{" "}
          {[
            ...new Set(
              overlaps.map((o) => {
                const f = state.features.find((f) => f.id === o.featureId)!;
                return `${f.workType} ${f.number}`;
              }),
            ),
          ].join(", ")}
          . Confirm the designs, target systems, and Ops numbering decision.
        </p>
      )}
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
      <h3>Model revisions</h3>
      <p className="muted">
        Draft development records only. Source revisions are preserved; CAD
        files and release publication are not connected.
      </p>
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
          return (
            <article
              className={`drawing-card ${r.id === selectedRevisionId ? "selected-model-revision" : ""}`}
              key={r.id}
            >
              {r.id === selectedRevisionId && (
                <p className="muted">Selected source / result revision</p>
              )}
              <h4>
                Rev{r.label} · {r.status}
              </h4>
              <p className="drawing-notes">{r.notes}</p>
              <p className="muted">
                {new Date(r.createdAt).toLocaleString()}
                {feature ? ` · ${feature.workType} ${feature.number}` : ""}
              </p>
              {change && (
                <ChangeCard change={change} state={state} open={open} />
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
                        setSource(p);
                        setRevisionId(
                          p.modelRevisions[p.modelRevisions.length - 1].id,
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
                      Rev{r.label} · {r.status}
                    </option>
                  ))}
                </select>
              </label>
              <p className="muted">
                The source is a draft, not a released baseline. Its revision
                record and existing drawing versions will be preserved.
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
                  Another ECR/OCR is changing this source part. You can
                  continue, but the designs and Ops numbering decision must be
                  reconciled before either release.
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
                  ? `Keep ${source.number} and create working Rev0.${source.modelRevisions.length + 1}. Ops must confirm the final part-number treatment.`
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
