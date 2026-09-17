"use client";
import { useState } from "react";
import { Search, Map, ChevronRight } from "lucide-react";
import { PRIORITIES, type AppState } from "@/lib/domain";
import { historyItems, type HistoryStatus } from "@/lib/history";
import { SelectionButtons } from "./shared-ui";
import { StatusBadge, PriorityBadge, Avatars } from "./record-badges";

export function HistoryList({
  state,
  status,
  openFeature,
  openProject,
}: {
  state: AppState;
  status: HistoryStatus;
  openFeature: (id: string) => void;
  openProject: (id: string) => void;
}) {
  const [kind, setKind] = useState("All");
  const [search, setSearch] = useState("");
  const [owner, setOwner] = useState("All owners");
  const [product, setProduct] = useState("");
  const [sort, setSort] = useState("Recent");
  const all = historyItems(state, status);
  const items = all
    .filter(
      (item) =>
        (kind === "All" || `${item.kind}s` === kind) &&
        (owner === "All owners" ||
          (owner === "Unassigned"
            ? !item.owners.length
            : item.owners.includes(owner))) &&
        (!product || item.products.includes(product)) &&
        [
          item.number,
          item.title,
          item.description,
          ...item.products,
          ...item.owners,
        ]
          .join(" ")
          .toLowerCase()
          .includes(search.toLowerCase()),
    )
    .sort((a, b) =>
      sort === "Priority"
        ? PRIORITIES.indexOf(a.priority) - PRIORITIES.indexOf(b.priority)
        : sort === "Title"
          ? a.title.localeCompare(b.title)
          : b.updatedAt.localeCompare(a.updatedAt),
    );
  return (
    <section className="features-panel" aria-label={`${status} workspace`}>
      <div className="panel-top">
        <div className="panel-title">
          <h2>{status} history</h2>
          <span className="count-pill">{all.length}</span>
        </div>
      </div>
      <div className="filterbar">
        <label className="search-field">
          <Search size={17} />
          <input
            aria-label="Search history"
            placeholder="Search systems, features, IDs, or people…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </label>
        <div className="filter-group">
          <select
            aria-label="Filter history by owner"
            value={owner}
            onChange={(e) => setOwner(e.target.value)}
          >
            {[
              "All owners",
              "Unassigned",
              ...new Set([...state.members, ...all.flatMap((i) => i.owners)]),
            ].map((o) => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <select
            aria-label="Filter history by product"
            value={product}
            onChange={(e) => setProduct(e.target.value)}
          >
            <option value="">Any product</option>
            {[...new Set(all.flatMap((i) => i.products))].sort().map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="list-toolbar">
        <SelectionButtons
          label="Show history for"
          value={kind}
          options={["All", "Features", "Systems"]}
          onChange={setKind}
          compact
        />
        <SelectionButtons
          label="Sort history"
          value={sort}
          options={["Recent", "Priority", "Title"]}
          onChange={setSort}
          compact
        />
      </div>
      {items.length ? (
        <div className="table-scroll">
          <table className="feature-table">
            <thead>
              <tr>
                <th>System / feature</th>
                <th>Status</th>
                <th>Priority</th>
                <th>Owner</th>
                <th>Stage / phase</th>
                <th>
                  <span className="sr-only">Open item</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={`${item.kind}-${item.id}`}>
                  <td>
                    <button
                      className="feature-link"
                      onClick={() =>
                        item.kind === "System"
                          ? openProject(item.id)
                          : openFeature(item.id)
                      }
                    >
                      <span className="feature-meta">
                        <span className="feature-number">{item.number}</span>
                        {item.kind === "System" ? (
                          <span className="type-tag" title={item.category}>
                            System
                          </span>
                        ) : (
                          item.category !== "Unassigned" && (
                            <span className={`type-tag type-${item.category}`}>
                              {item.category}
                            </span>
                          )
                        )}
                        {item.roadmap && (
                          <span
                            className="roadmap-marker"
                            title="On the roadmap"
                          >
                            <Map size={13} />
                            <span className="sr-only">On roadmap</span>
                          </span>
                        )}
                      </span>
                      <strong>{item.title}</strong>
                      <span className="product-line">
                        {item.products.join(" · ")}
                      </span>
                    </button>
                  </td>
                  <td>
                    <StatusBadge status={status} />
                  </td>
                  <td>
                    <PriorityBadge priority={item.priority} />
                  </td>
                  <td>
                    <Avatars owners={item.owners} />
                  </td>
                  <td>
                    <span
                      className={`review-stage ${item.stage === "Not started" ? "muted" : ""}`}
                    >
                      {item.stage === "Not started" ? "—" : item.stage}
                    </span>
                    {item.stage !== "Not started" && (
                      <span className="stage-track" aria-hidden="true">
                        {item.stages.map((stage, index) => (
                          <i
                            key={stage}
                            className={
                              index <= item.stages.indexOf(item.stage)
                                ? "filled"
                                : ""
                            }
                          />
                        ))}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="icon-button row-arrow"
                      aria-label={`Open ${item.title}`}
                      onClick={() =>
                        item.kind === "System"
                          ? openProject(item.id)
                          : openFeature(item.id)
                      }
                    >
                      <ChevronRight size={17} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <Search size={30} />
          <h3>No matching {kind === "All" ? "items" : kind.toLowerCase()}</h3>
          <p>
            {status === "Declined" && kind === "Systems"
              ? "Systems start in work. Stopped systems appear under Cancelled; Declined is for feature requests."
              : "There are no records for this status and filter combination."}
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setKind("All");
              setSearch("");
              setOwner("All owners");
              setProduct("");
            }}
          >
            Clear filters
          </button>
        </div>
      )}
      <div className="panel-footer">
        Showing {items.length} of {all.length} items · Saved in this browser
      </div>
    </section>
  );
}
