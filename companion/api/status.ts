import type { VercelRequest, VercelResponse } from "@vercel/node";
import { integrationStatus } from "../lib/integrations.js";
import { authorized, preflight, rejectUnauthorized } from "../lib/http.js";

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (preflight(request, response)) return;
  if (!authorized(request)) return rejectUnauthorized(response);
  return response.status(200).json(integrationStatus());
}
