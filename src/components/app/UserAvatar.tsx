import { useEffect, useState } from "react";
import { Avatar } from "@/components/app/Avatar";
import { reportAvatarLoadFailure, useResolvedAvatarUrl } from "@/lib/avatar-url";
import { nameToInitials } from "@/lib/auth/use-current-user";
import { cn } from "@/lib/utils";

const sizeClasses = {
  xs: "size-5",
  sm: "size-6",
  md: "size-8",
  lg: "size-10",
  xl: "size-16",
} as const;

export type UserAvatarSize = keyof typeof sizeClasses;

export function UserAvatar({
  id,
  name,
  avatar,
  avatarUrl,
  size = "md",
  className,
}: {
  id: string;
  name: string;
  avatar?: string | null;
  avatarUrl?: string | null;
  size?: UserAvatarSize;
  className?: string;
}) {
  const src = useResolvedAvatarUrl(avatarUrl);
  const initials = avatar ?? nameToInitials(name);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [src]);

  if (src && !imageFailed) {
    return (
      <img
        key={src}
        src={src}
        alt=""
        referrerPolicy="no-referrer"
        className={cn(
          "inline-block shrink-0 rounded-full object-cover ring-2 ring-background",
          sizeClasses[size],
          className,
        )}
        onError={() => {
          reportAvatarLoadFailure(src);
          setImageFailed(true);
        }}
      />
    );
  }

  if (size === "xl") {
    return (
      <span
        className={cn(
          "inline-grid place-items-center rounded-2xl bg-gradient-brand text-lg font-semibold text-white shadow-glow ring-2 ring-background",
          sizeClasses[size],
          className,
        )}
      >
        {initials}
      </span>
    );
  }

  return <Avatar id={id} initials={initials} size={size} className={className} />;
}
