/**
 * Project identity palette — decorative accents, not status/priority semantics.
 * Avoids exact status blue/green/amber and priority violet/orange/red tokens.
 */
const PROJECT_ACCENT_PALETTE = [
  {
    // indigo
    dot: "bg-indigo-400",
    gradient: "from-indigo-400 to-blue-700",
    strip: "from-indigo-400 to-blue-700",
    progress: "from-indigo-400 to-blue-700",
  },
  {
    // fuchsia
    dot: "bg-fuchsia-500",
    gradient: "from-fuchsia-500 to-pink-400",
    strip: "from-fuchsia-500 to-pink-400",
    progress: "from-fuchsia-500 to-pink-400",
  },
  {
    // aqua
    dot: "bg-teal-400",
    gradient: "from-teal-400 to-sky-600",
    strip: "from-teal-400 to-sky-600",
    progress: "from-teal-400 to-sky-600",
  },
  {
    // mint
    dot: "bg-lime-500",
    gradient: "from-lime-400 to-green-600",
    strip: "from-lime-400 to-green-600",
    progress: "from-lime-400 to-green-600",
  },
  {
    // lavender
    dot: "bg-purple-300",
    gradient: "from-purple-300 to-indigo-400",
    strip: "from-purple-300 to-indigo-400",
    progress: "from-purple-300 to-indigo-400",
  },
  {
    // rosewood
    dot: "bg-rose-800",
    gradient: "from-rose-800 to-rose-400",
    strip: "from-rose-800 to-rose-400",
    progress: "from-rose-800 to-rose-400",
  },
  {
    // periwinkle
    dot: "bg-sky-700",
    gradient: "from-sky-700 to-indigo-300",
    strip: "from-sky-700 to-indigo-300",
    progress: "from-sky-700 to-indigo-300",
  },
  {
    // coral-muted
    dot: "bg-pink-400",
    gradient: "from-pink-400 to-rose-200",
    strip: "from-pink-400 to-rose-200",
    progress: "from-pink-400 to-rose-200",
  },
] as const;

/**
 * Extra decorative identities used only after the base palette is fully taken
 * in a workspace. Avoids status/priority tokens (info blue, amber, success green,
 * violet-500 medium, red-500 urgent) and exact base-palette gradients.
 * Order must match server `PROJECT_COLOR_EXTENDED`.
 */
const PROJECT_ACCENT_EXTENDED = [
  {
    // deep cyan
    dot: "bg-cyan-700",
    gradient: "from-cyan-700 to-teal-300",
    strip: "from-cyan-700 to-teal-300",
    progress: "from-cyan-700 to-teal-300",
  },
  {
    // olive
    dot: "bg-yellow-700",
    gradient: "from-yellow-700 to-lime-300",
    strip: "from-yellow-700 to-lime-300",
    progress: "from-yellow-700 to-lime-300",
  },
  {
    // stone
    dot: "bg-stone-500",
    gradient: "from-stone-500 to-zinc-300",
    strip: "from-stone-500 to-zinc-300",
    progress: "from-stone-500 to-zinc-300",
  },
  {
    // wine
    dot: "bg-red-900",
    gradient: "from-red-900 to-orange-300",
    strip: "from-red-900 to-orange-300",
    progress: "from-red-900 to-orange-300",
  },
  {
    // midnight
    dot: "bg-blue-900",
    gradient: "from-blue-900 to-violet-300",
    strip: "from-blue-900 to-violet-300",
    progress: "from-blue-900 to-violet-300",
  },
  {
    // pine
    dot: "bg-emerald-800",
    gradient: "from-emerald-800 to-cyan-300",
    strip: "from-emerald-800 to-cyan-300",
    progress: "from-emerald-800 to-cyan-300",
  },
  {
    // plum
    dot: "bg-fuchsia-800",
    gradient: "from-fuchsia-800 to-purple-300",
    strip: "from-fuchsia-800 to-purple-300",
    progress: "from-fuchsia-800 to-purple-300",
  },
  {
    // copper
    dot: "bg-orange-800",
    gradient: "from-orange-800 to-yellow-300",
    strip: "from-orange-800 to-yellow-300",
    progress: "from-orange-800 to-yellow-300",
  },
] as const;

/**
 * Previous rotation values still stored on existing projects.
 * Kept so stored `project.color` remains the visual source of truth (no mass recolor).
 */
const LEGACY_PROJECT_ACCENT_PALETTE = [
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

const KNOWN_ACCENTS = [
  ...PROJECT_ACCENT_PALETTE,
  ...PROJECT_ACCENT_EXTENDED,
  ...LEGACY_PROJECT_ACCENT_PALETTE,
] as const;

export type ProjectAccent = {
  dot: string;
  gradient: string;
  strip: string;
  progress: string;
};

export type ProjectColorInput = {
  id?: string | null;
  name: string;
  color?: string | null;
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

function accentFromStoredColor(color?: string | null): ProjectAccent | null {
  const normalized = color?.trim();
  if (!normalized) return null;
  const known = KNOWN_ACCENTS.find((accent) => accent.gradient === normalized);
  if (known) {
    return known;
  }
  // Unknown stored gradient: keep it for strips/progress; pick a stable dot from the identity palette.
  if (/^from-[\w-]+ to-[\w-]+$/.test(normalized)) {
    const fallbackDot = PROJECT_ACCENT_PALETTE[accentIndexForKey(normalized)].dot;
    return {
      dot: fallbackDot,
      gradient: normalized,
      strip: normalized,
      progress: normalized,
    };
  }
  return null;
}

export function getProjectAccent(
  projectOrId?: ProjectColorInput | string | null,
  projectName?: string | null,
): ProjectAccent {
  if (projectOrId !== null && typeof projectOrId === "object") {
    const stored = accentFromStoredColor(projectOrId.color);
    if (stored) {
      return stored;
    }
    return PROJECT_ACCENT_PALETTE[accentIndexForKey(accentKey(projectOrId.id, projectOrId.name))];
  }
  return PROJECT_ACCENT_PALETTE[accentIndexForKey(accentKey(projectOrId, projectName))];
}

/** Tailwind `from-* to-*` classes for card strip and progress bar (same palette as sidebar dot). */
export function resolveProjectGradient(project: ProjectColorInput): string {
  return getProjectAccent(project).gradient;
}
