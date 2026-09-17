import { STAGES, type Feature } from "@/lib/domain";
function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
}
export function StageTrack({ feature }: { feature: Feature }) {
  if (feature.stage === "Not started") return null;
  return (
    <span className="stage-track" aria-hidden="true">
      {STAGES[feature.workType].slice(1).map((stage, index) => (
        <i
          className={
            index < STAGES[feature.workType].indexOf(feature.stage)
              ? "filled"
              : ""
          }
          key={stage}
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
