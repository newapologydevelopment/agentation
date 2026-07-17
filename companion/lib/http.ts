import type { VercelRequest, VercelResponse } from "@vercel/node";

export function prepare(response: VercelResponse) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  response.setHeader("Cache-Control", "no-store");
}

export function preflight(request: VercelRequest, response: VercelResponse): boolean {
  prepare(response);
  if (request.method !== "OPTIONS") return false;
  response.status(204).end();
  return true;
}

export function authorized(request: VercelRequest): boolean {
  return !!process.env.PINPOINT_ACCESS_PATH && request.query.access === process.env.PINPOINT_ACCESS_PATH;
}

export function rejectUnauthorized(response: VercelResponse) {
  return response.status(404).json({ error: "Not found" });
}

export function rejectError(response: VercelResponse, error: unknown) {
  return response.status(400).json({
    error: error instanceof Error ? error.message : "Request failed",
  });
}
