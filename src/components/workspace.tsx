"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
  type FormEvent,
} from "react";
import {
  ArrowDownToLine,
  ArrowRight,
  Archive,
  Check,
  CheckCheck,
  ChevronRight,
  Code2,
  Bug,
  CircleHelp,
  Clock3,
  ExternalLink,
  FileText,
  FlaskConical,
  FolderOpen,
  House,
  LayoutGrid,
  Link2,
  ListFilter,
  Map,
  Menu,
  Plus,
  Pencil,
  Search,
  Settings2,
  Shapes,
  Sparkles,
  Users,
  Trash2,
  Wrench,
  X,
  XCircle,
} from "lucide-react";
import {
  addDocument,
  createFeature,
  deleteFeature,
  isActive,
  PRIORITIES,
  STAGES,
  updateFeature,
  WORK_TYPES,
  type AppState,
  type Feature,
  type FeatureFields,
  type DocumentLink,
} from "@/lib/domain";
import { useWorkspaceStore } from "@/lib/store";
import { Modal, SelectionButtons } from "./shared-ui";
import { ProjectsList, ProjectDialog } from "./projects";
import { HistoryList } from "./history";
import { SoftwareList, SoftwareDialog, LinkedSoftware } from "./software";
import { HomePage } from "./home";
import { ThemeToggle } from "./theme-toggle";
import { PdmLibrary, PdmDialog } from "./pdm";
import { PartChanges } from "./part-changes";
import { softwareDependencies } from "@/lib/software";
import {
  StageTrack,
  StatusBadge,
  PriorityBadge,
  Avatars,
} from "./record-badges";
import {
  HISTORY_STATUSES,
  historyItems,
  type HistoryStatus,
} from "@/lib/history";

type View =
  | "Home"
  | "PDM Library"
  | "Software"
  | "Software changes"
  | "Bug reports"
  | "Systems"
  | "Active features"
  | "ECR"
  | "OCR"
  | "Roadmap"
  | "Complete"
  | "Archive"
  | "Declined"
  | "Cancelled"
  | "Settings"
  | "Help";
