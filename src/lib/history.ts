import { STAGES, type AppState } from "./domain";
import { PROJECT_PHASES } from "./projects";
import { SOFTWARE_STAGES, softwareProgress } from "./software";

export const HISTORY_STATUSES = [
  "Archive",
  "Complete",
  "Declined",
  "Cancelled",
] as const;
export type HistoryStatus = (typeof HISTORY_STATUSES)[number];
export function historyItems(state: AppState, status: HistoryStatus) {
  return [
    ...state.software
      .filter((s) => s.status === status)
      .map((s) => ({
        id: s.id,
        number: s.number,
        title: s.title,
        description: s.description,
        kind: "Software" as const,
        category: s.type,
        priority: s.priority,
        owners: s.owners,
        products: s.application ? [s.application] : [],
        stage: softwareProgress(s),
        stages: [...SOFTWARE_STAGES] as string[],
        roadmap: false,
        updatedAt: s.updatedAt,
      })),
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
