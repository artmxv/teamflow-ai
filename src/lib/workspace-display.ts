/** Stored in DB for new signups (backend does not know UI locale). */
export const PERSONAL_WORKSPACE_NAME = "Workspace";

const PERSONAL_WORKSPACE_ALIASES = new Set([
  PERSONAL_WORKSPACE_NAME.toLowerCase(),
  "personal workspace",
  "teamflow workspace",
]);

const POSSESSIVE_WORKSPACE_PATTERN = /^.+[''`´]s\s+workspace$/i;

export function isPersonalWorkspaceName(name: string): boolean {
  const normalized = name.trim();
  if (!normalized) {
    return false;
  }
  if (PERSONAL_WORKSPACE_ALIASES.has(normalized.toLowerCase())) {
    return true;
  }
  return POSSESSIVE_WORKSPACE_PATTERN.test(normalized);
}

/** Short title for sidebar and compact UI. */
export function personalWorkspaceDisplayName(): string {
  return "Workspace";
}

export function displayWorkspaceName(name: string): string {
  if (isPersonalWorkspaceName(name)) {
    return personalWorkspaceDisplayName();
  }
  return name;
}

/** Name shown in workspace settings input for default/personal workspaces. */
export function workspaceSettingsDisplayName(name: string): string {
  return displayWorkspaceName(name);
}

/** Keep raw DB name when user did not customize a personal workspace. */
export function resolveWorkspaceNameForSave(rawDbName: string, formName: string): string {
  const trimmed = formName.trim();
  if (isPersonalWorkspaceName(rawDbName) && trimmed === workspaceSettingsDisplayName(rawDbName)) {
    return rawDbName.trim();
  }
  return trimmed;
}
