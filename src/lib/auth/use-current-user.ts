import { useQuery } from "@tanstack/react-query";
import { getMe } from "@/lib/api/auth";
import { getAuthToken } from "./token";

export function useCurrentUser() {
  const hasToken = typeof window !== "undefined" && !!getAuthToken();

  return useQuery({
    queryKey: ["auth", "me"],
    queryFn: getMe,
    enabled: hasToken,
    retry: false,
  });
}

export function nameToInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}
