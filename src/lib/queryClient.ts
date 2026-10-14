import { QueryClient } from "@tanstack/react-query";

/**
 * Shared so the auth store can empty it on login and logout: most query keys
 * (["groups"], ["students"]…) are not tied to a user, so cached data would
 * otherwise carry over from one account to the next in the same tab.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Keep data fresh for 1 min so navigating back doesn't re-flash skeletons
      staleTime: 60_000,
      // Keep cached data for 5 min after a query is unused
      gcTime: 5 * 60_000,
      // Avoid jarring refetch-on-focus loops during a live demo
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});
