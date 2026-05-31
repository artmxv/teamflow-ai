export type Priority = "low" | "medium" | "high" | "urgent";
export type TaskStatus = "backlog" | "todo" | "in_progress" | "review" | "done";
export type ProjectStatus = "planning" | "active" | "on_hold" | "completed";
export type Role = "Owner" | "Admin" | "Member";

export interface Member {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  status: "active" | "invited" | "offline";
  joinedAt: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  progress: number;
  openTasks: number;
  totalTasks: number;
  members: string[]; // member ids
  color: string;
  dueDate: string;
  updatedAt: string;
}

export interface Comment {
  id: string;
  authorId: string;
  body: string;
  createdAt: string;
}

export interface Task {
  id: string;
  key: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: Priority;
  assigneeId: string | null;
  projectId: string;
  dueDate: string | null;
  labels: string[];
  comments: Comment[];
  checklist: { id: string; label: string; done: boolean }[];
  activity: { id: string; text: string; at: string }[];
  attachments: { id: string; name: string; size: string }[];
}

export const members: Member[] = [
  { id: "u1", name: "Alex Morgan", email: "alex@teamflow.ai", role: "Owner", avatar: "AM", status: "active", joinedAt: "2024-01-12" },
  { id: "u2", name: "Priya Shah", email: "priya@teamflow.ai", role: "Admin", avatar: "PS", status: "active", joinedAt: "2024-02-03" },
  { id: "u3", name: "Marcus Chen", email: "marcus@teamflow.ai", role: "Member", avatar: "MC", status: "active", joinedAt: "2024-03-21" },
  { id: "u4", name: "Sofia Reyes", email: "sofia@teamflow.ai", role: "Member", avatar: "SR", status: "offline", joinedAt: "2024-04-09" },
  { id: "u5", name: "Jonas Weber", email: "jonas@teamflow.ai", role: "Member", avatar: "JW", status: "active", joinedAt: "2024-05-17" },
  { id: "u6", name: "Lina Park", email: "lina@teamflow.ai", role: "Member", avatar: "LP", status: "invited", joinedAt: "2025-09-02" },
];

export const projects: Project[] = [
  {
    id: "p1",
    name: "Orion Web App",
    description: "Customer-facing dashboard rebuild with new design system.",
    status: "active",
    progress: 72,
    openTasks: 14,
    totalTasks: 52,
    members: ["u1", "u2", "u3", "u5"],
    color: "from-indigo-500 to-violet-500",
    dueDate: "2026-07-14",
    updatedAt: "2 hours ago",
  },
  {
    id: "p2",
    name: "Mobile App v3",
    description: "Native iOS and Android refresh with offline-first sync.",
    status: "active",
    progress: 41,
    openTasks: 28,
    totalTasks: 67,
    members: ["u2", "u4", "u5"],
    color: "from-blue-500 to-cyan-500",
    dueDate: "2026-09-30",
    updatedAt: "5 hours ago",
  },
  {
    id: "p3",
    name: "Marketing Site",
    description: "New marketing site with CMS and a/b testing.",
    status: "planning",
    progress: 12,
    openTasks: 9,
    totalTasks: 22,
    members: ["u1", "u3"],
    color: "from-fuchsia-500 to-pink-500",
    dueDate: "2026-08-01",
    updatedAt: "yesterday",
  },
  {
    id: "p4",
    name: "Data Pipeline",
    description: "Move analytics pipeline to streaming architecture.",
    status: "on_hold",
    progress: 30,
    openTasks: 6,
    totalTasks: 18,
    members: ["u3", "u5"],
    color: "from-amber-500 to-orange-500",
    dueDate: "2026-10-22",
    updatedAt: "3 days ago",
  },
  {
    id: "p5",
    name: "Q3 Launch Campaign",
    description: "Coordinated multi-channel launch for the new tier.",
    status: "active",
    progress: 58,
    openTasks: 11,
    totalTasks: 25,
    members: ["u2", "u4"],
    color: "from-emerald-500 to-teal-500",
    dueDate: "2026-07-30",
    updatedAt: "1 hour ago",
  },
  {
    id: "p6",
    name: "Onboarding Revamp",
    description: "Reduce time-to-value with guided onboarding flows.",
    status: "completed",
    progress: 100,
    openTasks: 0,
    totalTasks: 34,
    members: ["u1", "u2", "u4"],
    color: "from-slate-500 to-zinc-500",
    dueDate: "2026-05-01",
    updatedAt: "1 week ago",
  },
];

const sampleTitles: Record<TaskStatus, string[]> = {
  backlog: [
    "Define billing edge cases",
    "Audit accessibility on settings",
    "Spike: realtime presence",
  ],
  todo: [
    "Design empty states for projects",
    "Refactor auth middleware",
    "Add keyboard shortcuts overlay",
  ],
  in_progress: [
    "Build kanban drag-and-drop",
    "Integrate AI summary endpoint",
    "Migrate avatars to new storage",
  ],
  review: [
    "PR: task drawer accessibility",
    "PR: invite member modal",
  ],
  done: [
    "Set up design tokens",
    "Wire workspace switcher",
    "Ship landing page hero",
  ],
};

const labelsPool = ["frontend", "backend", "design", "ai", "infra", "bug", "docs"];
const priorities: Priority[] = ["low", "medium", "high", "urgent"];

