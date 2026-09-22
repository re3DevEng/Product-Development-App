import { STAGES, type Feature } from "@/lib/domain";
function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}
export function StageTrack({ feature }: { feature: Feature }) {
  return (
    <ReviewStageTrack stage={feature.stage} stages={STAGES[feature.workType]} />
  );
}
export function ReviewStageTrack({
  stage,
  stages,
}: {
  stage: string;
  stages: readonly string[];
}) {
  if (stage === "Not started") return null;
  return (
    <span className="stage-track" aria-hidden="true">
      {stages.slice(1).map((label, index) => (
        <i
          className={index < stages.indexOf(stage) ? "filled" : ""}
          key={label}
        />
      ))}
    </span>
  );
}
export function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`status status-${status.toLowerCase().replaceAll(" ", "-")}`}
    >
      <span />
      {status}
    </span>
  );
}
export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <span className={`priority priority-${priority.toLowerCase()}`}>
      <span className="priority-bars">
        <i />
        <i />
        <i />
      </span>
      {priority}
    </span>
  );
}
export function Avatars({ owners }: { owners: string[] }) {
  return owners.length ? (
    <div className="owners" title={owners.join(", ")}>
      <span className="avatar-stack">
        {owners.map((n, i) => (
          <span className={`avatar color-${i % 3}`} key={n}>
            {initials(n)}
          </span>
        ))}
      </span>
      <span className="owner-text">
        {owners.length > 1
          ? `${owners[0].split(" ")[0]} +${owners.length - 1}`
          : owners[0].split(" ")[0]}
      </span>
      <span className="sr-only">{owners.join(", ")}</span>
    </div>
  ) : (
    <span className="muted unassigned">Unassigned</span>
  );
}