type Commit = (change: (current: AppState) => AppState) => Promise<void>;
const navItems = [
  { name: "Active features", icon: LayoutGrid },
  { name: "ECR", icon: Wrench },
  { name: "OCR", icon: FileText },
  { name: "Roadmap", icon: Map },
  { name: "Complete", icon: CheckCheck },
  { name: "Archive", icon: Archive },
  { name: "Declined", icon: XCircle },
  { name: "Cancelled", icon: XCircle },
] as const;
const viewDescription: Record<View, string> = {
  Home: "Your product development workspace, at a glance.",
  "PDM Library":
    "Parts and assemblies, connected to the changes that develop them.",
  Software:
    "Software changes and bugs, connected to the features and systems they support.",
  "Software changes":
    "Plan and track software improvements through development and testing.",
  "Bug reports":
    "Capture problems, reproduce them, and track their resolution.",
  Systems:
    "A shared home for new machines, custom builds, and the changes that bring them to life.",
  "Active features": "A shared place to move good ideas into better products.",
  ECR: "Engineering changes, from early requirements to final review.",
  OCR: "Operational improvements that make the everyday work better.",
  Roadmap: "Keep the next product improvements in view.",
  Complete: "Finished work, with every decision and document preserved.",
  Archive: "Ideas on hold. Ready to revisit when the time is right.",
  Declined: "Keep the context behind the work you chose not to pursue.",
  Cancelled:
    "Work that was started and then stopped, with its history preserved.",
  Settings: "Shape this workspace around the way your team works.",
  Help: "A quick guide from the first idea to the finished change.",
};
function matchesView(f: Feature, view: View, history = false) {
  if (view === "Active features") return isActive(f);
  if (view === "ECR" || view === "OCR")
    return f.workType === view && isActive(f);
  if (view === "Roadmap") return f.roadmap && (history || isActive(f));
  return f.status === view;
}
function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}
function formatDate(date: string) {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}
export default function Workspace() {
  const { state, error, commit, reset, recover, download } =
    useWorkspaceStore();
  const [view, setView] = useState<View>("Home");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("All owners");
  const [product, setProduct] = useState("All products");
  const [status, setStatus] = useState("All active");
  const [sort, setSort] = useState("Recently updated");
  const [history, setHistory] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);
  const [selectedSoftware, setSelectedSoftware] = useState<string | null>(null);
  const [selectedPdm, setSelectedPdm] = useState<string | null>(null);
  const [pdmReturnFeature, setPdmReturnFeature] = useState<string | null>(null);
  const [selectedPdmRevision, setSelectedPdmRevision] = useState<string | null>(
    null,
  );
  const [creatingPdm, setCreatingPdm] = useState<string | null>(null);
  const [creatingSoftware, setCreatingSoftware] = useState(false);
  const [softwareExpanded, setSoftwareExpanded] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [creating, setCreating] = useState(false);
  const [mobile, setMobile] = useState(false);
  const [featuresExpanded, setFeaturesExpanded] = useState(false);
  const [projectsExpanded, setProjectsExpanded] = useState(false);
  const [toast, setToast] = useState("");
  const [resetOpen, setResetOpen] = useState(false);
  const [resetError, setResetError] = useState("");
  const viewFilters = useRef<
    Partial<
      Record<
        View,
        {
          search: string;
          owner: string;
          product: string;
          status: string;
          sort: string;
        }
      >
    >
  >({});
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5000);
    return () => clearTimeout(t);
  }, [toast]);
  function navigate(next: View) {
    viewFilters.current[view] = {
      search,
      owner,
      product,
      status,
      sort,
    };
    const saved = viewFilters.current[next];
    setView(next);
    setMobile(false);
    setSearch(saved?.search ?? "");
    setOwner(saved?.owner ?? "All owners");
    setProduct(saved?.product ?? "All products");
    setStatus(saved?.status ?? "All active");
    setSort(saved?.sort ?? "Recently updated");
  }
  if (!state)
    return (
      <main className="loading">
        <div className="brand-mark">
          <Shapes size={25} />
        </div>
        <h1>
          {error
            ? "Your sample workspace needs attention"
            : "Opening your workspace…"}
        </h1>
        <p>{error || "Preparing feature requests and your product roadmap."}</p>
        {error && (
          <div className="button-row">
            <button className="button secondary" onClick={() => download(true)}>
              Download recovery copy
            </button>
            <button
              className="button primary"
              onClick={() => {
                if (
                  window.confirm(
                    "Replace the unreadable browser data with fresh samples? Download a recovery copy first if you need it.",
                  )
                )
                  void recover().catch((e) => window.alert(e.message));
              }}
            >
              Reset sample data
            </button>
          </div>
        )}
      </main>
    );
  const active = state.features.filter(isActive);
  const counts = {
    requests: active.filter((f) => f.status === "Request").length,
    inWork: active.filter((f) => f.status === "In-Work").length,
    roadmap: active.filter((f) => f.roadmap).length,
    complete: state.features.filter((f) => f.status === "Complete").length,
  };
  const base = state.features.filter((f) => matchesView(f, view, history));
  const features = base
    .filter(
      (f) =>
        (!search ||
          `${f.number} ${f.title} ${f.description} ${f.products.join(" ")} ${f.owners.join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase())) &&
        (owner === "All owners" ||
          (owner === "Unassigned"
            ? !f.owners.length
            : f.owners.includes(owner))) &&
        (product === "All products" ||
          f.products.includes(
            product === "__all_products__" ? "All products" : product,
          )) &&
        (status === "All active" || f.status === status),
    )
    .sort((a, b) =>
      sort === "Priority"
        ? PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
        : sort === "Title"
          ? a.title.localeCompare(b.title)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  const isHistory = HISTORY_STATUSES.includes(view as HistoryStatus);
  const isSoftware = ["Software", "Software changes", "Bug reports"].includes(
    view,
  );
  const isList =
    view !== "Home" &&
    view !== "Settings" &&
    view !== "Help" &&
    view !== "Systems" &&
    view !== "PDM Library" &&
    !isHistory &&
    !isSoftware;
  const selectedFeature = state.features.find((f) => f.id === selected);
  const pdmOrigin = state.features.find((f) => f.id === pdmReturnFeature);
  return (
    <div className="app-shell">
      {mobile && (
        <button
          className="mobile-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <aside
        className={`sidebar ${mobile ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            navigate("Home");
          }}
        >
          <span className="brand-mark" aria-hidden="true">
            <img
              className="brand-logo-light"
              src="/brand/re3d-black.png"
              alt=""
              width={48}
              height={48}
            />
            <img
              className="brand-logo-dark"
              src="/brand/re3d-white.png"
              alt=""
              width={48}
              height={48}
            />
          </span>
          <span className="brand-word">
            re:3D<span>PRODUCT DEVELOPMENT</span>
          </span>
        </a>
        <div className="workspace-label">
          WORKSPACE <span>Internal</span>
        </div>
        <nav>
          <button
            className={`nav-item ${view === "Home" ? "selected" : ""}`}
            onClick={() => navigate("Home")}
            aria-current={view === "Home" ? "page" : undefined}
          >
            <House size={18} />
            <span>Home</span>
          </button>
          <div className="nav-parent-row">
            <button
              className="nav-fold"
              aria-label={`${featuresExpanded ? "Collapse" : "Expand"} Features submenu`}
              aria-expanded={featuresExpanded}
              aria-controls="feature-navigation"
              title={`${featuresExpanded ? "Collapse" : "Expand"} feature views`}
              onClick={() => setFeaturesExpanded((value) => !value)}
            >
              <ChevronRight size={17} />
            </button>
            <button
              className={`nav-item ${view === "Active features" ? "selected" : ""}`}
              onClick={() => navigate("Active features")}
              title="Open all features"
              aria-current={view === "Active features" ? "page" : undefined}
            >
              <LayoutGrid size={18} />
              <span className="nav-page-label">
                Features<small>View all features</small>
              </span>
              <span className="nav-count">{active.length}</span>
            </button>
          </div>
          <div
            id="feature-navigation"
            hidden={!featuresExpanded}
            className="nav-children"
            role="group"
            aria-label="Feature views"
          >
            {navItems
              .filter((item) => item.name === "ECR" || item.name === "OCR")
              .map((item) => (
                <button
                  key={item.name}
                  className={`nav-item ${view === item.name ? "selected" : ""}`}
                  onClick={() => navigate(item.name)}
                  aria-current={view === item.name ? "page" : undefined}
                >
                  <item.icon size={16} />
                  <span>
                    {item.name === "ECR"
                      ? "Engineering changes"
                      : "Operational changes"}
                  </span>
                  <span className="nav-count">
                    {
                      state.features.filter((f) => matchesView(f, item.name))
                        .length
                    }
                  </span>
                </button>
              ))}
          </div>
          <div className="nav-parent-row">
            <button
              className="nav-fold"
              aria-label={`${softwareExpanded ? "Collapse" : "Expand"} Software submenu`}
              aria-expanded={softwareExpanded}
              aria-controls="software-navigation"
              onClick={() => setSoftwareExpanded(!softwareExpanded)}
            >
              <ChevronRight size={17} />
            </button>
            <button
              className={`nav-item ${view === "Software" ? "selected" : ""}`}
              onClick={() => navigate("Software")}
              aria-current={view === "Software" ? "page" : undefined}
            >
              <Code2 size={18} />
              <span className="nav-page-label">
                Software<small>View all software</small>
              </span>
              <span className="nav-count">
                {
                  state.software.filter((s) =>
                    ["Request", "In work", "Testing"].includes(s.status),
                  ).length
                }
              </span>
            </button>
          </div>
          <div
            id="software-navigation"
            className="nav-children"
            role="group"
            aria-label="Software views"
            hidden={!softwareExpanded}
          >
            <button
              className={`nav-item ${view === "Software changes" ? "selected" : ""}`}
              onClick={() => navigate("Software changes")}
            >
              <Code2 size={16} />
              <span>Change requests</span>
            </button>
            <button
              className={`nav-item ${view === "Bug reports" ? "selected" : ""}`}
              onClick={() => navigate("Bug reports")}
            >
              <Bug size={16} />
              <span>Bug reports</span>
            </button>
          </div>
          <button
            className={`nav-item ${view === "PDM Library" ? "selected" : ""}`}
            onClick={() => navigate("PDM Library")}
            aria-current={view === "PDM Library" ? "page" : undefined}
          >
            <Shapes size={18} />
            <span>PDM Library</span>
            <span className="nav-count">{state.pdmItems.length}</span>
          </button>
          <div className="nav-parent-row">
            <button
              className="nav-fold"
              aria-label={`${projectsExpanded ? "Collapse" : "Expand"} Systems submenu`}
              aria-expanded={projectsExpanded}
              aria-controls="project-navigation"
              title={`${projectsExpanded ? "Collapse" : "Expand"} system views`}
              onClick={() => setProjectsExpanded((value) => !value)}
            >
              <ChevronRight size={17} />
            </button>
            <button
              className={`nav-item ${view === "Systems" ? "selected" : ""}`}
              onClick={() => navigate("Systems")}
              title="Open all systems"
              aria-current={view === "Systems" ? "page" : undefined}
            >
              <FolderOpen size={18} />
              <span className="nav-page-label">
                Systems<small>View all systems</small>
              </span>
              <span className="nav-count">
                {
                  state.projects.filter(
                    (p) =>
                      !["Complete", "Cancelled", "Archive"].includes(p.status),
                  ).length
                }
              </span>
            </button>
          </div>
          <div
            id="project-navigation"
            hidden={!projectsExpanded}
            className="nav-children"
            role="group"
            aria-label="System views"
          >
            <button
              className={`nav-item ${view === "Roadmap" ? "selected" : ""}`}
              onClick={() => navigate("Roadmap")}
              aria-current={view === "Roadmap" ? "page" : undefined}
            >
              <Map size={16} />
              <span>Roadmap</span>
              <span className="nav-count">{counts.roadmap}</span>
            </button>
            <div className="nav-recent-label">Recent systems</div>
            {state.projects
              .filter((p) => p.status === "In work")
              .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
              .slice(0, 5)
              .map((p) => (
                <button
                  key={p.id}
                  className={`nav-item nav-project ${selectedProject === p.id ? "selected" : ""}`}
                  title={`${p.number} · ${p.title}`}
                  onClick={() => {
                    navigate("Systems");
                    setSelectedProject(p.id);
                  }}
                >
                  <FolderOpen size={15} />
                  <span>{p.title}</span>
                </button>
              ))}
            {!state.projects.some((p) => p.status === "In work") && (
              <p className="nav-empty">No active systems yet</p>
            )}
          </div>
          <div className="nav-section-label">HISTORY</div>
          {navItems
            .filter((item) =>
              HISTORY_STATUSES.includes(item.name as HistoryStatus),
            )
            .map((item) => (
              <div key={item.name}>
                <button
                  className={`nav-item ${view === item.name ? "selected" : ""}`}
                  onClick={() => navigate(item.name)}
                  aria-current={view === item.name ? "page" : undefined}
                >
                  <item.icon size={18} />
                  <span>
                    {item.name === "ECR"
                      ? "Engineering changes"
                      : item.name === "OCR"
                        ? "Operational changes"
                        : item.name}
                  </span>
                  <span className="nav-count">
                    {HISTORY_STATUSES.includes(item.name as HistoryStatus)
                      ? historyItems(state, item.name as HistoryStatus).length
                      : state.features.filter((f) => matchesView(f, item.name))
                          .length}
                  </span>
                </button>
              </div>
            ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-note">
            <span className="small-icon">
              <FlaskConical size={16} />
            </span>
            <strong>A space to try things</strong>
            <p>You’re exploring a local prototype with sample requests.</p>
            <button onClick={() => navigate("Help")}>
              See how it works <ArrowRight size={14} />
            </button>
          </div>
          <button
            className={`nav-item ${view === "Settings" ? "selected" : ""}`}
            onClick={() => navigate("Settings")}
          >
            <Settings2 size={18} />
            <span>Settings</span>
          </button>
          <button
            className={`nav-item ${view === "Help" ? "selected" : ""}`}
            onClick={() => navigate("Help")}
          >
            <CircleHelp size={18} />
            <span>Help & getting started</span>
          </button>
          <div className="user-card">
            <span className="avatar demo-avatar">DU</span>
            <span>
              <strong>Demo user</strong>
              <small>Local workspace · no sign-in</small>
            </span>
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            <button
              className="icon-button mobile-menu"
              aria-label="Open navigation"
              onClick={() => setMobile(true)}
            >
              <Menu size={20} />
            </button>
            <span>Product development</span>
            <ChevronRight size={14} />
            <strong>{view}</strong>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            <span className="demo-pill">
              <span />
              Sample workspace
            </span>
          </div>
        </header>
        <main className="main-content">
          <div className="page-heading">
            <div>
              <div className="eyebrow">BUILT FOR WHAT’S NEXT</div>
              <h1>
                {view === "ECR"
                  ? "Engineering changes"
                  : view === "OCR"
                    ? "Operational changes"
                    : view}
              </h1>
              <p>{viewDescription[view]}</p>
            </div>
            {isList && (
              <button
                className="button primary"
                onClick={() => setCreating(true)}
              >
                <Plus size={18} />
                New request
              </button>
            )}
          </div>
          {view === "Home" && (
            <HomePage
              state={state}
              navigate={navigate}
              openFeature={setSelected}
              openSoftware={setSelectedSoftware}
              openSystem={setSelectedProject}
            />
          )}
          {view === "Active features" && (
            <div className="stats-grid">
              {[
                {
                  label: "Awaiting a start",
                  value: counts.requests,
                  icon: Sparkles,
                  foot: "Requests to review",
                  action: () => setStatus("Request"),
                },
                {
                  label: "In work",
                  value: counts.inWork,
                  icon: Wrench,
                  foot: "Ideas moving forward",
                  action: () => setStatus("In-Work"),
                },
                {
                  label: "On the roadmap",
                  value: counts.roadmap,
                  icon: Map,
                  foot: "Active priorities",
                  action: () => navigate("Roadmap"),
                },
                {
                  label: "Completed",
                  value: counts.complete,
                  icon: CheckCheck,
                  foot: "Improvements delivered",
                  action: () => navigate("Complete"),
                },
              ].map((s, i) => (
                <button className="stat-card" key={s.label} onClick={s.action}>
                  <span className="stat-label">
                    {s.label}
                    <s.icon className={`stat-icon stat-${i}`} size={19} />
                  </span>
                  <span className="stat-value">
                    {s.label === "Awaiting a start"
                      ? s.value
                      : s.value.toString().padStart(2, "0")}
                  </span>
                  <span className="stat-foot">
                    {s.foot}
                    <ArrowRight size={14} />
                  </span>
                </button>
              ))}
            </div>
          )}
          {isList && (
            <section
              className={`features-panel ${view === "Roadmap" ? "roadmap-panel" : ""}`}
              aria-label={`${view} workspace`}
            >
              <div className="panel-top">
                <div className="panel-title">
                  <h2>
                    {view === "Active features"
                      ? "All active features"
                      : view === "Roadmap"
                        ? "Product roadmap"
                        : `${view} features`}
                  </h2>
                  <span className="count-pill">{base.length}</span>
                </div>
                {view === "Roadmap" ? (
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={history}
                      onChange={(e) => setHistory(e.target.checked)}
                    />
                    Include closed work
                  </label>
                ) : (
                  <span className="panel-caption">
                    <span className="connected-dot" />
                    Saved in this browser
                  </span>
                )}
              </div>
              <div className="filterbar">
                <label className="search-field">
                  <Search size={17} />
                  <input
                    aria-label="Search features"
                    placeholder="Search features, IDs, or people…"
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
                  <select
                    aria-label="Filter by owner"
                    value={owner}
                    onChange={(e) => setOwner(e.target.value)}
                  >
                    <option>All owners</option>
                    <option>Unassigned</option>
                    {state.members.map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Filter by product"
                    value={product}
                    onChange={(e) => setProduct(e.target.value)}
                  >
                    <option value="All products">Any product</option>
                    {state.products.map((p) => (
                      <option
                        key={p}
                        value={p === "All products" ? "__all_products__" : p}
                      >
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="list-toolbar">
                <div className="segmented">
                  {["Active features", "ECR", "OCR"].includes(view) ? (
                    ["All active", "Request", "In-Work"].map((s) => (
                      <button
                        className={status === s ? "active" : ""}
                        key={s}
                        onClick={() => setStatus(s)}
                      >
                        {s === "Request"
                          ? "Requests"
                          : s === "In-Work"
                            ? "In work"
                            : s}
                      </button>
                    ))
                  ) : (
                    <span className="result-count">
                      {features.length}{" "}
                      {features.length === 1 ? "feature" : "features"}
                      {history ? " · including history" : ""}
                    </span>
                  )}
                </div>
                <div className="sort-label">
                  <span>Sort:</span>
                  <SelectionButtons
                    label="Sort features"
                    value={sort}
                    onChange={setSort}
                    options={[
                      { value: "Recently updated", label: "Recent" },
                      "Priority",
                      "Title",
                    ]}
                    compact
                  />
                </div>
              </div>
              {features.length ? (
                view === "Roadmap" ? (
                  <div className="roadmap-board">
                    {["Unassigned", "ECR", "OCR"].map((type) => (
                      <div className="roadmap-column" key={type}>
                        <div className="column-heading">
                          <span className={`column-dot dot-${type}`} />
                          <h3>
                            {type === "Unassigned"
                              ? "Up next"
                              : type === "ECR"
                                ? "Engineering"
                                : "Operations"}
                          </h3>
                          <span>
                            {features.filter((f) => f.workType === type).length}
                          </span>
                        </div>
                        {features
                          .filter((f) => f.workType === type)
                          .map((f) => (
                            <button
                              className="roadmap-card"
                              key={f.id}
                              onClick={() => setSelected(f.id)}
                            >
                              <span className="card-meta">
                                <span className="feature-number">
                                  {f.number}
                                </span>
                                <PriorityBadge priority={f.priority} />
                              </span>
                              <h4>{f.title}</h4>
                              <div className="product-tags">
                                {f.products.map((p) => (
                                  <span key={p}>{p}</span>
                                ))}
                              </div>
                              <div className="roadmap-stage">
                                <StatusBadge status={f.status} />
                                <span>
                                  {f.stage !== "Not started" ? f.stage : ""}
                                </span>
                              </div>
                              <div className="roadmap-card-footer">
                                <Avatars owners={f.owners} />
                                <ChevronRight size={16} />
                              </div>
                            </button>
                          ))}
                        {!features.some((f) => f.workType === type) && (
                          <div className="column-empty">
                            No features here yet
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="table-scroll">
                    <table className="feature-table">
                      <thead>
                        <tr>
                          <th>Feature</th>
                          <th>Status</th>
                          <th>Priority</th>
                          <th>Owner</th>
                          <th>Review stage</th>
                          <th>
                            <span className="sr-only">Open feature</span>
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {features.map((f) => (
                          <tr key={f.id}>
                            <td>
                              <button
                                className="feature-link"
                                onClick={() => setSelected(f.id)}
                              >
                                <span className="feature-meta">
                                  <span className="feature-number">
                                    {f.number}
                                  </span>
                                  {f.workType !== "Unassigned" && (
                                    <span
                                      className={`type-tag type-${f.workType}`}
                                    >
                                      {f.workType}
                                    </span>
                                  )}
                                  {f.roadmap && (
                                    <span
                                      className="roadmap-marker"
                                      title="On the roadmap"
                                    >
                                      <Map size={13} />
                                      <span className="sr-only">
                                        On roadmap
                                      </span>
                                    </span>
                                  )}
                                </span>
                                <strong>{f.title}</strong>
                                <span className="product-line">
                                  {f.products.join(" · ")}
                                </span>
                              </button>
                            </td>
                            <td>
                              <StatusBadge status={f.status} />
                            </td>
                            <td>
                              <PriorityBadge priority={f.priority} />
                            </td>
                            <td>
                              <Avatars owners={f.owners} />
                            </td>
                            <td>
                              <span
                                className={`review-stage ${f.stage === "Not started" ? "muted" : ""}`}
                              >
                                {f.stage === "Not started" ? "—" : f.stage}
                              </span>
                              <StageTrack feature={f} />
                            </td>
                            <td>
                              <button
                                className="icon-button row-arrow"
                                aria-label={`Open ${f.title}`}
                                onClick={() => setSelected(f.id)}
                              >
                                <ChevronRight size={17} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              ) : (
                <div className="empty-state">
                  <Search size={30} />
                  <h3>No features found</h3>
                  <p>
                    {base.length
                      ? "Try a different search or clear your filters."
                      : "Features will appear here as you organize your work."}
                  </p>
                  <button
                    className="button secondary"
                    onClick={() => {
                      setSearch("");
                      setOwner("All owners");
                      setProduct("All products");
                      setStatus("All active");
                    }}
                  >
                    Clear filters
                  </button>
                </div>
              )}
              <div className="panel-footer">
                <span>
                  Showing {features.length} of {base.length} features
                </span>
                <span>
                  <FlaskConical size={13} />
                  Illustrative sample data
                </span>
              </div>
            </section>
          )}
          {isHistory && (
            <HistoryList
              key={view}
              state={state}
              status={view as HistoryStatus}
              openFeature={setSelected}
              openProject={setSelectedProject}
              openSoftware={setSelectedSoftware}
            />
          )}
          {view === "Systems" && (
            <ProjectsList
              state={state}
              open={setSelectedProject}
              create={() => setCreatingProject(true)}
            />
          )}
          {view === "PDM Library" && (
            <PdmLibrary
              state={state}
              open={(id) => {
                setPdmReturnFeature(null);
                setSelectedPdm(id);
                setSelectedPdmRevision(null);
              }}
            />
          )}
          {isSoftware && (
            <SoftwareList
              key={view}
              state={state}
              type={
                view === "Bug reports"
                  ? "Bug report"
                  : view === "Software changes"
                    ? "Change request"
                    : undefined
              }
              open={setSelectedSoftware}
              create={() => setCreatingSoftware(true)}
            />
          )}
          {view === "Settings" && (
            <SettingsPage
              state={state}
              commit={commit}
              notify={setToast}
              download={() => download()}
              reset={() => {
                setResetError("");
                setResetOpen(true);
              }}
            />
          )}
          {view === "Help" && <HelpPage create={() => setCreating(true)} />}
          <footer className="page-footer">
            <span>Good ideas deserve a clear path forward.</span>
            <span>
              Prototype 0.1 <span className="footer-dot">·</span> Google Drive &
              Supabase connection next
            </span>
          </footer>
        </main>
      </div>
      {(creatingProject ||
        state.projects.some((p) => p.id === selectedProject)) && (
        <ProjectDialog
          key={creatingProject ? "new-system" : selectedProject!}
          project={
            creatingProject
              ? undefined
              : state.projects.find((p) => p.id === selectedProject)
          }
          state={state}
          commit={commit}
          close={() => {
            setCreatingProject(false);
            setSelectedProject(null);
          }}
          created={(id) => {
            setCreatingProject(false);
            setSelectedProject(id);
            setToast(
              "System created. Connect its features in Linked features.",
            );
          }}
          openFeature={setSelected}
          openSoftware={setSelectedSoftware}
        />
      )}
      {(creatingPdm || state.pdmItems.some((p) => p.id === selectedPdm)) && (
        <PdmDialog
          key={
            creatingPdm
              ? `new-pdm-${creatingPdm}`
              : `${selectedPdm}:${selectedPdmRevision}`
          }
          sourceFeatureId={creatingPdm ?? undefined}
          openPart={(id, revisionId) => {
            setSelectedPdm(id);
            setSelectedPdmRevision(revisionId ?? null);
          }}
          initialRevisionId={selectedPdmRevision ?? undefined}
          backLabel={
            pdmOrigin
              ? `Back to ${pdmOrigin.workType} ${pdmOrigin.number}`
              : undefined
          }
          item={
            creatingPdm
              ? undefined
              : state.pdmItems.find((p) => p.id === selectedPdm)
          }
          state={state}
          commit={commit}
          close={() => {
            if (creatingPdm) setSelected(creatingPdm);
            else if (
              pdmReturnFeature &&
              state.features.some((f) => f.id === pdmReturnFeature)
            )
              setSelected(pdmReturnFeature);
            setCreatingPdm(null);
            setSelectedPdm(null);
          }}
          created={(id) => {
            setSelected(creatingPdm);
            setCreatingPdm(null);
            setSelectedPdm(null);
            setToast("Draft created and linked to this change.");
          }}
          openFeature={(id) => {
            setPdmReturnFeature(null);
            setSelectedPdm(null);
            setSelected(id);
          }}
        />
      )}
      {(creating || selectedFeature) && (
        <FeatureDialog
          key={creating ? "new" : selectedFeature!.id}
          feature={creating ? undefined : selectedFeature}
          initialPartsTab={pdmReturnFeature === selectedFeature?.id}
          state={state}
          commit={commit}
          onClose={() => {
            setPdmReturnFeature(null);
            setCreating(false);
            setSelected(null);
          }}
          onCreated={(id) => {
            setCreating(false);
            setSelected(id);
            setToast("Request created. It’s ready to review.");
          }}
          notify={setToast}
          createPdm={(featureId) => {
            setSelected(null);
            setSelectedPdm(null);
            setCreatingPdm(featureId);
          }}
          openPdm={(id, revisionId) => {
            setPdmReturnFeature(selectedFeature?.id ?? null);
            setSelected(null);
            setSelectedPdm(id);
            setSelectedPdmRevision(revisionId ?? null);
          }}
          openProject={(id) => {
            setSelected(null);
            setCreating(false);
            setSelectedProject(id);
          }}
          openSoftware={setSelectedSoftware}
        />
      )}
      {(creatingSoftware ||
        state.software.some((s) => s.id === selectedSoftware)) && (
        <SoftwareDialog
          key={creatingSoftware ? "new-software" : selectedSoftware!}
          item={
            creatingSoftware
              ? undefined
              : state.software.find((s) => s.id === selectedSoftware)
          }
          initialType={view === "Bug reports" ? "Bug report" : "Change request"}
          state={state}
          commit={commit}
          close={() => {
            setSelectedSoftware(null);
            setCreatingSoftware(false);
          }}
          created={(id) => {
            setCreatingSoftware(false);
            setSelectedSoftware(id);
          }}
          openFeature={(id) => {
            setSelectedSoftware(null);
            setSelected(id);
          }}
          openSystem={(id) => {
            setSelectedSoftware(null);
            setSelectedProject(id);
          }}
        />
      )}
      {resetOpen && (
        <Modal
          label="Reset sample workspace"
          onClose={() => setResetOpen(false)}
        >
          <div className="modal-heading">
            <h2>Start fresh with sample data?</h2>
            <button
              className="icon-button"
              aria-label="Close reset dialog"
              onClick={() => setResetOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="modal-body">
            <p>
              This replaces the requests and settings saved in this browser.
              Download a copy first if you want to keep your changes.
            </p>
            {resetError && (
              <div role="alert" className="form-error">
                {resetError}
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="button secondary" onClick={() => download()}>
              Download a copy
            </button>
            <button
              className="button danger"
              onClick={() =>
                void reset()
                  .then(() => {
                    setResetOpen(false);
                    setToast("Sample workspace reset.");
                  })
                  .catch((e) => setResetError(e.message))
              }
            >
              Reset sample workspace
            </button>
          </div>
        </Modal>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}

const blankFields = (): FeatureFields => ({
  title: "",
  description: "",
  status: "Request",
  priority: "Medium",
  workType: "Unassigned",
  stage: "Not started",
  roadmap: false,
  owners: [],
  products: [],
});
function fieldsOf(f: Feature): FeatureFields {
  return {
    title: f.title,
    description: f.description,
    status: f.status,
    priority: f.priority,
    workType: f.workType,
    stage: f.stage,
    roadmap: f.roadmap,
    owners: f.owners,
    products: f.products,
  };
}
function FeatureDialog({
  feature,
  state,
  commit,
  onClose,
  onCreated,
  notify,
  openProject,
  openSoftware,
  openPdm,
  createPdm,
  initialPartsTab = false,
}: {
  feature?: Feature;
  state: AppState;
  commit: Commit;
  onClose: () => void;
  onCreated: (id: string) => void;
  notify: (message: string) => void;
  openProject: (id: string) => void;
  openSoftware: (id: string) => void;
  openPdm: (id: string, revisionId?: string) => void;
  createPdm: (featureId: string) => void;
  initialPartsTab?: boolean;
}) {
  const [base, setBase] = useState(feature);
  const [editing, setEditing] = useState(!feature);
  const [fields, setFields] = useState<FeatureFields>(() =>
    feature ? fieldsOf(feature) : blankFields(),
  );
  const [tab, setTab] = useState(
    initialPartsTab ? "Parts & assemblies" : "Overview",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [docTitle, setDocTitle] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [docRole, setDocRole] = useState<DocumentLink["role"]>(
    feature?.workType === "ECR" || feature?.workType === "OCR"
      ? feature.workType
      : "Supporting file",
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const [preview, setPreview] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const started = !!base?.hasStarted;
  const dirty =
    JSON.stringify(fields) !==
    JSON.stringify(base ? fieldsOf(base) : blankFields());
  const pendingEdits = dirty || !!docTitle || !!docUrl;
  const stale = base && feature && base.revision !== feature.revision;
  useEffect(() => {
    if (!editing && feature && feature.revision !== base?.revision) {
      setBase(feature);
      setFields(fieldsOf(feature));
    }
  }, [editing, feature, base?.revision]);
  useEffect(() => {
    if (!dirty && !docTitle && !docUrl) return;
    const prevent = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", prevent);
    return () => window.removeEventListener("beforeunload", prevent);
  }, [dirty, docTitle, docUrl]);
  function close() {
    if (
      (!dirty && !docTitle && !docUrl) ||
      window.confirm("Discard the changes you haven’t saved?")
    )
      onClose();
  }
  function set<K extends keyof FeatureFields>(key: K, value: FeatureFields[K]) {
    setFields((prev) => ({ ...prev, [key]: value }));
  }
  function stopEditing() {
    const latest = feature ?? base;
    if (!latest) return;
    setBase(latest);
    setFields(fieldsOf(latest));
    setDocTitle("");
    setDocUrl("");
    setLinkOpen(false);
    setError("");
    setStatusMessage("");
    setEditing(false);
  }
  function changeType(type: FeatureFields["workType"]) {
    if (base?.hasStarted && type === "Unassigned") return;
    setFields((prev) => ({
      ...prev,
      workType: type,
      stage: STAGES[type].includes(prev.stage) ? prev.stage : "Not started",
      status:
        type === "Unassigned" && prev.status === "In-Work"
          ? "Request"
          : type !== "Unassigned" && prev.status === "Request"
            ? "In-Work"
            : prev.status,
    }));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      if (!base) {
        let id = "";
        await commit((current) => {
          const result = createFeature(current, fields);
          id = result.feature.id;
          return result.state;
        });
        onCreated(id);
      } else {
        let saved: Feature | undefined;
        await commit((current) => {
          const next = updateFeature(current, base.id, base.revision, fields);
          saved = next.features.find((f) => f.id === base.id);
          return next;
        });
        if (saved) {
          setBase(saved);
          setFields(fieldsOf(saved));
          if (!docTitle && !docUrl) setEditing(false);
          setStatusMessage("Changes saved.");
          notify("Feature updated across the workspace.");
        }
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The change could not be saved.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function linkDocument(e: FormEvent) {
    e.preventDefault();
    if (!base) return;
    setError("");
    setBusy(true);
    try {
      let saved: Feature | undefined;
      await commit((current) => {
        const next = addDocument(
          current,
          base.id,
          base.revision,
          docTitle,
          docRole,
          docUrl,
        );
        saved = next.features.find((f) => f.id === base.id);
        return next;
      });
      if (saved) setBase(saved);
      setDocTitle("");
      setDocUrl("");
      setLinkOpen(false);
      notify("Document link saved. Google Drive permissions still apply.");
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The document could not be linked.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(status: FeatureFields["status"]) {
    if (!base || busy || stale || pendingEdits) return;
    setError("");
    setStatusMessage("");
    setBusy(true);
    try {
      let saved: Feature | undefined;
      await commit((current) => {
        const next = updateFeature(current, base.id, base.revision, {
          ...fieldsOf(base),
          status,
        });
        saved = next.features.find((f) => f.id === base.id);
        return next;
      });
      if (saved) {
        setBase(saved);
        setFields(fieldsOf(saved));
        const message = isActive(saved)
          ? "Restored. You can find this feature in Active features."
          : `Moved to ${saved.status}. Its details, documents, and history are preserved.`;
        setStatusMessage(message);
        if (!docTitle && !docUrl) setEditing(false);
      }
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "The status could not be changed.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function permanentlyDelete(e: FormEvent) {
    e.preventDefault();
    if (!base || busy || stale) return;
    setBusy(true);
    setDeleteError("");
    try {
      await commit((current) =>
        deleteFeature(current, base.id, base.revision, deleteConfirmation),
      );
      onClose();
      notify("Feature permanently deleted.");
    } catch (e) {
      setDeleteError(
        e instanceof Error ? e.message : "The feature could not be deleted.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      label={base ? `Feature ${base.number}` : "New feature request"}
      onClose={close}
      wide
    >
      <div className="drawer-heading">
        <div>
          <div className="eyebrow">
            {base ? `FEATURE ${base.number}` : "START WITH AN IDEA"}
          </div>
          <h2>{base ? base.title : "New feature request"}</h2>
          <p>
            {base
              ? `Submitted by ${base.submittedBy} · ${formatDate(base.createdAt)}`
              : "What could we make better? Capture the essentials here."}
          </p>
        </div>
        <button
          className="icon-button close-drawer"
          aria-label="Close feature"
          onClick={close}
        >
          <X size={21} />
        </button>
      </div>
      {base && !editing && (
        <div className="feature-view-toolbar">
          <div className="feature-view-state">
            <StatusBadge status={base.status} />
            <span>Feature overview</span>
          </div>
          <button
            className="button primary"
            onClick={() => {
              setEditing(true);
              setTab("Overview");
              setStatusMessage("");
              setError("");
            }}
          >
            <Pencil size={16} />
            Edit feature
          </button>
        </div>
      )}
      {base && editing && (
        <section
          className="feature-lifecycle"
          aria-label="Feature status and actions"
        >
          <div className="lifecycle-heading">
            <span>Current status</span>
            <StatusBadge status={base.status} />
          </div>
          <div className="lifecycle-actions">
            {isActive(base) ? (
              <>
                {started && (
                  <button
                    className="button secondary"
                    disabled={busy || !!stale || pendingEdits}
                    onClick={() => void changeStatus("Complete")}
                  >
                    <CheckCheck size={16} />
                    Complete
                  </button>
                )}
                <button
                  className="button secondary"
                  disabled={busy || !!stale || pendingEdits}
                  onClick={() => void changeStatus("Archive")}
                >
                  <Archive size={16} />
                  Archive
                </button>
                <button
                  className="button secondary"
                  disabled={busy || !!stale || pendingEdits}
                  onClick={() =>
                    void changeStatus(started ? "Cancelled" : "Declined")
                  }
                >
                  <XCircle size={16} />
                  {started ? "Cancel work" : "Decline"}
                </button>
              </>
            ) : (
              <button
                className="button primary"
                disabled={busy || !!stale || pendingEdits}
                onClick={() =>
                  void changeStatus(started ? "In-Work" : "Request")
                }
              >
                <ArrowRight size={16} />
                Restore
              </button>
            )}
            <button
              className="button delete-link"
              disabled={busy || !!stale}
              onClick={() => {
                setDeleteConfirmation("");
                setDeleteError("");
                setDeleteOpen(true);
              }}
            >
              <Trash2 size={15} />
              Delete permanently
            </button>
          </div>
          <p className="lifecycle-hint">
            {pendingEdits
              ? "Save or discard your edits before changing the feature’s status. These actions apply to the whole feature."
              : isActive(base)
                ? "These actions change the whole feature’s status. They do not save or discard field edits."
                : `Restore to ${started ? "In-Work" : "Request"} with the same number, owners, and documents.`}
            {fields.status !== base.status &&
              isActive(base) &&
              ` Status will change to ${fields.status} when you save your edits.`}
          </p>
          {statusMessage && (
            <p className="lifecycle-success" role="status">
              <Check size={15} />
              {statusMessage}
            </p>
          )}
        </section>
      )}
      {base && (
        <div className="detail-tabs">
          {["Overview", "Parts & assemblies", "Documents", "Activity"].map(
            (t) => (
              <button
                className={tab === t ? "active" : ""}
                key={t}
                onClick={() => {
                  setTab(t);
                  setError("");
                }}
              >
                {t}
                {t === "Documents" && <span>{base.documents.length}</span>}
                {t === "Parts & assemblies" && (
                  <span>
                    {
                      state.pdmItems.filter((p) =>
                        p.featureIds.includes(base.id),
                      ).length
                    }
                  </span>
                )}
              </button>
            ),
          )}
        </div>
      )}
      <div className="drawer-scroll">
        {!editing && statusMessage && (
          <p className="overview-saved" role="status">
            <Check size={16} />
            {statusMessage}
          </p>
        )}
        {stale && (
          <div className="form-error" role="alert">
            This feature changed in another tab. Close and reopen it before
            making further changes.
          </div>
        )}
        {error && (
          <div className="form-error" role="alert">
            {error}
          </div>
        )}
        {tab === "Overview" && !editing && base && (
          <section
            className="feature-overview"
            aria-label="Feature information"
          >
            <div className="overview-section overview-introduction">
              <h3>Description</h3>
              <p className="overview-description">{base.description}</p>
            </div>
            <dl className="overview-grid">
              <div>
                <dt>Priority</dt>
                <dd>
                  <PriorityBadge priority={base.priority} />
                </dd>
              </div>
              <div>
                <dt>Work type</dt>
                <dd>
                  {base.workType === "Unassigned" ? (
                    <span className="muted">Not assigned</span>
                  ) : (
                    <span className={`type-tag type-${base.workType}`}>
                      {base.workType}
                    </span>
                  )}
                </dd>
              </div>
              <div className="overview-wide">
                <dt>Owners</dt>
                <dd>
                  {base.owners.length ? (
                    <div className="overview-owners">
                      {base.owners.map((owner) => (
                        <span key={owner}>
                          <span className="avatar">{initials(owner)}</span>
                          {owner}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="muted">Not assigned yet</span>
                  )}
                </dd>
              </div>
              <div className="overview-wide">
                <dt>Affected products</dt>
                <dd className="product-tags">
                  {base.products.map((product) => (
                    <span key={product}>{product}</span>
                  ))}
                </dd>
              </div>
              {base.workType !== "Unassigned" && (
                <div>
                  <dt>Review stage</dt>
                  <dd>
                    {base.stage}
                    <StageTrack feature={base} />
                  </dd>
                </div>
              )}
              <div>
                <dt>Roadmap</dt>
                <dd>
                  {base.roadmap ? (
                    <span className="overview-roadmap">
                      <Map size={15} />
                      {isActive(base) ? "On the roadmap" : "In roadmap history"}
                    </span>
                  ) : (
                    <span className="muted">Not included</span>
                  )}
                </dd>
              </div>
            </dl>
            {softwareDependencies(state, base.id).length > 0 && (
              <p className="form-error">
                {softwareDependencies(state, base.id).length} required software
                item(s) still need completion.{" "}
                {base.status === "Complete"
                  ? "This feature was completed earlier; review its software dependencies."
                  : "Complete them before completing this feature."}
              </p>
            )}
            <LinkedSoftware
              state={state}
              featureId={base.id}
              open={openSoftware}
              commit={commit}
            />
            <section className="overview-section">
              <h3>Systems</h3>
              {state.projects.some((p) => p.featureIds.includes(base.id)) ? (
                <div className="project-reciprocal">
                  {state.projects
                    .filter((p) => p.featureIds.includes(base.id))
                    .map((p) => (
                      <button
                        className="button secondary"
                        key={p.id}
                        onClick={() => openProject(p.id)}
                      >
                        {p.number} · {p.title}
                      </button>
                    ))}
                </div>
              ) : (
                <p>
                  No systems linked yet. Connect this feature from a system's
                  Linked features tab.
                </p>
              )}
            </section>
            <div className="overview-section">
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
                  {base.documents.slice(0, 3).map((doc) => (
                    <a
                      key={doc.id}
                      href={doc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <FileText size={17} />
                      <span>{doc.title}</span>
                      <ExternalLink size={14} />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="muted">No documents linked yet.</p>
              )}
            </div>
            <div className="overview-dates">
              <span>
                Created{" "}
                {new Date(base.createdAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
              <span>
                Updated{" "}
                {new Date(base.updatedAt).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
          </section>
        )}
        {tab === "Parts & assemblies" && base && (
          <div className="feature-parts-tab">
            {editing ? (
              <div className="section-heading">
                <p>
                  Finish editing the feature to view and manage its parts and
                  assemblies.
                </p>
                <button
                  className="button secondary"
                  onClick={() => setTab("Overview")}
                >
                  Return to feature edits
                </button>
              </div>
            ) : (
              <PartChanges
                state={state}
                feature={base}
                commit={commit}
                create={() => createPdm(base.id)}
                open={openPdm}
              />
            )}
          </div>
        )}
        {tab === "Overview" && editing && (
          <form id="feature-form" onSubmit={save} className="feature-form">
            <label className="field">
              <span>
                Short title <b>*</b>
              </span>
              <input
                autoFocus={!base}
                required
                maxLength={140}
                value={fields.title}
                onChange={(e) => set("title", e.target.value)}
                placeholder="Give the improvement a clear, short name"
              />
            </label>
            <label className="field">
              <span>
                Description <b>*</b>
              </span>
              <textarea
                required
                rows={5}
                value={fields.description}
                onChange={(e) => set("description", e.target.value)}
                placeholder="What’s the problem? What should change, and what would a good outcome look like?"
              />
            </label>
            <fieldset className="choice-field">
              <legend>
                Affected products <b>*</b>
              </legend>
              <div className="choice-chips">
                {[...new Set([...state.products, ...fields.products])].map(
                  (p) => (
                    <label
                      className={fields.products.includes(p) ? "chosen" : ""}
                      key={p}
                    >
                      <input
                        type="checkbox"
                        checked={fields.products.includes(p)}
                        onChange={(e) =>
                          set(
                            "products",
                            e.target.checked
                              ? [...fields.products, p]
                              : fields.products.filter((v) => v !== p),
                          )
                        }
                      />
                      {fields.products.includes(p) && <Check size={13} />}
                      {p}
                    </label>
                  ),
                )}
              </div>
            </fieldset>
            <div className="form-divider" />
            <div className="section-heading">
              <h3>{base ? "Organize the work" : "Initial priority"}</h3>
              <p>
                {base
                  ? "One record, kept in sync across every view."
                  : "You can assign owners and choose a work type after submitting."}
              </p>
            </div>
            <div className="form-grid">
              <SelectionButtons
                label="Priority"
                value={fields.priority}
                options={PRIORITIES}
                onChange={(value) =>
                  set("priority", value as FeatureFields["priority"])
                }
              />
              {base && (
                <SelectionButtons
                  label="Work type"
                  value={fields.workType}
                  options={WORK_TYPES}
                  onChange={(value) =>
                    changeType(value as FeatureFields["workType"])
                  }
                  disabledOptions={base.hasStarted ? ["Unassigned"] : []}
                />
              )}
            </div>
            {base && (
              <>
                {fields.workType !== "Unassigned" && (
                  <SelectionButtons
                    label="Review stage"
                    value={fields.stage}
                    options={STAGES[fields.workType]}
                    onChange={(value) => set("stage", value)}
                  />
                )}
                <fieldset className="choice-field">
                  <legend>Owners</legend>
                  <div className="choice-chips">
                    {[...new Set([...state.members, ...fields.owners])].map(
                      (p) => (
                        <label
                          className={fields.owners.includes(p) ? "chosen" : ""}
                          key={p}
                        >
                          <input
                            type="checkbox"
                            checked={fields.owners.includes(p)}
                            onChange={(e) =>
                              set(
                                "owners",
                                e.target.checked
                                  ? [...fields.owners, p]
                                  : fields.owners.filter((v) => v !== p),
                              )
                            }
                          />
                          {fields.owners.includes(p) && <Check size={13} />}
                          {p}
                        </label>
                      ),
                    )}
                  </div>
                  <p className="field-hint">
                    Assign one or more teammates. These are sample names.
                  </p>
                </fieldset>
                <label className="roadmap-toggle">
                  <span className="roadmap-toggle-icon">
                    <Map size={21} />
                  </span>
                  <span>
                    <strong>Include on the roadmap</strong>
                    <small>Closed work stays in roadmap history.</small>
                  </span>
                  <input
                    type="checkbox"
                    role="switch"
                    checked={fields.roadmap}
                    onChange={(e) => set("roadmap", e.target.checked)}
                  />
                </label>
                {fields.workType !== "Unassigned" &&
                  !base.documents.some((d) => d.role === fields.workType) && (
                    <div className="inline-note">
                      <FileText size={18} />
                      <p>
                        <strong>{fields.workType} document not linked</strong>
                        After saving, open Documents to link an existing file or
                        preview the document concept. Automatic Google Doc
                        creation comes with the Drive connection.
                      </p>
                    </div>
                  )}
              </>
            )}
            {!base && (
              <div className="inline-note">
                <Link2 size={18} />
                <p>
                  You can add supporting Google Drive links from the Documents
                  tab after creating the request.
                </p>
              </div>
            )}
          </form>
        )}
        {tab === "Documents" && base && (
          <div className="documents-tab">
            <div className="section-heading">
              <h3>Documents that stay with the work</h3>
              <p>
                Links are saved in this browser. Files stay in Google Drive.
              </p>
            </div>
            {base.documents.length ? (
              <div className="document-list">
                {base.documents.map((d) => (
                  <a
                    href={d.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="document-item"
                    key={d.id}
                  >
                    <span className="document-icon">
                      <FileText size={22} />
                    </span>
                    <span>
                      <strong>{d.title}</strong>
                      <small>
                        {d.role} · Linked file · access not verified
                      </small>
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
                  Add an existing Google Doc or supporting file.
                  <br />
                  It will stay linked if this feature is archived or restored.
                </p>
              </div>
            )}
            {!editing ? (
              <p className="field-hint">
                Choose Edit feature to add document links.
              </p>
            ) : !linkOpen ? (
              <button
                className="button secondary full-width"
                onClick={() => setLinkOpen(true)}
              >
                <Link2 size={16} />
                Link a Google Drive file
              </button>
            ) : (
              <form className="link-form" onSubmit={linkDocument}>
                <h3>Link an existing file</h3>
                <label className="field">
                  <span>Document name</span>
                  <input
                    required
                    value={docTitle}
                    onChange={(e) => setDocTitle(e.target.value)}
                    placeholder="e.g. ECR — touchscreen enclosure"
                  />
                </label>
                <label className="field">
                  <span>Google Drive or Docs URL</span>
                  <input
                    type="url"
                    required
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="https://docs.google.com/document/d/…"
                  />
                </label>
                <SelectionButtons
                  label="Document role"
                  value={docRole}
                  options={["Supporting file", "ECR", "OCR"]}
                  onChange={(value) =>
                    setDocRole(value as DocumentLink["role"])
                  }
                />
                <div className="button-row">
                  <button
                    className="button secondary"
                    type="button"
                    onClick={() => {
                      setLinkOpen(false);
                      setDocTitle("");
                      setDocUrl("");
                    }}
                  >
                    Cancel
                  </button>
                  <button className="button primary" disabled={busy || !!stale}>
                    Save link
                  </button>
                </div>
              </form>
            )}
            <div className="integration-notice">
              <div>
                <FlaskConical size={19} />
                <strong>Document generation preview</strong>
              </div>
              <p>
                The Drive connection will create a document from your team’s
                template. This preview only shows a sample outline inside the
                app.
              </p>
              <button
                className="text-button"
                onClick={() => setPreview(!preview)}
              >
                {preview ? "Hide outline" : "Preview document outline"}
                <ArrowRight size={15} />
              </button>
            </div>
            {preview && (
              <article className="document-preview">
                <div className="preview-stamp">
                  LOCAL PREVIEW · NO GOOGLE FILE CREATED
                </div>
                <h3>
                  {base.workType === "Unassigned"
                    ? "Change request"
                    : base.workType}{" "}
                  / {base.number}
                </h3>
                <h4>{base.title}</h4>
                <dl>
                  <dt>Products</dt>
                  <dd>{base.products.join(", ")}</dd>
                  <dt>Owners</dt>
                  <dd>{base.owners.join(", ") || "Unassigned"}</dd>
                  <dt>Proposed improvement</dt>
                  <dd className="preserve-lines">{base.description}</dd>
                  <dt>Review sections</dt>
                  <dd>
                    {base.workType === "ECR"
                      ? "SRR → PDR → CDR → ORR → Final Review"
                      : "Final Review"}
                  </dd>
                </dl>
                <p className="field-hint">
                  Illustrative outline. The actual template and field mapping
                  will be confirmed when connecting Drive.
                </p>
              </article>
            )}
          </div>
        )}
        {tab === "Activity" && base && (
          <div className="activity-tab">
            <div className="section-heading">
              <h3>A clear record of what changed</h3>
              <p>Sample activity saved with this feature.</p>
            </div>
            <ol className="timeline">
              {base.activity.map((a) => (
                <li key={a.id}>
                  <span className="timeline-dot">
                    <Clock3 size={13} />
                  </span>
                  <div>
                    <div className="activity-meta">
                      <strong>{a.actor}</strong>
                      <time dateTime={a.at}>
                        {new Date(a.at).toLocaleString("en-US", {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </time>
                    </div>
                    <p>{a.summary}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        )}
      </div>
      <div className="drawer-footer">
        <span>
          {dirty
            ? "You have unsaved changes"
            : "Sample data · saved in this browser"}
        </span>
        <div className="button-row">
          {base && editing && (
            <button
              className="button secondary"
              disabled={busy}
              onClick={stopEditing}
            >
              {pendingEdits ? "Discard edits" : "Done editing"}
            </button>
          )}
          {(!base || !editing) && (
            <button className="button secondary" onClick={close}>
              {dirty || !base ? "Cancel" : "Close"}
            </button>
          )}
          {tab === "Overview" && editing && (
            <button
              form="feature-form"
              type="submit"
              className="button primary"
              disabled={busy || !!stale}
            >
              {busy ? "Saving…" : base ? "Save changes" : "Create request"}
              {!busy && <ArrowRight size={16} />}
            </button>
          )}
        </div>
      </div>
      {deleteOpen && base && (
        <Modal
          label="Permanently delete feature"
          onClose={() => {
            if (!busy) setDeleteOpen(false);
          }}
        >
          <form onSubmit={permanentlyDelete}>
            <div className="modal-heading">
              <h2>Delete {base.number} permanently?</h2>
            </div>
            <div className="modal-body">
              <p>
                <strong>{base.title}</strong>
              </p>
              <p>
                This removes the feature, its document links, and all its
                activity from this app. There is no trash, deletion history, or
                restore. Unsaved edits will be discarded.
              </p>
              <p>
                Linked Google Drive files and previously downloaded copies are
                not deleted.
              </p>
              <label className="field delete-confirmation">
                <span>Type {base.number} to confirm</span>
                <input
                  autoFocus
                  value={deleteConfirmation}
                  onChange={(e) => setDeleteConfirmation(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              {stale && (
                <div className="form-error" role="alert">
                  This feature changed in another tab. Close and reopen it
                  before deleting.
                </div>
              )}
              {deleteError && (
                <div className="form-error" role="alert">
                  {deleteError}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="button secondary"
                disabled={busy}
                onClick={() => setDeleteOpen(false)}
              >
                Keep feature
              </button>
              <button
                type="submit"
                className="button danger"
                disabled={
                  busy || !!stale || deleteConfirmation.trim() !== base.number
                }
              >
                {busy ? "Deleting…" : "Delete permanently"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </Modal>
  );
}

function SettingsPage({
  state,
  commit,
  notify,
  download,
  reset,
}: {
  state: AppState;
  commit: Commit;
  notify: (s: string) => void;
  download: () => void;
  reset: () => void;
}) {
  const [product, setProduct] = useState("");
  const [member, setMember] = useState("");
  const [error, setError] = useState("");
  async function add(e: FormEvent, kind: "products" | "members") {
    e.preventDefault();
    setError("");
    const value = (kind === "products" ? product : member).trim();
    if (!value) return;
    try {
      await commit((current) => {
        if (current[kind].some((v) => v.toLowerCase() === value.toLowerCase()))
          throw new Error("That option already exists.");
        return { ...current, [kind]: [...current[kind], value] };
      });
      if (kind === "products") setProduct("");
      else setMember("");
      notify(
        kind === "products"
          ? "Product option added."
          : "Sample teammate added. This does not grant app access.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save the option.");
    }
  }
  return (
    <div className="settings-layout">
      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}
      <div className="settings-grid">
        {[
          {
            kind: "products" as const,
            title: "Products & versions",
            icon: Shapes,
            description: "Options available when describing affected products.",
            value: product,
            set: setProduct,
            placeholder: "Add a product or version",
          },
          {
            kind: "members" as const,
            title: "Sample teammates",
            icon: Users,
            description:
              "Names available for ownership. These are not user accounts.",
            value: member,
            set: setMember,
            placeholder: "Add a sample teammate",
          },
        ].map((s) => (
          <section className="settings-card" key={s.kind}>
            <s.icon size={22} />
            <h2>{s.title}</h2>
            <p>{s.description}</p>
            <div className="settings-tags">
              {state[s.kind].map((p) => (
                <span key={p}>{p}</span>
              ))}
            </div>
            <form className="add-option" onSubmit={(e) => void add(e, s.kind)}>
              <input
                aria-label={s.placeholder}
                placeholder={s.placeholder}
                value={s.value}
                maxLength={70}
                required
                onChange={(e) => s.set(e.target.value)}
              />
              <button
                className="icon-button"
                aria-label={s.placeholder}
                type="submit"
              >
                <Plus size={19} />
              </button>
            </form>
          </section>
        ))}
      </div>
      <section className="settings-card">
        <div className="section-heading">
          <h2>The foundation for the full app</h2>
          <p>
            The next phase connects your shared data, internal access, and
            documents.
          </p>
        </div>
        <div className="connection-grid">
          {[
            { name: "Supabase", purpose: "Shared records, sign-in & activity" },
            {
              name: "Google Drive",
              purpose: "Team templates & working documents",
            },
            { name: "Vercel", purpose: "A web address for the internal team" },
          ].map((c) => (
            <div className="connection-card" key={c.name}>
              <span className="connection-status">Not connected</span>
              <h3>{c.name}</h3>
              <p>{c.purpose}</p>
            </div>
          ))}
        </div>
        <p className="field-hint">
          Review stages and priorities use the initial workflow. Editing
          templates, stages, and internal access will be added with the
          connected app.
        </p>
      </section>
      <section className="settings-card data-settings">
        <div>
          <h2>Your sample workspace</h2>
          <p>
            Changes live only in this browser on this computer. Export a copy
            before clearing browser data.
          </p>
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={download}>
            <ArrowDownToLine size={16} />
            Download sample data
          </button>
          <button className="button secondary" onClick={reset}>
            Reset samples
          </button>
        </div>
      </section>
    </div>
  );
}

function HelpPage({ create }: { create: () => void }) {
  return (
    <div className="help-layout">
      <section className="help-hero">
        <div className="eyebrow">FROM IDEA TO IMPROVEMENT</div>
        <h2>Start small. Keep the whole story.</h2>
        <p>
          Bring requests, ownership, reviews, and documents together. Every view
          follows the same feature, so your team can always pick up where it
          left off.
        </p>
        <button className="button primary" onClick={create}>
          <Plus size={17} />
          Try your first request
        </button>
        <Map className="help-art" size={140} strokeWidth={1} />
      </section>
      <div className="help-steps">
        {[
          {
            title: "Capture the idea",
            text: "Create a request with a clear title, description, and affected products. It starts in Request, ready to review.",
          },
          {
            title: "Give it a direction",
            text: "Open the feature to see its overview, then choose Edit feature. Assign owners and select ECR for engineering work or OCR for operational work. Saving a work type starts In-Work and returns you to the overview.",
          },
          {
            title: "Move the work forward",
            text: "Set the review stage, include the feature on the roadmap, and link working files in Documents. Stages track progress; they do not enforce approval.",
          },
          {
            title: "Close it without losing it",
            text: "Decline an unstarted request, or Cancel work after it starts. Complete and Archive also preserve the record. Restore returns started work to In-Work; it can never become a Request again. Delete permanently is separate and removes the app record and all its activity after you confirm its number. Linked Drive files remain untouched.",
          },
        ].map((s, i) => (
          <section key={s.title}>
            <span>{String(i + 1).padStart(2, "0")}</span>
            <div>
              <h3>{s.title}</h3>
              <p>{s.text}</p>
            </div>
          </section>
        ))}
      </div>
      <div className="help-notice">
        <FlaskConical size={23} />
        <div>
          <h3>What this prototype can do</h3>
          <p>
            Create and edit sample requests, filter lists, track a roadmap, link
            existing Drive files, and preserve activity through archive and
            restore. Changes survive a page refresh in the same browser.
          </p>
          <h3>What comes next</h3>
          <p>
            Shared Supabase storage, restricted internal sign-in, Google Doc
            generation, and importing your reviewed AppSheet records. The sample
            workspace has no real user accounts or automatic file creation. Your
            existing AppSheet app is unchanged.
          </p>
        </div>
      </div>
    </div>
  );
}
