import type { VercelRequest, VercelResponse } from "@vercel/node";
import { searchPages } from "../lib/integrations.js";
import { authorized, preflight, rejectError, rejectUnauthorized } from "../lib/http.js";

export default async function handler(request: VercelRequest, response: VercelResponse) {
  if (preflight(request, response)) return;
  if (!authorized(request)) return rejectUnauthorized(response);
  try {
    const query = typeof request.query.query === "string" ? request.query.query : "";
    return response.status(200).json({ pages: await searchPages(query) });
  } catch (error) {
    return rejectError(response, error);
  }
}
