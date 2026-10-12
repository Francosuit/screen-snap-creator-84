import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

// After a new version is published, old page files no longer exist: reload once to get the fresh version.
if (typeof window !== "undefined") {
  const reloadOnce = () => {
    const k = "suite-chunk-reload";
    if (sessionStorage.getItem(k)) return;
    sessionStorage.setItem(k, "1");
    window.location.reload();
  };
  window.addEventListener("vite:preloadError", (e) => { e.preventDefault(); reloadOnce(); });
  window.addEventListener("unhandledrejection", (e) => {
    if (String(e.reason?.message ?? e.reason).includes("dynamically imported module")) reloadOnce();
  });
  window.addEventListener("load", () => setTimeout(() => sessionStorage.removeItem("suite-chunk-reload"), 5000));
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
