import type { ProjectStatus } from "@/lib/mock-data";

export type ProjectsUrlStatus = "all" | ProjectStatus;

export type ProjectsSearch = {
  status?: ProjectsUrlStatus;
};

const PROJECT_URL_STATUSES: readonly ProjectsUrlStatus[] = [
  "all",
  "active",
  "planning",
  "on_hold",
  "completed",
] as const;

export function parseProjectsUrlStatus(value: unknown): ProjectsUrlStatus | undefined {
  if (typeof value !== "string") return undefined;
  return PROJECT_URL_STATUSES.includes(value as ProjectsUrlStatus)
    ? (value as ProjectsUrlStatus)
    : undefined;
}

export function projectListStatusFromUrl(status?: ProjectsUrlStatus): "all" | ProjectStatus {
  if (!status || status === "all") return "all";
  return status;
}

export function projectsUrlStatusFromFilter(filter: "all" | ProjectStatus): ProjectsUrlStatus {
  return filter;
}
