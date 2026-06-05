const WORKSPACE_ACCENT_PALETTE = [
  {
    dot: "bg-blue-500",
    gradient: "from-blue-500 to-cyan-500",
  },
  {
    dot: "bg-violet-500",
    gradient: "from-violet-500 to-purple-500",
  },
  {
    dot: "bg-cyan-500",
    gradient: "from-cyan-500 to-sky-500",
  },
  {
    dot: "bg-emerald-500",
    gradient: "from-emerald-500 to-teal-500",
  },
  {
    dot: "bg-amber-500",
    gradient: "from-amber-500 to-yellow-500",
  },
  {
    dot: "bg-rose-500",
    gradient: "from-rose-500 to-pink-500",
  },
  {
    dot: "bg-orange-500",
    gradient: "from-orange-500 to-amber-500",
  },
  {
    dot: "bg-indigo-500",
    gradient: "from-indigo-500 to-violet-500",
  },
] as const;

export type WorkspaceAccent = (typeof WORKSPACE_ACCENT_PALETTE)[number];

export type WorkspaceColorInput = {
  id?: string | null;
  slug?: string | null;
  name?: string | null;
};

function accentKey(workspace?: WorkspaceColorInput | null): string {
  const id = workspace?.id?.trim();
  if (id) {
    return id;
  }
  const slug = workspace?.slug?.trim();
  if (slug) {
    return slug;
  }
  const name = workspace?.name?.trim();
  if (name) {
    return name;
  }
  return "workspace";
}

function accentIndexForKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % 2_147_483_647;
  }
  return Math.abs(hash) % WORKSPACE_ACCENT_PALETTE.length;
}

export function getWorkspaceAccent(workspace?: WorkspaceColorInput | null): WorkspaceAccent {
  return WORKSPACE_ACCENT_PALETTE[accentIndexForKey(accentKey(workspace))];
}

export function getWorkspaceAccentClasses(workspace: WorkspaceColorInput) {
  const accent = getWorkspaceAccent(workspace);
  return {
    dot: accent.dot,
    gradient: accent.gradient,
  };
}
