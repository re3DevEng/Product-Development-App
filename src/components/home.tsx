"use client";

import { ArrowRight, Code2, FolderOpen, LayoutGrid } from "lucide-react";
import { isActive, type AppState } from "@/lib/domain";
import { StatusBadge, PriorityBadge } from "./record-badges";

export function HomePage({
  state,
  navigate,
  openFeature,
  openSoftware,
  openSystem,
}: {
  state: AppState;
  navigate: (view: "Active features" | "Software" | "Systems") => void;
  openFeature: (id: string) => void;
  openSoftware: (id: string) => void;
  openSystem: (id: string) => void;
}) {
  const features = state.features.filter(isActive);
  const software = state.software.filter((s) =>
    ["Request", "In work", "Testing"].includes(s.status),
  );
  const systems = state.projects.filter((s) => s.status === "In work");
  const sections = [
    {
      title: "Features",
      view: "Active features" as const,
      icon: LayoutGrid,
      items: features,
      detail: `${features.filter((f) => f.status === "Request").length} requests · ${features.filter((f) => f.status === "In-Work").length} in work`,
      description: "Engineering and operational improvements",
    },
    {
      title: "Software",
      view: "Software" as const,
      icon: Code2,
      items: software,
      detail: `${software.filter((s) => s.status === "Request").length} requests · ${software.filter((s) => s.status === "In work").length} in work · ${software.filter((s) => s.status === "Testing").length} testing`,
      description: "Software changes and bug reports",
    },
    {
      title: "Systems",
      view: "Systems" as const,
      icon: FolderOpen,
      items: systems,
      detail: `${systems.filter((s) => s.type === "Machine development").length} machine development · ${systems.filter((s) => s.type === "Custom customer machine").length} custom builds`,
      description: "Machine development and customer builds",
    },
  ];
  const recent = [
    ...state.features.map((item) => ({
      ...item,
      kind: "Feature",
      open: openFeature,
    })),
    ...state.software.map((item) => ({
      ...item,
      kind: "Software",
      open: openSoftware,
    })),
    ...state.projects.map((item) => ({
      ...item,
      kind: "System",
      open: openSystem,
    })),
  ]
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 6);
  return (
    <div className="home-overview">
      <section className="home-sections" aria-label="Workspace overview">
        {sections.map((section) => (
          <button
            className="home-section-card"
            key={section.title}
            onClick={() => navigate(section.view)}
          >
            <span className="home-section-title">
              <section.icon size={21} />
              <strong>{section.title}</strong>
              <ArrowRight size={17} />
            </span>
            <span className="home-total">
              {section.items.length}
              <small>active</small>
            </span>
            <span className="home-detail">{section.detail}</span>
            <span className="home-attention">
              {section.items.filter((item) => item.priority === "High").length}{" "}
              high priority ·{" "}
              {section.items.filter((item) => !item.owners.length).length}{" "}
              unassigned
            </span>
            <span className="home-description">{section.description}</span>
          </button>
        ))}
      </section>
      <section className="features-panel" aria-labelledby="home-recent-title">
        <div className="panel-top">
          <div>
            <h2 id="home-recent-title">Recently updated</h2>
            <p className="home-description">
              The latest work across features, software, and systems, including
              history.
            </p>
          </div>
        </div>
        {recent.length ? (
          <ul className="home-recent-list">
            {recent.map((item) => (
              <li key={`${item.kind}-${item.id}`}>
                <button
                  className="home-recent-item"
                  onClick={() => item.open(item.id)}
                >
                  <span className="home-recent-title">
                    <small>
                      {item.kind} · {item.number}
                    </small>
                    <strong>{item.title}</strong>
                    <span>{item.owners.join(", ") || "Unassigned"}</span>
                  </span>
                  <span className="home-recent-meta">
                    <StatusBadge status={item.status} />
                    <PriorityBadge priority={item.priority} />
                    <time dateTime={item.updatedAt}>
                      {new Date(item.updatedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                      })}
                    </time>
                    <ArrowRight size={16} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="empty-state">
            <h3>Your workspace is ready</h3>
            <p>
              Open Features, Software, or Systems above to create your first
              item.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
