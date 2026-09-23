import type { AppState, Feature, FeatureFields } from "./domain";

export function makeSampleState(): AppState {
  const products = [
    "Gigabot 4",
    "Gigabot 5",
    "GigabotX",
    "Terabot",
    "All products",
  ];
  const members = ["Alex Morgan", "Jordan Lee", "Sam Rivera", "Taylor Chen"];
  const rows: (Partial<FeatureFields> & {
    title: string;
    description: string;
  })[] = [
    {
      title: "Redesign the touchscreen enclosure",
      description:
        "Improve the viewing angle and service access for the operator touchscreen. Evaluate a mounting design that can be adjusted without removing the front panel.\n\nSuccess looks like a cleaner installation and easier access during maintenance.",
      workType: "ECR",
      stage: "PDR",
      priority: "High",
      roadmap: true,
      owners: [members[0], members[1]],
      products: ["Gigabot 5"],
    },
    {
      title: "Evaluate a high-flow hotend",
      description:
        "Compare candidate hotends for larger prints. Document flow rate, repeatability, and compatibility with the current toolhead before selecting a direction.",
      workType: "ECR",
      stage: "SRR",
      priority: "High",
      roadmap: true,
      owners: [members[1]],
      products: ["GigabotX", "Gigabot 5"],
    },
    {
      title: "Standardize the final inspection checklist",
      description:
        "Create a consistent final inspection sequence for the production team, including a place to record exceptions and follow-up work.",
      workType: "OCR",
      stage: "Final Review",
      roadmap: true,
      owners: [members[2]],
      products: ["All products"],
    },
    {
      title: "Improve cable carrier service access",
      description:
        "Review the routing and attachment points for the cable carrier. Make routine service possible without disturbing adjacent components.",
      workType: "ECR",
      stage: "CDR",
      owners: [members[0]],
      products: ["Terabot"],
    },
    {
      title: "Add a nozzle cleaning station",
      description:
        "Explore an automatic cleaning step before a print begins. Consider reliability, waste collection, and installation space.",
      roadmap: true,
      priority: "Low",
      products: ["Gigabot 5"],
    },
    {
      title: "Qualify an alternate build plate supplier",
      description:
        "Evaluate an alternate supplier against dimensional, surface finish, and packaging requirements. Capture first-article inspection results.",
      workType: "OCR",
      owners: [members[2], members[3]],
      priority: "High",
      products: ["Gigabot 4", "Gigabot 5"],
    },
    {
      title: "Simplify the maintenance quick-start guide",
      description:
        "Bring routine maintenance steps together in a short guide that can be used beside the machine. Link to detailed instructions where needed.",
      workType: "OCR",
      owners: [members[3]],
      priority: "Low",
      products: ["All products"],
    },
    {
      title: "Review electrical cabinet cooling",
      description:
        "Collect temperature measurements during extended prints and propose changes if components exceed the preferred operating range.",
      priority: "Medium",
      products: ["GigabotX"],
    },
    {
      title: "Update the spool holder bracket",
      description:
        "Improve bracket stiffness and reduce the number of fasteners needed during assembly.",
      workType: "ECR",
      stage: "Final Review",
      status: "Complete",
      owners: [members[0]],
      products: ["Gigabot 4"],
      roadmap: true,
    },
    {
      title: "Revise shipping accessory labels",
      description:
        "Use consistent part names on the accessory kit labels and packing checklist.",
      workType: "OCR",
      stage: "Final Review",
      status: "Complete",
      owners: [members[2]],
      products: ["All products"],
    },
    {
      title: "Explore an alternate filament cabinet",
      description:
        "Concept retained for a later hardware planning cycle. Reopen if storage requirements change.",
      workType: "ECR",
      stage: "SRR",
      status: "Archive",
      owners: [members[1]],
      products: ["Terabot"],
      roadmap: true,
    },
    {
      title: "Add a second operator display",
      description:
        "A second display was considered during a concept review. This sample request is declined because the adjustable single-display approach is preferred.",
      status: "Declined",
      priority: "Low",
      products: ["Gigabot 5"],
    },
  ];
  const today = new Date();
  const year = String(today.getFullYear());
  const features: Feature[] = rows.map((row, index) => {
    const created = new Date(
      today.getTime() - (index + 3) * 86400000,
    ).toISOString();
    const updated = new Date(today.getTime() - index * 86400000).toISOString();
    return {
      id: `sample-${index + 1}`,
      number: `${year}-${String(index + 1).padStart(3, "0")}`,
      revision: 1,
      hasStarted: !!row.workType,
      title: row.title,
      description: row.description,
      status: row.status ?? (row.workType ? "In-Work" : "Request"),
      priority: row.priority ?? "Medium",
      workType: row.workType ?? "Unassigned",
      stage: row.stage ?? "Not started",
      roadmap: row.roadmap ?? false,
      owners: row.owners ?? [],
      products: row.products ?? [],
      createdAt: created,
      updatedAt: updated,
      submittedBy: "Demo user",
      documents: [],
      activity: [
        {
          id: `sample-event-${index}`,
          at: created,
          actor: "Demo workspace",
          summary:
            "Created as an illustrative sample. This is not an imported AppSheet record.",
        },
      ],
    };
  });
  return {
    schema: 1,
    projects: [],
    projectCounters: {},
    software: [],
    softwareCounters: {},
    pdmItems: [],
    pdmCounter: 0,
    partChanges: [],
    features,
    products,
    members,
    counters: { [year]: rows.length },
  };
}
