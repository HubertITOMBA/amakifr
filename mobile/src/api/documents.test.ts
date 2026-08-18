import { beforeEach, describe, expect, it, vi } from "vitest";

const { authenticatedFetch } = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
}));

vi.mock("@/auth/session", () => ({ authenticatedFetch }));

import { getMyDocuments } from "@/api/documents";

describe("documents API client", () => {
  beforeEach(() => {
    authenticatedFetch.mockReset();
  });

  it("getMyDocuments GET path exact, sans id client", async () => {
    authenticatedFetch.mockResolvedValue([]);
    await getMyDocuments();
    expect(authenticatedFetch).toHaveBeenCalledTimes(1);
    expect(authenticatedFetch).toHaveBeenCalledWith("/api/v1/me/documents");
    const path = authenticatedFetch.mock.calls[0][0] as string;
    expect(path).not.toContain("userId");
    expect(path).not.toContain("adherentId");
    expect(authenticatedFetch.mock.calls[0][1]).toBeUndefined();
  });
});
