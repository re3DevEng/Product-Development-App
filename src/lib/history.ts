import { STAGES, type AppState } from "./domain";
import { PROJECT_PHASES } from "./projects";

export const HISTORY_STATUSES = [
  "Archive",
  "Complete",
  "Declined",
  "Cancelled",
] as const;
export type HistoryStatus = (typeof HISTORY_STATUSES)[number];
export function historyItems(state: AppState, status: HistoryStatus) {
  return [
    ...state.features
      .filter((f) => f.status === status)
      .map((f) => ({
        id: f.id,
        number: f.number,
        title: f.title,
        description: f.description,
        kind: "Feature" as const,
        category: f.workType,
        priority: f.priority,
        owners: f.owners,
        products: f.products,
        stage: f.stage,
        stages: STAGES[f.workType].slice(1),
        roadmap: f.roadmap,
        updatedAt: f.updatedAt,
      })),
    ...state.projects
      .filter((p) => p.status === status)
      .map((p) => ({
        id: p.id,
        number: p.number,
        title: p.title,
        description: `${p.description} ${p.customer} ${p.version}`,
        kind: "System" as const,
        category: p.type,
        priority: p.priority,
        owners: p.owners,
        products: [p.product],
        stage: p.phase,
        stages: PROJECT_PHASES[p.type],
        roadmap: false,
        updatedAt: p.updatedAt,
      })),
  ];
}
