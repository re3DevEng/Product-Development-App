"use client";
import { useEffect, useState, type FormEvent } from "react";
import {
  Plus,
  X,
  Pencil,
  FolderOpen,
  Archive,
  ArrowRight,
  CheckCheck,
  XCircle,
  Trash2,
  FileText,
  ExternalLink,
  Link2,
} from "lucide-react";
import { type AppState, PRIORITIES } from "@/lib/domain";
import {
  blankProject,
  addProjectDocument,
  changeProjectStatus,
  createProject,
  deleteProject,
  linkProjectFeature,
  projectActions,
  projectFields,
  PROJECT_PHASES,
  PROJECT_TYPES,
  PRODUCT_FAMILIES,
  updateProject,
  type Project,
  type ProjectFields,
  type ProjectStatus,
} from "@/lib/projects";
import { Modal, SelectionButtons } from "./shared-ui";
import { LinkedSoftware } from "./software";
type Commit = (change: (state: AppState) => AppState) => Promise<void>;

export function ProjectsList({
  state,
  open,
  create,
}: {
  state: AppState;
  open: (id: string) => void;
  create: () => void;
}) {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("All types");
  const projects = state.projects
    .filter(
      (p) =>
        (type === "All types" || p.type === type) &&
        p.status === "In work" &&
        [p.number, p.title, p.customer, p.product, p.version, ...p.owners]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return (
    <section
      className="features-panel project-list"
      aria-label="Systems workspace"
    >
      <div className="project-list-tools">
        <label>
          Search systems
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Title, customer, product or owner"
          />
        </label>
        <button className="button primary" onClick={create}>
          <Plus size={17} />
          New system
        </button>
      </div>
      <SelectionButtons
        label="System type"
        value={type}
        options={["All types", ...PROJECT_TYPES]}
        onChange={setType}
      />
      <p className="project-help">
        Active systems. Find closed systems in Complete, Archive, or Cancelled
        in the navigation.
      </p>
      <div className="project-cards">
        {projects.map((p) => (
          <button
            className="project-card"
            key={p.id}
            onClick={() => open(p.id)}
          >
            <span className="project-card-meta">
              {p.number} · {p.type}
            </span>
            <strong>{p.title}</strong>
            <span>
              {p.customer ? `${p.customer} · ` : ""}
              {p.product}
              {p.version ? ` · ${p.version}` : ""}
            </span>
            <span className="project-card-status">
              {p.status} · {p.phase}
            </span>
            <span className="stage-track" aria-hidden="true">
              {PROJECT_PHASES[p.type].map((phase, i) => (
                <i
                  key={phase}
                  className={
                    i <= PROJECT_PHASES[p.type].indexOf(p.phase) ? "filled" : ""
                  }
                />
              ))}
            </span>
            <span>{p.owners.join(", ") || "Owners not assigned"}</span>
            <span>
              Target: {displayDate(p.targetDate)} · {p.featureIds.length} linked
              features
            </span>
          </button>
        ))}
      </div>
      {!projects.length && (
        <div className="project-empty">
          <FolderOpen size={30} />
          <h2>
            {state.projects.length
              ? "No matching systems"
              : "Give the next machine a home"}
          </h2>
          <p>
            {state.projects.length
              ? "Adjust your search or filters to see more systems."
              : "Start a machine-development or custom-customer system, then connect its features."}
          </p>
        </div>
      )}
      <p className="project-count">
        Showing {projects.length} of{" "}
        {state.projects.filter((p) => p.status === "In work").length} active
        systems · Saved in this browser
      </p>
    </section>
  );
}
const displayDate = (date: string) =>
  date
    ? new Date(`${date}T12:00:00`).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : "Not set";

export function ProjectDialog({
  project,
  state,
  commit,
  close,
  created,
  openFeature,
  openSoftware,
}: {
  project?: Project;
  state: AppState;
  commit: Commit;
  close: () => void;
  created: (id: string) => void;
  openFeature: (id: string) => void;
  openSoftware: (id: string) => void;
}) {
  const [base, setBase] = useState(project);
  const [fields, setFields] = useState<ProjectFields>(() =>
    project ? projectFields(project) : blankProject(),
  );
  const [editing, setEditing] = useState(!project);
  const [tab, setTab] = useState("Overview");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [action, setAction] = useState<{
    label: string;
    status: ProjectStatus;
  } | null>(null);
  const [note, setNote] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [documentRevision, setDocumentRevision] = useState<number | null>(null);
  const [documentTitle, setDocumentTitle] = useState("");
  const [documentUrl, setDocumentUrl] = useState("");
  const documentDirty = !!documentTitle || !!documentUrl;
  const dirty =
    editing &&
    JSON.stringify(fields) !==
      JSON.stringify(base ? projectFields(base) : blankProject());
  const stale = !!base && (!project || base.revision !== project.revision);
  useEffect(() => {
    if (!editing && project) {
      setBase(project);
      setFields(projectFields(project));
    }
  }, [editing, project]);
  useEffect(() => {
    if (!dirty && !note && !documentDirty) return;
    const prevent = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, note, documentDirty]);
  const dismiss = () => {
    if (
      !busy &&
      ((!dirty && !note && !documentDirty) ||
        window.confirm("Discard the changes you haven’t saved?"))
    )
      close();
  };
  const set = <K extends keyof ProjectFields>(
    key: K,
    value: ProjectFields[K],
  ) => setFields((f) => ({ ...f, [key]: value }));
  async function run(change: (s: AppState) => AppState, done?: () => void) {
    setBusy(true);
    setError("");
    try {
      await commit(change);
      done?.();
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The system could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    let id = "";
    await run(
      (s) => {
        if (base) return updateProject(s, base.id, base.revision, fields);
        const result = createProject(s, fields);
        id = result.project.id;
        return result.state;
      },
      () => {
        setEditing(false);
        if (id) created(id);
      },
    );
  }
  const linked = state.features.filter((f) => base?.featureIds.includes(f.id));
  const available = state.features.filter(
    (f) =>
      !base?.featureIds.includes(f.id) &&
      `${f.number} ${f.title}`.toLowerCase().includes(query.toLowerCase()),
  );
  const unresolved = linked.filter((f) => f.status !== "Complete").length;
  return (
    <Modal
      wide
      label={base ? `System ${base.number}` : "New system"}
      onClose={dismiss}
    >
      <div className="drawer-heading">
        <div>
          <div className="eyebrow">
            {base?.number ?? "A NEW DEVELOPMENT SYSTEM"}
          </div>
          <h2>{base?.title ?? "New system"}</h2>
          <p>{base?.type ?? "Organize the work behind your next machine."}</p>
        </div>
        <button
          className="icon-button close-drawer"
          aria-label="Close system"
          onClick={dismiss}
        >
          <X size={21} />
        </button>
      </div>
      {base && !editing && (
        <div className="feature-view-toolbar">
          <strong className="project-status">{base.status}</strong>
          {!editing && (
            <button
              className="button primary"
              disabled={documentRevision !== null}
              onClick={() => {
                setEditing(true);
                setTab("Overview");
                setError("");
              }}
            >
              <Pencil size={16} />
              Edit system
            </button>
          )}
        </div>
      )}
      {base && editing && (
        <section
          className="feature-lifecycle"
          aria-label="System status and actions"
        >
          <div className="lifecycle-heading">
            <span>Current status</span>
            <strong className="project-status">{base.status}</strong>
          </div>
          <div className="lifecycle-actions">
            {projectActions(base).map((a) => {
              const Icon =
                a.label === "Archive"
                  ? Archive
                  : a.label === "Cancel system"
                    ? XCircle
                    : a.label === "Complete"
                      ? CheckCheck
                      : ArrowRight;
              return (
                <button
                  key={a.label}
                  className={`button ${a.label === "Restore" ? "primary" : "secondary"}`}
                  disabled={busy || stale || dirty}
                  onClick={() => {
                    setError("");
                    if (a.status === "Complete" && unresolved) {
                      setAction(a);
                      setNote("");
                    } else
                      void run(
                        (s) =>
                          changeProjectStatus(
                            s,
                            base.id,
                            base.revision,
                            a.status,
                          ),
                        () => setEditing(false),
                      );
                  }}
                >
                  <Icon size={16} />
                  {a.label}
                </button>
              );
            })}
            <button
              className="button delete-link"
              disabled={busy || stale}
              onClick={() => {
                setError("");
                setDeleteConfirmation("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 size={15} />
              Delete permanently
            </button>
          </div>
          <p className="lifecycle-hint">
            {dirty
              ? "Save or discard your edits before changing the system’s status."
              : "These actions change the system’s status. Linked features keep their own status."}
          </p>
        </section>
      )}
      {base && !editing && (
        <div className="project-tabs">
          {["Overview", "Linked features", "Documents", "Activity"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              key={t}
              onClick={() => setTab(t)}
              aria-pressed={tab === t}
            >
              {t}
              {t === "Linked features" ? ` (${linked.length})` : ""}
              {t === "Documents" ? ` (${base.documents.length})` : ""}
            </button>
          ))}
        </div>
      )}
      <div className="project-body">
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {editing ? (
          <>
            {stale && (
              <p className="form-error" role="alert">
                This system changed elsewhere. Discard edits to load its latest
                version.
              </p>
            )}
            <form id="project-form" className="project-form" onSubmit={save}>
              <fieldset disabled={busy || stale}>
                {!base && (
                  <SelectionButtons
                    label="System type"
                    value={fields.type}
                    options={PROJECT_TYPES}
                    onChange={(v) =>
                      setFields((f) => ({
                        ...f,
                        type: v as ProjectFields["type"],
                        phase: "Requirements",
                        customer: "",
                        orderReference: "",
                      }))
                    }
                  />
                )}
                <label>
                  System title
                  <input
                    required
                    maxLength={140}
                    value={fields.title}
                    onChange={(e) => set("title", e.target.value)}
                  />
                </label>
                <label>
                  Description / objective
                  <textarea
                    required
                    rows={4}
                    value={fields.description}
                    onChange={(e) => set("description", e.target.value)}
                  />
                </label>
                <div>
                  <SelectionButtons
                    label={
                      fields.type === "Machine development"
                        ? "Product family"
                        : "Base machine"
                    }
                    value={fields.product}
                    options={PRODUCT_FAMILIES}
                    onChange={(value) => set("product", value)}
                  />
                  {fields.product &&
                    !PRODUCT_FAMILIES.includes(fields.product) && (
                      <p className="project-help">
                        Previously saved: {fields.product}. Select a family
                        above to update it; use the version field for the
                        machine version.
                      </p>
                    )}
                </div>
                <label>
                  {fields.type === "Machine development"
                    ? "Target version (optional)"
                    : "Base version (optional)"}
                  <input
                    value={fields.version}
                    onChange={(e) => set("version", e.target.value)}
                  />
                </label>
                {fields.type === "Custom customer machine" && (
                  <div className="project-field-grid">
                    <label>
                      Customer / company
                      <input
                        required
                        value={fields.customer}
                        onChange={(e) => set("customer", e.target.value)}
                      />
                    </label>
                    <label>
                      Order reference (optional)
                      <input
                        value={fields.orderReference}
                        onChange={(e) => set("orderReference", e.target.value)}
                      />
                    </label>
                  </div>
                )}
                <SelectionButtons
                  label="System priority"
                  value={fields.priority}
                  options={PRIORITIES}
                  onChange={(v) =>
                    set("priority", v as ProjectFields["priority"])
                  }
                />
                <SelectionButtons
                  label="System phase"
                  value={fields.phase}
                  options={PROJECT_PHASES[fields.type]}
                  onChange={(v) => set("phase", v)}
                />
                <fieldset className="project-owners">
                  <legend>System owners</legend>
                  {[...new Set([...state.members, ...fields.owners])].map(
                    (owner) => (
                      <label key={owner}>
                        <input
                          type="checkbox"
                          checked={fields.owners.includes(owner)}
                          onChange={(e) =>
                            set(
                              "owners",
                              e.target.checked
                                ? [...fields.owners, owner]
                                : fields.owners.filter((o) => o !== owner),
                            )
                          }
                        />
                        {owner}
                      </label>
                    ),
                  )}
                </fieldset>
                <label>
                  Target date (optional)
                  <input
                    type="date"
                    value={fields.targetDate}
                    onChange={(e) => set("targetDate", e.target.value)}
                  />
                </label>
              </fieldset>
            </form>
          </>
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
                      <dt>Priority</dt>
                      <dd>{base.priority}</dd>
                    </div>
                    <div>
                      <dt>System type</dt>
                      <dd>{base.type}</dd>
                    </div>
                    <div className="overview-wide">
                      <dt>Owners</dt>
                      <dd>{base.owners.join(", ") || "Not assigned yet"}</dd>
                    </div>
                    <div>
                      <dt>
                        {base.type === "Machine development"
                          ? "Product family"
                          : "Base machine"}
                      </dt>
                      <dd>{base.product}</dd>
                    </div>
                    <div>
                      <dt>
                        {base.type === "Machine development"
                          ? "Target version"
                          : "Base version"}
                      </dt>
                      <dd>{base.version || "Not set"}</dd>
                    </div>
                    {base.type === "Custom customer machine" && (
                      <>
                        <div>
                          <dt>Customer / company</dt>
                          <dd>{base.customer}</dd>
                        </div>
                        <div>
                          <dt>Order reference</dt>
                          <dd>{base.orderReference || "Not set"}</dd>
                        </div>
                      </>
                    )}
                    <div>
                      <dt>Phase</dt>
                      <dd>
                        {base.phase}
                        <span className="stage-track" aria-hidden="true">
                          {PROJECT_PHASES[base.type].map((phase, i) => (
                            <i
                              key={phase}
                              className={
                                i <=
                                PROJECT_PHASES[base.type].indexOf(base.phase)
                                  ? "filled"
                                  : ""
                              }
                            />
                          ))}
                        </span>
                      </dd>
                    </div>
                    <div>
                      <dt>Target date</dt>
                      <dd>{displayDate(base.targetDate)}</dd>
                    </div>
                  </dl>
                  <section className="overview-section">
                    <h3>Linked features</h3>
                    <p>
                      {linked.length} features ·{" "}
                      {linked.filter((f) => f.status === "Complete").length}{" "}
                      complete · {unresolved} not complete
                    </p>
                    <button
                      className="button secondary"
                      onClick={() => setTab("Linked features")}
                    >
                      View linked features
                    </button>
                  </section>
                  <section className="overview-section">
                    <div className="overview-section-heading">
                      <h3>
                        Documents <span>{base.documents.length}</span>
                      </h3>
                      <button
                        className="text-button"
                        onClick={() => setTab("Documents")}
                      >
                        View documents
                        <ArrowRight size={14} />
                      </button>
                    </div>
                    {base.documents.length ? (
                      <div className="overview-documents">
                        {base.documents.slice(0, 3).map((d) => (
                          <a
                            key={d.id}
                            href={d.url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <FileText size={17} />
                            <span>{d.title}</span>
                            <ExternalLink size={14} />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <p>No documents linked yet.</p>
                    )}
                  </section>
                  <LinkedSoftware
                    state={state}
                    systemId={base.id}
                    open={openSoftware}
                    commit={commit}
                  />
                  <p className="project-footnote">
                    Created {new Date(base.createdAt).toLocaleDateString()} ·
                    Updated {new Date(base.updatedAt).toLocaleDateString()}
                  </p>
                </>
              )}
              {tab === "Linked features" && (
                <section>
                  <h3>Linked features</h3>
                  <p className="project-help">
                    Changes to a feature appear in every system that links to
                    it.
                  </p>
                  {linked.length ? (
                    <ul className="project-linked-list">
                      {linked.map((f) => (
                        <li key={f.id}>
                          <button
                            className="project-feature-link"
                            onClick={() => openFeature(f.id)}
                          >
                            <small>
                              {f.number} · {f.workType} · {f.status}
                            </small>
                            <strong>{f.title}</strong>
                            <span>
                              {f.owners.join(", ") || "Unassigned"} · {f.stage}
                            </span>
                          </button>
                          <button
                            className="text-button"
                            disabled={busy || stale}
                            aria-label={`Unlink ${f.number}`}
                            onClick={() =>
                              void run((s) =>
                                linkProjectFeature(
                                  s,
                                  base.id,
                                  base.revision,
                                  f.id,
                                  false,
                                ),
                              )
                            }
                          >
                            Unlink
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="project-help">No features linked yet.</p>
                  )}
                  <div className="project-link-picker">
                    <h3>Link an existing feature</h3>
                    <label>
                      Find a feature
                      <input
                        type="search"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Feature number or title"
                      />
                    </label>
                    <ul className="project-linked-list">
                      {available.slice(0, 20).map((f) => (
                        <li key={f.id}>
                          <span>
                            <small>
                              {f.number} · {f.status}
                            </small>
                            <strong>{f.title}</strong>
                          </span>
                          <button
                            className="button secondary"
                            disabled={busy || stale}
                            aria-label={`Link ${f.number}`}
                            onClick={() =>
                              void run((s) =>
                                linkProjectFeature(
                                  s,
                                  base.id,
                                  base.revision,
                                  f.id,
                                  true,
                                ),
                              )
                            }
                          >
                            Link
                          </button>
                        </li>
                      ))}
                    </ul>
                    <p className="project-help">
                      {available.length > 20
                        ? "Showing the first 20 matches. Search to narrow the list."
                        : `${available.length} available features`}
                    </p>
                  </div>
                </section>
              )}
              {tab === "Documents" && (
                <section className="documents-tab">
                  <div className="section-heading">
                    <h3>Documents that stay with the system</h3>
                    <p>
                      Links are saved in this browser. Files stay in Google
                      Drive.
                    </p>
                  </div>
                  {base.documents.length ? (
                    <div className="document-list">
                      {base.documents.map((d) => (
                        <a
                          key={d.id}
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="document-item"
                        >
                          <span className="document-icon">
                            <FileText size={22} />
                          </span>
                          <span>
                            <strong>{d.title}</strong>
                            <small>Linked file · access not verified</small>
                          </span>
                          <ExternalLink size={16} />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="document-empty">
                      <FolderOpen size={34} />
                      <h3>No documents linked yet</h3>
                      <p>
                        Add requirements, design notes, drawings, or other
                        Google Drive files. Links stay with the system when it
                        is completed, archived, or cancelled.
                      </p>
                    </div>
                  )}
                  {documentRevision === null ? (
                    <button
                      className="button secondary full-width"
                      onClick={() => {
                        setDocumentRevision(base.revision);
                        setDocumentTitle("");
                        setDocumentUrl("");
                        setError("");
                      }}
                    >
                      <Link2 size={16} />
                      Link a Google Drive file
                    </button>
                  ) : (
                    <form
                      className="link-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        void run(
                          (s) =>
                            addProjectDocument(
                              s,
                              base.id,
                              documentRevision,
                              documentTitle,
                              documentUrl,
                            ),
                          () => {
                            setDocumentRevision(null);
                            setDocumentTitle("");
                            setDocumentUrl("");
                          },
                        );
                      }}
                    >
                      <h3>Link an existing file</h3>
                      <label className="field">
                        <span>Document name</span>
                        <input
                          required
                          value={documentTitle}
                          onChange={(e) => setDocumentTitle(e.target.value)}
                        />
                      </label>
                      <label className="field">
                        <span>Google Drive file link</span>
                        <input
                          required
                          type="url"
                          value={documentUrl}
                          onChange={(e) => setDocumentUrl(e.target.value)}
                          placeholder="https://drive.google.com/file/d/…/view"
                        />
                      </label>
                      {documentRevision !== project?.revision && (
                        <p className="form-error" role="alert">
                          This system changed while the link form was open.
                          Discard this draft and reopen the form to use the
                          latest version.
                        </p>
                      )}
                      <div className="button-row">
                        <button
                          type="button"
                          className="button secondary"
                          disabled={busy}
                          onClick={() => {
                            setDocumentRevision(null);
                            setDocumentTitle("");
                            setDocumentUrl("");
                            setError("");
                          }}
                        >
                          Discard link
                        </button>
                        <button
                          type="submit"
                          className="button primary"
                          disabled={
                            busy || documentRevision !== project?.revision
                          }
                        >
                          {busy ? "Saving…" : "Save document link"}
                        </button>
                      </div>
                    </form>
                  )}
                  <p className="field-hint">
                    Automatic folder creation and file uploads will come with
                    the Google Drive connection.
                  </p>
                </section>
              )}
              {tab === "Activity" && (
                <section>
                  <h3>System activity</h3>
                  <p className="project-help">
                    System changes saved in this browser. Linked features keep
                    their own activity history.
                  </p>
                  <ol className="project-activity">
                    {base.activity.map((a) => (
                      <li key={a.id}>
                        <div>
                          <strong>{a.actor}</strong>
                          <time dateTime={a.at}>
                            {new Date(a.at).toLocaleString()}
                          </time>
                        </div>
                        <p>
                          {a.summary
                            .replace(
                              /^Created this project$/,
                              "Created this system",
                            )
                            .replace(/^Project type:/gm, "System type:")}
                        </p>
                      </li>
                    ))}
                  </ol>
                </section>
              )}
            </>
          )
        )}
      </div>
      <div className="drawer-footer">
        <span>
          {dirty || documentDirty
            ? "You have unsaved changes"
            : "Sample data · saved in this browser"}
        </span>
        <div className="button-row">
          {editing && base && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={() => {
                if (project) {
                  setBase(project);
                  setFields(projectFields(project));
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
              form="project-form"
              disabled={busy || stale}
            >
              {busy ? "Saving…" : base ? "Save changes" : "Create system"}
            </button>
          ) : (
            <button className="button secondary" onClick={dismiss}>
              Close
            </button>
          )}
        </div>
      </div>
      {action && base && (
        <Modal
          label={action.label}
          onClose={() => {
            if (
              !busy &&
              (!note || window.confirm("Discard this status-change note?"))
            ) {
              setAction(null);
              setNote("");
            }
          }}
        >
          <div className="modal-heading">
            <h2>{action.label}</h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                (s) =>
                  changeProjectStatus(
                    s,
                    base.id,
                    base.revision,
                    action.status,
                    note,
                  ),
                () => {
                  setAction(null);
                  setNote("");
                  setEditing(false);
                },
              );
            }}
          >
            <div className="modal-body project-form">
              <p>
                This changes the whole system. Linked features keep their
                current status.
              </p>
              {action.status === "Complete" && (
                <p>
                  {unresolved
                    ? `${unresolved} linked feature(s) are not Complete. Explain why the system can be completed with these items unresolved.`
                    : "All linked features are complete, or no features are linked. Summarize the outcome."}
                </p>
              )}
              <label>
                Summary / reason
                <textarea
                  required
                  rows={4}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>
              {error && (
                <p role="alert" className="form-error">
                  {error}
                </p>
              )}
            </div>
            <div className="drawer-footer">
              <button
                className="button secondary"
                type="button"
                disabled={busy}
                onClick={() => {
                  setAction(null);
                  setNote("");
                }}
              >
                Discard action
              </button>
              <button
                className="button primary"
                disabled={busy || stale}
                type="submit"
              >
                {action.label}
              </button>
            </div>
          </form>
        </Modal>
      )}
      {deleteOpen && base && (
        <Modal
          label="Delete system permanently"
          onClose={() => {
            if (!busy) setDeleteOpen(false);
          }}
        >
          <div className="modal-heading">
            <h2>Delete system permanently?</h2>
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void run(
                (s) =>
                  deleteProject(s, base.id, base.revision, deleteConfirmation),
                close,
              );
            }}
          >
            <div className="modal-body project-form">
              <p>
                This removes this system, its links, and its activity with no
                recovery or deletion history. Linked features and their history
                remain.
              </p>
              {dirty && (
                <p>Your unsaved system edits will also be discarded.</p>
              )}
              <label>
                Type {base.number} to confirm
                <input
                  required
                  autoComplete="off"
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
            </div>
            <div className="drawer-footer">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setDeleteOpen(false)}
              >
                Keep system
              </button>
              <button
                className="button delete-link"
                type="submit"
                disabled={
                  busy || stale || deleteConfirmation.trim() !== base.number
                }
              >
                Delete permanently
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
}
