import { createServer, type Server } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";

export interface DeploymentRequest { method: string; pathname: string; build: "A" | "B"; status: number }
export interface DeploymentServer {
  url: string;
  requests: DeploymentRequest[];
  acceptedBusinessWrites: number;
  publish(build: "A" | "B"): void;
  failAsset(pathname: string | null): void;
  missingAssets(mode: "404" | "html200"): void;
  close(): Promise<void>;
}

/** Serve one complete build at a time. Previous assets genuinely disappear.
 * All resources and the inert write counter exist only on loopback.
 */
export async function startDeploymentServer(builds: Record<"A" | "B", string>): Promise<DeploymentServer> {
  let active: "A" | "B" = "A";
  let failedAsset: string | null = null;
  let missingMode: "404" | "html200" = "404";
  let businessWrites = 0;
  const requests: DeploymentRequest[] = [];
  const server: Server = createServer(async (request, response) => {
    const pathname = new URL(request.url ?? "/", "http://127.0.0.1").pathname;
    const method = request.method ?? "GET";
    const record: DeploymentRequest = { method, pathname, build: active, status: 500 };
    requests.push(record);
    if (method === "GET" && pathname === "/__away") {
      record.status = 200;
      response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "public,max-age=300", "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'" });
      response.end("<!doctype html><title>Local away page</title><p>Local away page</p>");
      return;
    }
    if (method === "POST" && pathname === "/__business") {
      businessWrites++;
      request.resume();
      // Business acceptance committed, response deliberately uncertain. Never real email/payment/auth.
      record.status = 503;
      response.writeHead(503, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      response.end(JSON.stringify({ accepted: true, resultUnavailable: true }));
      return;
    }
    if (method !== "GET" && method !== "HEAD") {
      record.status = 405;
      response.writeHead(405).end();
      return;
    }
    const base = path.resolve(builds[active]);
    let relative: string;
    try { relative = decodeURIComponent(pathname).replace(/^\/+/, ""); }
    catch { record.status = 400; response.writeHead(400).end(); return; }
    const target = path.resolve(base, relative || "index.html");
    if (target !== base && !target.startsWith(base + path.sep)) {
      record.status = 400;
      response.writeHead(400).end();
      return;
    }
    const sendMissing = async () => {
      if (missingMode === "html200" && pathname.startsWith("/assets/")) {
        record.status = 200;
        response.writeHead(200, { "Content-Type": "text/html", "Cache-Control": "no-cache" });
        response.end(await readFile(path.join(base, "index.html")));
        return;
      }
      record.status = 404;
      response.writeHead(404, { "Content-Type": "text/plain", "Cache-Control": "no-store" }).end("Asset no longer available");
    };
    if (pathname === failedAsset) { await sendMissing(); return; }
    let bytes: Buffer;
    let extension = path.extname(target);
    try { bytes = await readFile(target); }
    catch {
      // Match the intended Hosting contract: assets are never the SPA index.
      if (pathname.startsWith("/assets/") || extension) { await sendMissing(); return; }
      try { bytes = await readFile(path.join(base, "index.html")); extension = ".html"; }
      catch { await sendMissing(); return; }
    }
    record.status = 200;
    const contentType = ({ ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".json": "application/json", ".svg": "image/svg+xml" } as Record<string, string>)[extension] ?? "application/octet-stream";
    response.writeHead(200, { "Content-Type": contentType, "Cache-Control": extension === ".html" ? "no-cache" : "no-store" });
    response.end(method === "HEAD" ? undefined : bytes);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Loopback deployment server did not bind");
  return {
    url: `http://127.0.0.1:${address.port}`,
    requests,
    get acceptedBusinessWrites() { return businessWrites; },
    publish(build) { active = build; },
    failAsset(pathname) { failedAsset = pathname; },
    missingAssets(mode) { missingMode = mode; },
    async close() { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); },
  };
}
