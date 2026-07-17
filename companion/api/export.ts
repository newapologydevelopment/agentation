import type { VercelRequest, VercelResponse } from "@vercel/node";
import { exportReview } from "../lib/integrations.js";
import { authorized, preflight, rejectError, rejectUnauthorized } from "../lib/http.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (preflight(request, response)) return;
  if (!authorized(request)) return rejectUnauthorized(response);
  if (request.method !== "POST") return response.status(405).json({ error: "Method not allowed" });
  try {
    return response.status(200).json(await exportReview(request.body));
  } catch (error) {
    return rejectError(response, error);
  }
}
