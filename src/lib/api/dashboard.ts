import { apiRequest } from "./client";

export type DashboardTaskStatus = "BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE";
export type DashboardTaskPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export interface DashboardTaskStatusCount {
  status: DashboardTaskStatus;
  count: number;
}

export interface DashboardRecentTask {
  id: string;
  key: string;
  title: string;
  status: DashboardTaskStatus;
  priority: DashboardTaskPriority;
  updatedAt: string;
  project: {
    id: string;
    name: string;
  };
  assignee: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  } | null;
}

export interface DashboardSummary {
  activeProjects: number;
  openTasks: number;
  completedTasks: number;
  teamMembers: number;
  taskStatusCounts: DashboardTaskStatusCount[];
  recentTasks: DashboardRecentTask[];
}

export interface DashboardSummaryApiResponse {
  data: DashboardSummary;
}

export interface DashboardChartStatusCount {
  status: string;
  value: number;
  fill: string;
}

const STATUS_CHART_META: Record<DashboardTaskStatus, { label: string; fill: string }> = {
  BACKLOG: { label: "Backlog", fill: "var(--color-chart-3)" },
  TODO: { label: "Todo", fill: "var(--color-chart-2)" },
  IN_PROGRESS: { label: "In Progress", fill: "var(--color-chart-1)" },
  REVIEW: { label: "Review", fill: "var(--color-chart-4)" },
  DONE: { label: "Done", fill: "var(--color-chart-5)" },
};

export function mapTaskStatusCountsForChart(
  counts: DashboardTaskStatusCount[],
): DashboardChartStatusCount[] {
  return counts.map((item) => ({
    status: STATUS_CHART_META[item.status].label,
    value: item.count,
    fill: STATUS_CHART_META[item.status].fill,
  }));
}

export async function fetchDashboardSummary() {
  const response = await apiRequest<DashboardSummaryApiResponse>("/api/dashboard/summary");
  return response.data;
}
