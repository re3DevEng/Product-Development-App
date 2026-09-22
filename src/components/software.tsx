"use client";
import { useEffect, useState, type FormEvent } from "react";
import { Code2, Plus, X, ExternalLink, Search, ListFilter } from "lucide-react";
import type { AppState } from "@/lib/domain";
import { PRIORITIES } from "@/lib/domain";
import {
  addSoftwareDocument,
  blankSoftware,
  changeSoftwareStatus,
  createSoftware,
  linkSoftwareFeature,
  linkSoftwareSystem,
  softwareActions,
  softwareFields,
  updateSoftware,
  SOFTWARE_TYPES,
  SOFTWARE_STAGES,
  softwareProgress,
  type Software,
  type SoftwareFields,
  type SoftwareStatus,
} from "@/lib/software";
import { Modal, SelectionButtons } from "./shared-ui";
import { StatusBadge, PriorityBadge, Avatars } from "./record-badges";
type Commit = (change: (state: AppState) => AppState) => Promise<void>;

export function SoftwareList({
  state,
  type,
  open,
  create,
}: {
  state: AppState;
  type?: SoftwareFields["type"];
  open: (id: string) => void;
  create: () => void;
}) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState("All types");
  const [status, setStatus] = useState("All active");

  const [owner, setOwner] = useState("");
  const [application, setApplication] = useState("");
  const [sort, setSort] = useState("Recent");

  const filterCount = [
    !type && selectedType !== "All types",
    status !== "All active",
    !!owner,
    !!application,
  ].filter(Boolean).length;
  const base = state.software.filter(
    (s) =>
      ["Request", "In work", "Testing"].includes(s.status) &&
      (!type || s.type === type),
  );
  const clearFilters = () => {
    setSearch("");
    setSelectedType("All types");
    setStatus("All active");

    setOwner("");
    setApplication("");
  };
  const items = base
    .filter(
      (s) =>
        (type || selectedType === "All types" || s.type === selectedType) &&
        (status === "All active" || s.status === status) &&
        (!owner ||
          (owner === "__unassigned__"
            ? !s.owners.length
            : s.owners.includes(owner))) &&
        (!application ||
          (application === "__unspecified__"
            ? !s.application
            : s.application === application)) &&
        `${s.number} ${s.title} ${s.application} ${s.version} ${s.owners.join(" ")}`
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort(
      (a, b) =>
        (sort === "Priority"
          ? PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
          : sort === "Progress"
            ? SOFTWARE_STAGES.findIndex((s) => s === softwareProgress(a)) -
              SOFTWARE_STAGES.findIndex((s) => s === softwareProgress(b))
            : sort === "Title"
              ? a.title.localeCompare(b.title)
              : 0) || b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <section className="features-panel" aria-label="Software workspace">
      <div className="panel-top">
        <div className="panel-title">
          <h2>{type ? `${type}s` : "All active software"}</h2>
          <span className="count-pill">{base.length}</span>
        </div>
        <button className="button primary" onClick={create}>
          <Plus size={16} />
          {type === "Bug report" ? "Report a bug" : "New software request"}
        </button>
      </div>
      <div className="filterbar software-filterbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search software"
            placeholder="Search software, IDs, or people…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              className="clear-search"
              aria-label="Clear search"
              onClick={() => setSearch("")}
            >
              <X size={14} />
            </button>
          )}
        </label>
        <div className="filter-group">
          <ListFilter size={16} className="filter-icon" />
          {!type && (
            <select
              aria-label="Filter software by type"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option>All types</option>
              {SOFTWARE_TYPES.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          )}{" "}
          <select
            aria-label="Filter software by owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            <option value="">All owners</option>
            <option value="__unassigned__">Unassigned</option>
            {[...new Set([...state.members, ...base.flatMap((s) => s.owners)])]
              .sort()
              .map((o) => (
                <option key={o} value={o}>
                  {o}
                </option>
              ))}
          </select>
          <select
            aria-label="Filter software by application"
            value={application}
            onChange={(e) => setApplication(e.target.value)}
          >
            <option value="">All applications</option>
            <option value="__unspecified__">Not specified</option>
            {[...new Set(base.map((s) => s.application).filter(Boolean))]
              .sort()
              .map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
          </select>
        </div>
      </div>
      <div className="list-toolbar">
        <div className="segmented" role="group" aria-label="Software status">
          {["All active", "Request", "In work", "Testing"].map((s) => (
            <button
              key={s}
              className={status === s ? "active" : ""}
              aria-pressed={status === s}
              onClick={() => setStatus(s)}
            >
              {s === "Request" ? "Requests" : s}
            </button>
          ))}
        </div>
        <div className="sort-label">
          <span>Sort:</span>
          <SelectionButtons
            label="Sort software"
            value={sort}
            onChange={setSort}
            options={["Recent", "Priority", "Progress", "Title"]}
            compact
          />
        </div>
      </div>{" "}
      {items.length ? (
        <div className="table-scroll">
          <table className="feature-table">
            <thead>
              <tr>
                <th>Software</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Owner</th>
                <th>
                  <span className="sr-only">Open software</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((s) => (
                <tr key={s.id}>
                  <td>
                    <button className="feature-link" onClick={() => open(s.id)}>
                      <span className="feature-meta">
                        <span className="feature-number">{s.number}</span>
                        <span className="type-tag">{s.type}</span>
                      </span>
                      <strong>{s.title}</strong>
                      <span className="product-line">
                        {s.application || "Component not specified"}
                        {s.version ? ` · ${s.version}` : ""}
                      </span>
                    </button>
                  </td>
                  <td>
                    <StatusBadge status={s.status} />
                  </td>
                  <td>
                    <PriorityBadge priority={s.priority} />
                  </td>
                  <td>
                    <Avatars owners={s.owners} />
                  </td>
                  <td>
                    <button
                      className="icon-button row-arrow"
                      aria-label={`Open ${s.title}`}
                      onClick={() => open(s.id)}
                    >
                      →
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <Code2 size={30} />
          <h3>
            {base.length
              ? "No matching software items"
              : "No software items here yet"}
          </h3>
          <p>
            {base.length
              ? "Try a different search or clear your filters."
              : "Create a change request or bug report to start tracking software work."}
          </p>
          {base.length > 0 && (
            <button className="button secondary" onClick={clearFilters}>
              Clear filters
            </button>
          )}
        </div>
      )}
      <div className="software-list-footer result-count">
        <span aria-live="polite">
          Showing {items.length} of {base.length} software items
        </span>
        {(filterCount > 0 || search) && (
          <button className="text-button" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>{" "}
    </section>
  );
}

export function LinkedSoftware({
  state,
  featureId,
  systemId,
  open,
  commit,
}: {
  state: AppState;
  featureId?: string;
  systemId?: string;
  open: (id: string) => void;
  commit: Commit;
}) {
  const [manage, setManage] = useState(false),
    [search, setSearch] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const linked = state.software.filter((s) =>
    featureId
      ? s.featureLinks.some((l) => l.featureId === featureId)
      : s.systemIds.includes(systemId!),
  );
  async function link(s: Software, required: boolean | null) {
    setBusy(true);
    setError("");
    try {
      await commit((state) =>
        featureId
          ? linkSoftwareFeature(state, s.id, s.revision, featureId, required)
          : linkSoftwareSystem(
              state,
              s.id,
              s.revision,
              systemId!,
              required !== null,
            ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="overview-section">
      <div className="overview-section-heading">
        <h3>
          Linked software <span>{linked.length}</span>
        </h3>
        <button className="text-button" onClick={() => setManage(!manage)}>
          {manage ? "Done linking" : "Manage links"}
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {!linked.length && <p>No software linked yet.</p>}
      <ul className="project-linked-list">
        {linked.map((s) => {
          const required = s.featureLinks.find(
            (l) => l.featureId === featureId,
          )?.required;
          return (
            <li key={s.id}>
              <button
                className="project-feature-link"
                onClick={() => open(s.id)}
              >
                <small>
                  {s.number} · {s.type} · {s.status}
                </small>
                <strong>{s.title}</strong>
                {featureId && (
                  <span>
                    {required
                      ? s.status === "Complete"
                        ? "Required for completion · Complete"
                        : "Required for completion · Unfinished"
                      : "Related"}
                  </span>
                )}
              </button>
              {manage && (
                <div className="software-link-actions">
                  {featureId && (
                    <button
                      className="text-button"
                      disabled={busy}
                      onClick={() => void link(s, !required)}
                    >
                      {required ? "Make related" : "Make required"}
                    </button>
                  )}
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => void link(s, null)}
                  >
                    Unlink
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {manage && (
        <div className="project-link-picker">
          <p className="project-help">
            {featureId
              ? "Required software must be Complete before this feature can be completed. Related software does not block completion."
              : "Link software to this system without duplicating its record."}
          </p>
          <label>
            Find software
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          {state.software
            .filter(
              (s) =>
                !linked.some((l) => l.id === s.id) &&
                `${s.number} ${s.title}`
                  .toLowerCase()
                  .includes(search.toLowerCase()),
            )
            .slice(0, 20)
            .map((s) => (
              <div className="software-link-option" key={s.id}>
                <span>
                  {s.number} · {s.title}
                </span>
                <div className="software-link-actions">
                  <button
                    className="button secondary"
                    disabled={busy}
                    onClick={() => void link(s, false)}
                  >
                    {featureId ? "Link as related" : "Link"}
                  </button>
                  {featureId && (
                    <button
                      className="button secondary"
                      disabled={busy}
                      onClick={() => void link(s, true)}
                    >
                      Link as required
                    </button>
                  )}
                </div>
              </div>
            ))}
          <p className="field-hint">
            Up to 20 matches. Create new records in Software, then link them
            here.
          </p>
        </div>
      )}
    </section>
  );
}

export function SoftwareDialog({
  item,
  initialType,
  state,
  commit,
  close,
  created,
  openFeature,
  openSystem,
}: {
  item?: Software;
  initialType: SoftwareFields["type"];
  state: AppState;
  commit: Commit;
  close: () => void;
  created: (id: string) => void;
  openFeature: (id: string) => void;
  openSystem: (id: string) => void;
}) {
  const [base, setBase] = useState(item),
    [editing, setEditing] = useState(!item),
    [fields, setFields] = useState(() =>
      item ? softwareFields(item) : blankSoftware(initialType),
    );
  const [progress, setProgress] = useState<SoftwareStatus>(
    item?.status ?? "Request",
  );
  const [tab, setTab] = useState("Overview"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [docTitle, setDocTitle] = useState(""),
    [docUrl, setDocUrl] = useState(""),
    [docRevision, setDocRevision] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const dirty =
    editing &&
    (progress !== (base?.status ?? "Request") ||
      JSON.stringify(fields) !==
        JSON.stringify(
          base ? softwareFields(base) : blankSoftware(initialType),
        ));
  const pending = dirty || !!docTitle || !!docUrl;
  const stale = !!base && base.revision !== item?.revision;
  useEffect(() => {
    if (!editing && item) {
      setBase(item);
      setFields(softwareFields(item));
      setProgress(item.status);
    }
  }, [item, editing]);
  useEffect(() => {
    if (!pending) return;
    const prevent = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [pending]);
  const dismiss = () => {
    if (
      !busy &&
      (!pending || window.confirm("Discard the changes you haven’t saved?"))
    )
      close();
  };
  const set = <K extends keyof SoftwareFields>(
    key: K,
    value: SoftwareFields[K],
  ) => setFields((f) => ({ ...f, [key]: value }));
  async function run(change: (s: AppState) => AppState, done?: () => void) {
    setBusy(true);
    setError("");
    try {
      await commit(change);
      done?.();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function save(e: FormEvent) {
    e.preventDefault();
    let id = "";
    void run(
      (s) => {
        if (base) {
          const updated = updateSoftware(s, base.id, base.revision, fields);
          return progress === base.status
            ? updated
            : changeSoftwareStatus(
                updated,
                base.id,
                updated.software.find((v) => v.id === base.id)!.revision,
                progress,
              );
        }
        const r = createSoftware(s, fields);
        id = r.item.id;
        return r.state;
      },
      () => {
        setEditing(false);
        if (id) created(id);
      },
    );
  }
  return (
    <Modal
      wide
      label={base ? `Software ${base.number}` : "New software item"}
      onClose={dismiss}
    >
      <div className="drawer-heading">
        <div>
          <div className="eyebrow">
            {base?.number ?? "SOFTWARE DEVELOPMENT"}
          </div>
          <h2>{base?.title ?? "New software item"}</h2>
          <p>{base?.type ?? "Capture a software change or a bug."}</p>
        </div>
        <button
          className="icon-button"
          aria-label="Close software"
          onClick={dismiss}
        >
          <X size={21} />
        </button>
      </div>
      {base && (
        <div className="feature-view-toolbar">
          <StatusBadge status={base.status} />
          {!editing && (
            <button
              className="button primary"
              disabled={docRevision !== null}
              onClick={() => {
                setEditing(true);
                setError("");
              }}
            >
              Edit software
            </button>
          )}
        </div>
      )}
      {editing && base && (
        <section className="feature-lifecycle">
          <div className="lifecycle-actions">
            {softwareActions(base)
              .filter(
                (a) =>
                  a.label === "Restore" ||
                  !["In work", "Testing"].includes(a.status),
              )
              .map((a) => (
                <button
                  className="button secondary"
                  key={a.label}
                  disabled={busy || stale || pending}
                  onClick={() =>
                    void run(
                      (s) =>
                        changeSoftwareStatus(
                          s,
                          base.id,
                          base.revision,
                          a.status,
                        ),
                      () => setEditing(false),
                    )
                  }
                >
                  {a.label}
                </button>
              ))}
          </div>
          <p className="lifecycle-hint">
            Save or discard edits before changing status. Linked features and
            systems keep their own status.
          </p>
        </section>
      )}
      {!editing && base && (
        <div className="project-tabs">
          {["Overview", "Linked work", "Documents", "Activity"].map((t) => (
            <button
              key={t}
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
            >
              {t}
            </button>
          ))}
        </div>
      )}
      <div className="project-body">
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {editing ? (
          <form id="software-form" className="project-form" onSubmit={save}>
            <fieldset disabled={busy || stale}>
              {base &&
                ["Request", "In work", "Testing"].includes(base.status) && (
                  <SelectionButtons
                    label="Software progress"
                    value={progress}
                    options={["Request", "In work", "Testing"]}
                    disabledOptions={["Request", "In work", "Testing"].filter(
                      (status) =>
                        status !== base.status &&
                        !softwareActions(base).some((a) => a.status === status),
                    )}
                    onChange={(value) => setProgress(value as SoftwareStatus)}
                  />
                )}

              {stale && (
                <p role="alert">
                  This item changed elsewhere. Discard edits to load the latest
                  version.
                </p>
              )}
              <SelectionButtons
                label="Software type"
                value={fields.type}
                options={SOFTWARE_TYPES}
                onChange={(v) => set("type", v as SoftwareFields["type"])}
              />
              <label>
                Title
                <input
                  required
                  maxLength={140}
                  value={fields.title}
                  onChange={(e) => set("title", e.target.value)}
                />
              </label>
              <label>
                Description
                <textarea
                  required
                  rows={4}
                  value={fields.description}
                  onChange={(e) => set("description", e.target.value)}
                />
              </label>
              <div className="project-field-grid">
                <label>
                  Application / component
                  <input
                    value={fields.application}
                    onChange={(e) => set("application", e.target.value)}
                  />
                </label>
                <label>
                  Version (optional)
                  <input
                    value={fields.version}
                    onChange={(e) => set("version", e.target.value)}
                  />
                </label>
              </div>
              {fields.type === "Bug report" && (
                <>
                  {(
                    [
                      ["steps", "Steps to reproduce"],
                      ["expected", "Expected behavior"],
                      ["actual", "Actual behavior"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key}>
                      {label}
                      <textarea
                        rows={3}
                        value={fields[key]}
                        onChange={(e) => set(key, e.target.value)}
                      />
                    </label>
                  ))}
                </>
              )}
              <SelectionButtons
                label="Priority"
                value={fields.priority}
                options={PRIORITIES}
                onChange={(v) =>
                  set("priority", v as SoftwareFields["priority"])
                }
              />
              <fieldset className="project-owners">
                <legend>Owners</legend>
                {[...new Set([...state.members, ...fields.owners])].map((o) => (
                  <label key={o}>
                    <input
                      type="checkbox"
                      checked={fields.owners.includes(o)}
                      onChange={(e) =>
                        set(
                          "owners",
                          e.target.checked
                            ? [...fields.owners, o]
                            : fields.owners.filter((n) => n !== o),
                        )
                      }
                    />
                    {o}
                  </label>
                ))}
              </fieldset>
            </fieldset>
          </form>
        ) : (
          base && (
            <>
              {tab === "Overview" && (
                <>
                  <section className="overview-section overview-introduction">
                    <h3>Description</h3>
                    <p className="overview-description">{base.description}</p>
                  </section>
                  <dl className="overview-grid">
                    <div>
                      <dt>Type</dt>
                      <dd>{base.type}</dd>
                    </div>
                    <div>
                      <dt>Priority</dt>
                      <dd>
                        <PriorityBadge priority={base.priority} />
                      </dd>
                    </div>
                    <div className="overview-wide">
                      <dt>Owners</dt>
                      <dd>{base.owners.join(", ") || "Unassigned"}</dd>
                    </div>
                    <div>
                      <dt>Application / component</dt>
                      <dd>{base.application || "Not set"}</dd>
                    </div>
                    <div>
                      <dt>Version</dt>
                      <dd>{base.version || "Not set"}</dd>
                    </div>
                  </dl>
                  {base.type === "Bug report" &&
                    (["steps", "expected", "actual"] as const).map((k) => (
                      <section className="overview-section" key={k}>
                        <h3>
                          {k === "steps"
                            ? "Steps to reproduce"
                            : k === "expected"
                              ? "Expected behavior"
                              : "Actual behavior"}
                        </h3>
                        <p className="overview-description">
                          {base[k] || "Not provided"}
                        </p>
                      </section>
                    ))}
                  <section className="overview-section">
                    <h3>Connected work</h3>
                    <p>
                      {base.featureLinks.length} features ·{" "}
                      {base.systemIds.length} systems · {base.documents.length}{" "}
                      documents
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => setTab("Linked work")}
                    >
                      View linked work
                    </button>
                  </section>
                </>
              )}
              {tab === "Linked work" && (
                <>
                  <h3>Linked features</h3>
                  <p className="project-help">
                    Required links block feature completion until this software
                    is Complete. Related links provide context.
                  </p>
                  <ul className="project-linked-list">
                    {base.featureLinks.map((l) => {
                      const f = state.features.find(
                        (f) => f.id === l.featureId,
                      )!;
                      return (
                        <li key={f.id}>
                          <button
                            className="project-feature-link"
                            onClick={() => {
                              if (
                                !pending ||
                                window.confirm(
                                  "Discard the changes you haven’t saved?",
                                )
                              )
                                openFeature(f.id);
                            }}
                          >
                            <small>
                              {f.number} · {f.status}
                            </small>
                            <strong>{f.title}</strong>
                            <span>
                              {l.required
                                ? "Required for completion"
                                : "Related"}
                            </span>
                          </button>
                          <div className="software-link-actions">
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void run((s) =>
                                  linkSoftwareFeature(
                                    s,
                                    base.id,
                                    base.revision,
                                    f.id,
                                    !l.required,
                                  ),
                                )
                              }
                            >
                              {l.required ? "Make related" : "Make required"}
                            </button>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void run((s) =>
                                  linkSoftwareFeature(
                                    s,
                                    base.id,
                                    base.revision,
                                    f.id,
                                    null,
                                  ),
                                )
                              }
                            >
                              Unlink
                            </button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                  <div className="project-link-picker">
                    <label>
                      Find a feature or system
                      <input
                        type="search"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </label>
                    <h3>Link a feature</h3>
                    {state.features
                      .filter(
                        (f) =>
                          !base.featureLinks.some(
                            (l) => l.featureId === f.id,
                          ) &&
                          `${f.number} ${f.title}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .slice(0, 20)
                      .map((f) => (
                        <div className="software-link-option" key={f.id}>
                          <span>
                            {f.number} · {f.title}
                          </span>
                          <div className="software-link-actions">
                            <button
                              className="button secondary"
                              disabled={busy}
                              onClick={() =>
                                void run((s) =>
                                  linkSoftwareFeature(
                                    s,
                                    base.id,
                                    base.revision,
                                    f.id,
                                    false,
                                  ),
                                )
                              }
                            >
                              Link as related
                            </button>
                            <button
                              className="button secondary"
                              disabled={busy}
                              onClick={() =>
                                void run((s) =>
                                  linkSoftwareFeature(
                                    s,
                                    base.id,
                                    base.revision,
                                    f.id,
                                    true,
                                  ),
                                )
                              }
                            >
                              Link as required
                            </button>
                          </div>
                        </div>
                      ))}
                  </div>
                  <section className="overview-section">
                    <h3>Linked systems</h3>
                    <ul className="project-linked-list">
                      {base.systemIds.map((id) => {
                        const p = state.projects.find((p) => p.id === id)!;
                        return (
                          <li key={id}>
                            <button
                              className="project-feature-link"
                              onClick={() => {
                                if (
                                  !pending ||
                                  window.confirm(
                                    "Discard the changes you haven’t saved?",
                                  )
                                )
                                  openSystem(id);
                              }}
                            >
                              <small>{p.number}</small>
                              <strong>{p.title}</strong>
                            </button>
                            <button
                              className="text-button"
                              disabled={busy}
                              onClick={() =>
                                void run((s) =>
                                  linkSoftwareSystem(
                                    s,
                                    base.id,
                                    base.revision,
                                    id,
                                    false,
                                  ),
                                )
                              }
                            >
                              Unlink
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                    {state.projects
                      .filter(
                        (p) =>
                          !base.systemIds.includes(p.id) &&
                          `${p.number} ${p.title}`
                            .toLowerCase()
                            .includes(search.toLowerCase()),
                      )
                      .slice(0, 20)
                      .map((p) => (
                        <div className="software-link-option" key={p.id}>
                          <span>
                            {p.number} · {p.title}
                          </span>
                          <button
                            className="button secondary"
                            disabled={busy}
                            onClick={() =>
                              void run((s) =>
                                linkSoftwareSystem(
                                  s,
                                  base.id,
                                  base.revision,
                                  p.id,
                                  true,
                                ),
                              )
                            }
                          >
                            Link system
                          </button>
                        </div>
                      ))}
                  </section>
                  <p className="field-hint">
                    Showing up to 20 matches per type. Use search to narrow the
                    list.
                  </p>
                </>
              )}
              {tab === "Documents" && (
                <>
                  <h3>Software documents</h3>
                  <p className="project-help">
                    Link Google Drive files for specifications or testing
                    evidence. Files stay in Drive; access is not verified.
                  </p>
                  <div className="document-list">
                    {base.documents.map((d) => (
                      <a
                        className="document-item"
                        key={d.id}
                        href={d.url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <strong>{d.title}</strong>
                        <ExternalLink size={16} />
                      </a>
                    ))}
                  </div>
                  {docRevision === null ? (
                    <button
                      className="button secondary"
                      onClick={() => setDocRevision(base.revision)}
                    >
                      Link a Google Drive file
                    </button>
                  ) : (
                    <form
                      className="link-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(
                          (s) =>
                            addSoftwareDocument(
                              s,
                              base.id,
                              docRevision,
                              docTitle,
                              docUrl,
                            ),
                          () => {
                            setDocRevision(null);
                            setDocTitle("");
                            setDocUrl("");
                          },
                        );
                      }}
                    >
                      <label className="field">
                        <span>Document name</span>
                        <input
                          required
                          value={docTitle}
                          onChange={(e) => setDocTitle(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Google Drive file link</span>
                        <input
                          required
                          type="url"
                          value={docUrl}
                          onChange={(e) => setDocUrl(e.target.value)}
                        />
                      </label>
                      {docRevision !== item?.revision && (
                        <p role="alert">
                          This record changed. Discard this draft and reopen the
                          link form.
                        </p>
                      )}
                      <div className="button-row">
                        <button
                          className="button secondary"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setDocRevision(null);
                            setDocTitle("");
                            setDocUrl("");
                          }}
                        >
                          Discard link
                        </button>
                        <button
                          className="button primary"
                          disabled={busy || docRevision !== item?.revision}
                        >
                          Save document link
                        </button>
                      </div>
                    </form>
                  )}
                </>
              )}
              {tab === "Activity" && (
                <>
                  <h3>Software activity</h3>
                  <ol className="project-activity">
                    {base.activity.map((a) => (
                      <li key={a.id}>
                        <div>
                          <strong>{a.actor}</strong>
                          <time dateTime={a.at}>
                            {new Date(a.at).toLocaleString()}
                          </time>
                        </div>
                        <p>{a.summary}</p>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </>
          )
        )}
      </div>
      <div className="drawer-footer">
        <span>
          {pending
            ? "You have unsaved changes"
            : "Sample data · saved in this browser"}
        </span>
        <div className="button-row">
          {editing && base && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                if (item) {
                  setBase(item);
                  setFields(softwareFields(item));
                  setProgress(item.status);
                }
                setEditing(false);
                setError("");
              }}
            >
              Discard edits
            </button>
          )}
          {editing ? (
            <button
              className="button primary"
              type="submit"
              form="software-form"
              disabled={busy || stale}
            >
              {base ? "Save changes" : "Create software item"}
            </button>
          ) : (
            <button className="button secondary" onClick={dismiss}>
              Close
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
