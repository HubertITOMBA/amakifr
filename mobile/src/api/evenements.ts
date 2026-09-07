import { authenticatedFetch } from "@/auth/session";
import type {
  MyEventDetailDto,
  MyEventsListDto,
  MyEventsSummaryDto,
} from "@/api/types";

/**
 * GET /api/v1/me/evenements?summary=1
 */
export async function getMyEventsSummary(): Promise<MyEventsSummaryDto> {
  return authenticatedFetch<MyEventsSummaryDto>(
    "/api/v1/me/evenements?summary=1"
  );
}

/**
 * GET /api/v1/me/evenements
 */
export async function getMyEvents(options: {
  scope?: "upcoming" | "past";
  limit?: number;
  offset?: number;
} = {}): Promise<MyEventsListDto> {
  const params = new URLSearchParams();
  params.set("scope", options.scope ?? "upcoming");
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.offset != null) params.set("offset", String(options.offset));
  return authenticatedFetch<MyEventsListDto>(
    `/api/v1/me/evenements?${params.toString()}`
  );
}

/**
 * GET /api/v1/me/evenements/[id]
 */
export async function getMyEvent(id: string): Promise<MyEventDetailDto> {
  return authenticatedFetch<MyEventDetailDto>(
    `/api/v1/me/evenements/${encodeURIComponent(id)}`
  );
}

/**
 * POST /api/v1/me/evenements/[id]/inscription
 */
export async function registerMyEvent(
  id: string,
  body: { nombrePersonnes?: number; commentaires?: string } = {}
): Promise<{ inscriptionId: string; nombrePersonnes: number }> {
  return authenticatedFetch(
    `/api/v1/me/evenements/${encodeURIComponent(id)}/inscription`,
    { method: "POST", body }
  );
}

/**
 * DELETE /api/v1/me/evenements/[id]/inscription
 */
export async function withdrawMyEvent(
  id: string
): Promise<{ withdrawn: true }> {
  return authenticatedFetch(
    `/api/v1/me/evenements/${encodeURIComponent(id)}/inscription`,
    { method: "DELETE" }
  );
}
