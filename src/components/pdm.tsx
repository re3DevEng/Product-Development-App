"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Box, Search, X, Pencil } from "lucide-react";
import type { AppState } from "@/lib/domain";
import {
  blankPdm,
  createPdmForChange,
  updatePdm,
  pdmFields,
  PDM_KINDS,
  PDM_PURPOSES,
  type PdmItem,
  type PdmFields,
} from "@/lib/pdm";
import { Modal, SelectionButtons } from "./shared-ui";
import { DrawingsSection } from "./drawings";
import { ModelRevisionHistory } from "./part-changes";
type Commit = (change: (state: AppState) => AppState) => Promise<void>;

export function PdmLibrary({
  state,
  open,
}: {
  state: AppState;
  open: (id: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [kind, setKind] = useState("All");
  const [sort, setSort] = useState("Recent");
  const items = state.pdmItems
    .filter(
      (p) =>
        (kind === "All" || p.kind === kind) &&
        `${p.number} ${p.odooNumber} ${p.name} ${p.owner}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Name"
        ? a.name.localeCompare(b.name)
        : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <section className="features-panel pdm-library" aria-label="PDM library">
      <div className="panel-top">
        <div className="panel-title">
          <h2>Parts & assemblies</h2>
          <span className="count-pill">{state.pdmItems.length}</span>
        </div>
      </div>
      <p className="pdm-notice">
        Browse parts and assemblies here. Create new ones from an active ECR or
        OCR's Parts & assemblies section. These records are drafts, saved in
        this browser; controlled files and releases are not connected yet.
      </p>
      <div className="filterbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search PDM"
            placeholder="Search names, internal IDs, Odoo numbers…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
      </div>
      <div className="pdm-toolbar">
        <SelectionButtons
          compact
          label="Record type"
          value={kind}
          options={["All", ...PDM_KINDS]}
          onChange={setKind}
        />
        <SelectionButtons
          compact
          label="Sort by"
          value={sort}
          options={["Recent", "Name"]}
          onChange={setSort}
        />
      </div>
      {items.length ? (
        <div className="pdm-list">
          {items.map((p) => (
            <button className="pdm-row" key={p.id} onClick={() => open(p.id)}>
              <Box size={21} />
              <span className="pdm-row-main">
                <span className="pdm-number">
                  {p.number}
                  {p.odooNumber && ` · Odoo ${p.odooNumber}`}
                </span>
                <strong>{p.name}</strong>
                <small>
                  {p.kind} · {p.owner || "Unassigned"} · {p.purpose}
                </small>
              </span>
              <span className="pdm-row-status">
                Draft<small>Rev{p.workingRevision}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <Box size={32} />
          <h3>
            {state.pdmItems.length
              ? "No matching parts"
              : "No parts or assemblies yet"}
          </h3>
          <p>
            {state.pdmItems.length
              ? "Try another name or number, or clear your filters."
              : "Open an active ECR or OCR and select New part / assembly. It will appear here automatically."}
          </p>
          {state.pdmItems.length > 0 && (
            <button
              className="button secondary"
              onClick={() => {
                setSearch("");
                setKind("All");
              }}
            >
              Clear filters
            </button>
          )}
        </div>
      )}
      <div className="result-count" aria-live="polite">
        Showing {items.length} of {state.pdmItems.length} records
      </div>
    </section>
  );
}

export function PdmDialog({
  item,
  state,
  commit,
  close,
  created,
  openFeature,
  sourceFeatureId,
  openPart,
  initialRevisionId,
}: {
  item?: PdmItem;
  state: AppState;
  commit: Commit;
  close: () => void;
  created: (id: string) => void;
  openFeature: (id: string) => void;
  sourceFeatureId?: string;
  openPart: (id: string, revisionId?: string) => void;
  initialRevisionId?: string;
}) {
  const source = state.features.find((f) => f.id === sourceFeatureId);
  const initialFields = () => ({
    ...blankPdm(),
    featureIds: sourceFeatureId ? [sourceFeatureId] : [],
  });
  const [base, setBase] = useState(item);
  const [fields, setFields] = useState(() =>
    item ? pdmFields(item) : initialFields(),
  );
  const [initials, setInitials] = useState("");
  const [editing, setEditing] = useState(!item);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [tab, setTab] = useState(initialRevisionId ? "Revisions" : "Overview");
  const [linkSearch, setLinkSearch] = useState("");
  const dirty =
    editing &&
    (JSON.stringify(fields) !==
      JSON.stringify(base ? pdmFields(base) : initialFields()) ||
      (!base && !!initials));
  const stale = !!base && base.revision !== item?.revision;
  useEffect(() => {
    if (!editing && item) {
      setBase(item);
      setFields(pdmFields(item));
    }
  }, [item, editing]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty]);
  const dismiss = () => {
    if (!busy && (!dirty || window.confirm("Discard your unsaved changes?")))
      close();
  };
  const set = <K extends keyof PdmFields>(key: K, value: PdmFields[K]) =>
    setFields((f) => ({ ...f, [key]: value }));
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    let id = "";
    try {
      await commit((s) => {
        if (base) return updatePdm(s, base.id, base.revision, fields);
        const result = createPdmForChange(
          s,
          sourceFeatureId ?? "",
          fields,
          initials,
        );
        id = result.item.id;
        return result.state;
      });
      setEditing(false);
      if (id) created(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const links = state.features.filter(
    (f) =>
      f.workType !== "Unassigned" &&
      `${f.number} ${f.title} ${f.workType}`
        .toLowerCase()
        .includes(linkSearch.toLowerCase()),
  );
  return (
    <Modal
      label={base ? `PDM record ${base.number}` : "New PDM record"}
      wide
      onClose={dismiss}
    >
      <div className="pdm-dialog-heading">
        <div>
          <span className="pdm-number">{base?.number || "NEW PDM RECORD"}</span>
          <h2>{base?.name || "New part or assembly"}</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close PDM record"
          onClick={dismiss}
          disabled={busy}
        >
          <X size={20} />
        </button>
      </div>
      {!editing && base && (
        <div className="pdm-toolbar">
          <div className="project-tabs">
            {["Overview", "Revisions", "Drawings", "Activity"].map((t) => (
              <button
                key={t}
                className={tab === t ? "active" : ""}
                onClick={() => setTab(t)}
              >
                {t}
              </button>
            ))}
          </div>
          <button className="button secondary" onClick={() => setEditing(true)}>
            <Pencil size={14} />
            Edit record
          </button>
        </div>
      )}
      <div className="project-body">
        {!base && source && (
          <p className="pdm-notice">
            Creating for{" "}
            <strong>
              {source.workType} {source.number} · {source.title}
            </strong>
            . The new record will be linked automatically. After saving, you
            will return to this change.
          </p>
        )}
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {stale && editing && (
          <p className="form-error" role="alert">
            This record changed elsewhere. Discard edits to load the current
            record.
          </p>
        )}
        {editing ? (
          <form id="pdm-form" className="project-form" onSubmit={save}>
            <fieldset disabled={busy || stale}>
              <SelectionButtons
                label="Record type"
                value={fields.kind}
                options={PDM_KINDS}
                onChange={(v) => set("kind", v as PdmFields["kind"])}
              />
              <label>
                Part / assembly name
                <input
                  required
                  maxLength={180}
                  value={fields.name}
                  onChange={(e) => set("name", e.target.value)}
                  placeholder="Name, including Ops modifiers when assigned"
                />
              </label>
              <label>
                Description
                <textarea
                  rows={3}
                  value={fields.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What this item is and why it is needed"
                />
              </label>
              {!base && (
                <label>
                  Creator initials
                  <input
                    required
                    minLength={2}
                    maxLength={5}
                    pattern="[A-Za-z]{2,5}"
                    value={initials}
                    onChange={(e) => setInitials(e.target.value.toUpperCase())}
                    placeholder="e.g. DC"
                  />
                  <small>
                    The app assigns the next available number. The internal ID
                    stays with this record.
                  </small>
                </label>
              )}
              <SelectionButtons
                label="Intended use"
                value={fields.purpose}
                options={PDM_PURPOSES}
                onChange={(v) => set("purpose", v as PdmFields["purpose"])}
              />
              <div className="project-field-grid">
                <label>
                  Owner
                  <select
                    value={fields.owner}
                    onChange={(e) => set("owner", e.target.value)}
                  >
                    <option value="">Unassigned</option>
                    {[
                      ...new Set([
                        ...state.members,
                        ...(fields.owner ? [fields.owner] : []),
                      ]),
                    ].map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Odoo part number
                  <input
                    inputMode="numeric"
                    pattern="[0-9]{1,30}"
                    value={fields.odooNumber}
                    onChange={(e) => set("odooNumber", e.target.value)}
                    placeholder="Pending Ops assignment"
                  />
                </label>
              </div>
              <p className="muted">
                Enter an Odoo number only after Ops assigns it. Verify the name
                against Odoo; this prototype does not connect to Odoo.
              </p>
              {base && (
                <>
                  <h3>Linked ECRs / OCRs</h3>
                  <p className="muted">
                    Links identify related development work. They do not approve
                    or release the part.
                  </p>
                  <label>
                    Find a change
                    <input
                      value={linkSearch}
                      onChange={(e) => setLinkSearch(e.target.value)}
                      placeholder="Search ECR / OCR number or title"
                    />
                  </label>
                  <div className="pdm-link-choices">
                    {links.map((f) => (
                      <label key={f.id}>
                        <input
                          type="checkbox"
                          checked={fields.featureIds.includes(f.id)}
                          onChange={(e) =>
                            set(
                              "featureIds",
                              e.target.checked
                                ? [...fields.featureIds, f.id]
                                : fields.featureIds.filter((id) => id !== f.id),
                            )
                          }
                        />
                        <span>
                          {f.workType} {f.number} · {f.title}
                          <small>{f.status}</small>
                        </span>
                      </label>
                    ))}
                    {!links.length && (
                      <p className="muted">
                        No matching ECRs or OCRs. Assign a feature's work type
                        first.
                      </p>
                    )}
                  </div>
                </>
              )}
            </fieldset>
          </form>
        ) : (
          base &&
          (tab === "Revisions" ? (
            <ModelRevisionHistory
              item={item ?? base}
              state={state}
              open={openPart}
              selectedRevisionId={initialRevisionId}
            />
          ) : tab === "Drawings" ? (
            <DrawingsSection item={item ?? base} commit={commit} />
          ) : tab === "Activity" ? (
            <div className="pdm-activity">
              {base.activity.map((a) => (
                <article key={a.id}>
                  <p>{a.summary}</p>
                  <small>
                    {a.actor} · {new Date(a.at).toLocaleString()}
                  </small>
                </article>
              ))}
            </div>
          ) : (
            <>
              {base.description && (
                <p className="pdm-description">{base.description}</p>
              )}
              <dl className="pdm-summary">
                <div>
                  <dt>Internal ID</dt>
                  <dd>{base.number}</dd>
                </div>
                <div>
                  <dt>Latest working revision</dt>
                  <dd>Rev{base.workingRevision} · Draft</dd>
                </div>
                <div>
                  <dt>Odoo number</dt>
                  <dd>
                    {base.odooNumber ||
                      (base.purpose === "Production"
                        ? "Pending Ops"
                        : "Not assigned")}
                  </dd>
                </div>
                <div>
                  <dt>Record type</dt>
                  <dd>{base.kind}</dd>
                </div>
                <div>
                  <dt>Owner</dt>
                  <dd>{base.owner || "Unassigned"}</dd>
                </div>
                <div>
                  <dt>Intended use</dt>
                  <dd>{base.purpose}</dd>
                </div>
              </dl>
              <section className="overview-section">
                <h3>Linked ECRs / OCRs</h3>
                {base.featureIds.length ? (
                  <div className="pdm-related">
                    {state.features
                      .filter((f) => base.featureIds.includes(f.id))
                      .map((f) => (
                        <button
                          className="button secondary"
                          key={f.id}
                          onClick={() => openFeature(f.id)}
                        >
                          {f.workType} {f.number} · {f.title}
                        </button>
                      ))}
                  </div>
                ) : (
                  <p className="muted">
                    No changes linked. Use Edit record to connect development
                    work.
                  </p>
                )}
              </section>
              <section className="overview-section">
                <div className="overview-section-heading">
                  <h3>
                    Drawings <span>{base.drawings.length}</span>
                  </h3>
                  <button
                    className="text-button"
                    onClick={() => setTab("Drawings")}
                  >
                    View drawings
                  </button>
                </div>
                <p className="muted">
                  Track Machining, Inspection, and Assembly drawings with their
                  own working versions and requirements.
                </p>
              </section>
              <section className="overview-section">
                <h3>Files & release</h3>
                <p className="muted">
                  This record is not released. Controlled CAD files, Engineering
                  approvals, and system configurations will be added in the next
                  stages.
                </p>
              </section>
            </>
          ))
        )}
      </div>
      {editing && (
        <div className="pdm-dialog-footer">
          <button
            className="button secondary"
            disabled={busy}
            onClick={() => {
              if (!base) {
                dismiss();
                return;
              }
              setFields(pdmFields(item!));
              setBase(item);
              setEditing(false);
              setError("");
            }}
          >
            {" "}
            {base ? "Discard changes" : "Cancel"}
          </button>
          <button
            className="button primary"
            type="submit"
            form="pdm-form"
            disabled={busy || stale || (!!base && !dirty)}
          >
            {busy ? "Saving…" : base ? "Save changes" : "Create record"}
          </button>
        </div>
      )}
    </Modal>
  );
}
