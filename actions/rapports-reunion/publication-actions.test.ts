import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, canWrite, publishService, unpublishService } = vi.hoisted(
  () => ({
    authMock: vi.fn(),
    canWrite: vi.fn(),
    publishService: vi.fn(),
    unpublishService: vi.fn(),
  })
);

vi.mock("@/auth", () => ({
  auth: (...args: unknown[]) => authMock(...args),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {},
}));

vi.mock("@/lib/dynamic-permissions", () => ({
  canWrite: (...args: unknown[]) => canWrite(...args),
}));

vi.mock("@/lib/services/rapports-reunion/publication", () => ({
  publishRapportReunion: (...args: unknown[]) => publishService(...args),
  unpublishRapportReunion: (...args: unknown[]) => unpublishService(...args),
}));

import {
  publishRapportReunionAction,
  unpublishRapportReunionAction,
} from "@/actions/rapports-reunion";

beforeEach(() => {
  authMock.mockReset();
  canWrite.mockReset();
  publishService.mockReset();
  unpublishService.mockReset();
  authMock.mockResolvedValue({ user: { id: "admin-1" } });
});

describe("publishRapportReunionAction", () => {
  it("refuse si canWrite(updateRapportReunion) = false", async () => {
    canWrite.mockResolvedValue(false);

    const res = await publishRapportReunionAction("r1");

    expect(res).toEqual({
      success: false,
      error: "Droit de publication de rapport de réunion requis.",
    });
    expect(canWrite).toHaveBeenCalledWith("admin-1", "updateRapportReunion");
    expect(publishService).not.toHaveBeenCalled();
  });

  it("autorise et délègue au service de publication", async () => {
    canWrite.mockResolvedValue(true);
    const publishedAt = new Date("2026-10-08T12:00:00.000Z");
    publishService.mockResolvedValue({
      id: "r1",
      statut: "PUBLISHED",
      publishedAt,
    });

    const res = await publishRapportReunionAction("r1");

    expect(res).toEqual({
      success: true,
      message: "Rapport publié. Il est visible des adhérents.",
      statut: "PUBLISHED",
      publishedAt: publishedAt.toISOString(),
    });
    expect(publishService).toHaveBeenCalledWith("r1", "admin-1");
  });
});

describe("unpublishRapportReunionAction", () => {
  it("refuse si canWrite(updateRapportReunion) = false", async () => {
    canWrite.mockResolvedValue(false);

    const res = await unpublishRapportReunionAction("r1");

    expect(res).toEqual({
      success: false,
      error: "Droit de modification de rapport de réunion requis.",
    });
    expect(canWrite).toHaveBeenCalledWith("admin-1", "updateRapportReunion");
    expect(unpublishService).not.toHaveBeenCalled();
  });

  it("autorise et délègue au service de dépublication", async () => {
    canWrite.mockResolvedValue(true);
    unpublishService.mockResolvedValue({ id: "r1", statut: "DRAFT" });

    const res = await unpublishRapportReunionAction("r1");

    expect(res).toEqual({
      success: true,
      message:
        "Rapport repassé en brouillon. Les adhérents ne peuvent plus le consulter.",
      statut: "DRAFT",
    });
    expect(unpublishService).toHaveBeenCalledWith("r1", "admin-1");
  });
});
