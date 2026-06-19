import { createFileRoute } from "@tanstack/react-router";

const BASE_URL = "https://intermo.com.br";
const PUBLIC_ROUTES = ["/", "/login", "/signup", "/termos", "/privacidade"];

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = new Date().toISOString().slice(0, 10);
        const body =
          `<?xml version="1.0" encoding="UTF-8"?>\n` +
          `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
          PUBLIC_ROUTES.map(
            (p) =>
              `  <url><loc>${BASE_URL}${p}</loc><lastmod>${now}</lastmod><changefreq>weekly</changefreq></url>`,
          ).join("\n") +
          `\n</urlset>\n`;
        return new Response(body, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
