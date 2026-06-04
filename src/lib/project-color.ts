const PROJECT_ACCENT_PALETTE = [
  {
    dot: "bg-blue-500",
    gradient: "from-blue-500 to-cyan-500",
    strip: "from-blue-500 to-cyan-500",
    progress: "from-blue-500 to-cyan-500",
  },
  {
    dot: "bg-violet-500",
    gradient: "from-violet-500 to-purple-500",
    strip: "from-violet-500 to-purple-500",
    progress: "from-violet-500 to-purple-500",
  },
  {
    dot: "bg-cyan-500",
    gradient: "from-cyan-500 to-sky-500",
    strip: "from-cyan-500 to-sky-500",
    progress: "from-cyan-500 to-sky-500",
  },
  {
    dot: "bg-emerald-500",
    gradient: "from-emerald-500 to-teal-500",
    strip: "from-emerald-500 to-teal-500",
    progress: "from-emerald-500 to-teal-500",
  },
  {
    dot: "bg-amber-500",
    gradient: "from-amber-500 to-yellow-500",
    strip: "from-amber-500 to-yellow-500",
    progress: "from-amber-500 to-yellow-500",
  },
  {
    dot: "bg-rose-500",
    gradient: "from-rose-500 to-pink-500",
    strip: "from-rose-500 to-pink-500",
    progress: "from-rose-500 to-pink-500",
  },
  {
    dot: "bg-orange-500",
    gradient: "from-orange-500 to-amber-500",
    strip: "from-orange-500 to-amber-500",
    progress: "from-orange-500 to-amber-500",
  },
  {
    dot: "bg-indigo-500",
    gradient: "from-indigo-500 to-violet-500",
    strip: "from-indigo-500 to-violet-500",
    progress: "from-indigo-500 to-violet-500",
  },
] as const;

export type ProjectAccent = (typeof PROJECT_ACCENT_PALETTE)[number];

export type ProjectColorInput = {
  id?: string | null;
  name: string;
};

function accentKey(projectId?: string | null, projectName?: string | null): string {
  const id = projectId?.trim();
  if (id) {
    return id;
  }
  const name = projectName?.trim();
  if (name) {
    return name;
  }
  return "project";
}

function accentIndexForKey(key: string): number {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash + key.charCodeAt(i) * (i + 1)) % 2_147_483_647;
  }
  return Math.abs(hash) % PROJECT_ACCENT_PALETTE.length;
}

export function getProjectAccent(
  projectOrId?: ProjectColorInput | string | null,
  projectName?: string | null,
): ProjectAccent {
  if (projectOrId !== null && typeof projectOrId === "object") {
    return PROJECT_ACCENT_PALETTE[
      accentIndexForKey(accentKey(projectOrId.id, projectOrId.name))
    ];
  }
  return PROJECT_ACCENT_PALETTE[accentIndexForKey(accentKey(projectOrId, projectName))];
}

export function getProjectAccentClasses(project: ProjectColorInput) {
  const accent = getProjectAccent(project);
  return {
    dot: accent.dot,
    strip: accent.strip,
    progress: accent.progress,
    gradient: accent.gradient,
  };
}

export function getProjectAccentDotClass(
  projectOrId?: ProjectColorInput | string | null,
  projectName?: string | null,
): string {
  return getProjectAccent(projectOrId, projectName).dot;
}

export function getProjectAccentGradient(
  projectOrId?: ProjectColorInput | string | null,
  projectName?: string | null,
): string {
  return getProjectAccent(projectOrId, projectName).gradient;
}

/** Tailwind `from-* to-*` classes for card strip and progress bar (same palette as sidebar dot). */
export function resolveProjectGradient(project: ProjectColorInput): string {
  return getProjectAccent(project).gradient;
}
