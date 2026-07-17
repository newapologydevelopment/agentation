import type { VercelRequest, VercelResponse } from "@vercel/node";
import { preflight, prepare } from "../lib/http.js";

export default function handler(request: VercelRequest, response: VercelResponse) {
  if (preflight(request, response)) return;
  prepare(response);
  return response.status(200).json({ status: "ok", service: "pinpoint-companion" });
}
