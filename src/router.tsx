import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { isTransientApiError } from "./lib/api-error";
import type { Lang } from "./lib/i18n";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => failureCount < 2 && isTransientApiError(error),
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 5_000),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient, lang: "en" as Lang },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
