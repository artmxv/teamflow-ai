import { cn } from "@/lib/utils";

const palette = [
  "bg-gradient-to-br from-indigo-500 to-violet-500",
  "bg-gradient-to-br from-blue-500 to-cyan-500",
  "bg-gradient-to-br from-fuchsia-500 to-pink-500",
  "bg-gradient-to-br from-emerald-500 to-teal-500",
  "bg-gradient-to-br from-amber-500 to-orange-500",
  "bg-gradient-to-br from-rose-500 to-red-500",
];

function colorFor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return palette[h % palette.length];
}

export function Avatar({
  id,
  initials,
  size = "md",
  className,
}: {
  id: string;
  initials: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  const sizes = {
    xs: "size-5 text-[9px]",
    sm: "size-6 text-[10px]",
    md: "size-8 text-xs",
    lg: "size-10 text-sm",
  } as const;
  return (
    <span
      className={cn(
        "inline-grid place-items-center rounded-full font-semibold text-white ring-2 ring-background",
        colorFor(id),
        sizes[size],
        className,
      )}
    >
      {initials}
    </span>
  );
}
