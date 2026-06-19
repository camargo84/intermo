import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () =>
        Response.json({
          ok: true,
          time: new Date().toISOString(),
          commit: process.env.LOVABLE_COMMIT_SHA ?? null,
        }),
    },
  },
});
