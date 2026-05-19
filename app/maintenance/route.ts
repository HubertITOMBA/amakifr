import { readFileSync } from "fs";
import path from "path";

/**
 * Page de maintenance brute (HTTP 503) — sans layout React.
 * Servie lorsque MAINTENANCE_MODE=true (middleware) ou en accès direct pour test.
 */
export async function GET() {
  const htmlPath = path.join(process.cwd(), "public", "maintenance.html");
  const html = readFileSync(htmlPath, "utf-8");

  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, no-cache, must-revalidate",
      "Retry-After": "120",
    },
  });
}
