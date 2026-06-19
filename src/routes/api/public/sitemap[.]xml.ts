import { createFileRoute } from "@tanstack/react-router";

const PUBLIC_ROUTES = ["/", "/login", "/signup", "/termos", "/privacidade"];

export const Route = createFileRoute("/api/public/sitemap/xml")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = `${url.protocol}//${url.host}`;
        const now = new Date().toISOString().slice(0, 10);
        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          PUBLIC_ROUTES.map(
            (p) =>
              `  <url><loc>${origin}${p}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq></url>`,
          ).join("\n") +
          `\n</urlset>\n`;
        return new Response(body, {
          status: 200,
          headers: { "Content-Type": "application/xml; charset=utf-8" },
        });
      },
    },
  },
});