let counter = 100;
function makeTask(projectId: string, status: TaskStatus, title: string): Task {
  counter += 1;
  const id = `t${counter}`;
  const assignee = members[counter % members.length].id;
  return {
    id,
    key: `TF-${counter}`,
    title,
    description:
      "Detailed acceptance criteria, links to design and tracking. Ensure the implementation matches the new design system and respects accessibility requirements.",
    status,
    priority: priorities[counter % priorities.length],
    assigneeId: assignee,
    projectId,
    dueDate: `2026-0${(counter % 9) + 1}-1${counter % 9}`,
    labels: [labelsPool[counter % labelsPool.length], labelsPool[(counter + 2) % labelsPool.length]],
    comments: [
      { id: `c${counter}-1`, authorId: "u2", body: "Pulled in latest mocks, looks good.", createdAt: "2h ago" },
      { id: `c${counter}-2`, authorId: "u3", body: "I'll pair on the tricky part tomorrow.", createdAt: "30m ago" },
    ],
    checklist: [
      { id: `ck${counter}-1`, label: "Define API contract", done: true },
      { id: `ck${counter}-2`, label: "Implement happy path", done: status === "done" || status === "review" },
      { id: `ck${counter}-3`, label: "Write tests", done: status === "done" },
      { id: `ck${counter}-4`, label: "Update docs", done: false },
    ],
    activity: [
      { id: `a${counter}-1`, text: "Alex created the task", at: "Yesterday 10:24" },
      { id: `a${counter}-2`, text: "Priya assigned to Marcus", at: "Today 09:02" },
      { id: `a${counter}-3`, text: "Status moved to " + status, at: "Today 11:40" },
    ],
    attachments: [
      { id: `at${counter}-1`, name: "spec-v2.pdf", size: "412 KB" },
      { id: `at${counter}-2`, name: "mockups.fig", size: "1.8 MB" },
    ],
  };
}

export const tasks: Task[] = (() => {
  const list: Task[] = [];
  (Object.keys(sampleTitles) as TaskStatus[]).forEach((s) => {
    sampleTitles[s].forEach((title, i) => {
      const proj = projects[i % 4].id;
      list.push(makeTask(proj, s, title));
    });
  });
  return list;
})();

export const activity = [
  { id: "ac1", who: "u2", action: "completed", target: "Wire workspace switcher", project: "Orion Web App", at: "12m ago" },
  { id: "ac2", who: "u3", action: "commented on", target: "Build kanban drag-and-drop", project: "Orion Web App", at: "34m ago" },
  { id: "ac3", who: "u5", action: "created", target: "Spike: realtime presence", project: "Mobile App v3", at: "1h ago" },
  { id: "ac4", who: "u1", action: "moved to review", target: "PR: invite member modal", project: "Marketing Site", at: "2h ago" },
  { id: "ac5", who: "u4", action: "assigned", target: "Audit accessibility", project: "Mobile App v3", at: "3h ago" },
  { id: "ac6", who: "u2", action: "uploaded", target: "spec-v2.pdf", project: "Orion Web App", at: "5h ago" },
];

export const suggestedPrompts = [
  "Summarize what shipped this week across Orion Web App",
  "Which tasks are at risk of slipping their due date?",
  "Draft a stand-up update for the Mobile App v3 team",
  "Generate a checklist for the new billing edge cases",
];

export const taskStatusCounts = [
  { status: "Backlog", value: 18, fill: "var(--color-chart-3)" },
  { status: "Todo", value: 12, fill: "var(--color-chart-2)" },
  { status: "In Progress", value: 9, fill: "var(--color-chart-1)" },
  { status: "Review", value: 4, fill: "var(--color-chart-4)" },
  { status: "Done", value: 27, fill: "var(--color-chart-5)" },
];

export const weeklyVelocity = [
  { day: "Mon", completed: 6, created: 9 },
  { day: "Tue", completed: 8, created: 7 },
  { day: "Wed", completed: 11, created: 10 },
  { day: "Thu", completed: 7, created: 12 },
  { day: "Fri", completed: 14, created: 8 },
  { day: "Sat", completed: 3, created: 2 },
  { day: "Sun", completed: 2, created: 1 },
];

export function getMember(id: string | null | undefined): Member | undefined {
  if (!id) return undefined;
  return members.find((m) => m.id === id);
}
export function getProject(id: string): Project | undefined {
  return projects.find((p) => p.id === id);
}

export const priorityMeta: Record<Priority, { label: string; className: string }> = {
  low: { label: "Low", className: "bg-muted text-muted-foreground" },
  medium: { label: "Medium", className: "bg-info/15 text-info" },
  high: { label: "High", className: "bg-warning/20 text-warning-foreground" },
  urgent: { label: "Urgent", className: "bg-destructive/15 text-destructive" },
};

export const projectStatusMeta: Record<ProjectStatus, { label: string; className: string }> = {
  planning: { label: "Planning", className: "bg-info/15 text-info" },
  active: { label: "Active", className: "bg-success/15 text-success" },
  on_hold: { label: "On hold", className: "bg-warning/20 text-warning-foreground" },
  completed: { label: "Completed", className: "bg-muted text-muted-foreground" },
};

export const statusColumns: { key: TaskStatus; title: string }[] = [
  { key: "backlog", title: "Backlog" },
  { key: "todo", title: "Todo" },
  { key: "in_progress", title: "In Progress" },
  { key: "review", title: "Review" },
  { key: "done", title: "Done" },
];
