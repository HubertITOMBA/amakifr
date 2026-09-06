import { beforeEach, describe, expect, it, vi } from "vitest";

const { resolveApiActorMock, getMyProfileSection, parseProfileSection } =
  vi.hoisted(() => ({
    resolveApiActorMock: vi.fn(),
    getMyProfileSection: vi.fn(),
    parseProfileSection: vi.fn(),
  }));

vi.mock("@/lib/api/auth-resolve", () => ({
  resolveApiActor: resolveApiActorMock,
}));
vi.mock("@/lib/services/user/get-my-profile-section", () => ({
  getMyProfileSection,
  parseProfileSection,
}));

import { GET } from "@/app/api/v1/me/profile/route";

function getReq(url: string) {
  return {
    nextUrl: new URL(url),
  } as any;
}

describe("GET /api/v1/me/profile", () => {
  beforeEach(() => {
    resolveApiActorMock.mockReset();
    getMyProfileSection.mockReset();
    parseProfileSection.mockReset();
  });

  it("401 sans auth", async () => {
    resolveApiActorMock.mockResolvedValue(null);
    const res = await GET(getReq("http://localhost/api/v1/me/profile?section=summary"));
    expect(res.status).toBe(401);
  });

  it("summary au montage uniquement", async () => {
    resolveApiActorMock.mockResolvedValue({ userId: "u1" });
    parseProfileSection.mockReturnValue("summary");
    getMyProfileSection.mockResolvedValue({
      name: "Ada",
      email: "a@b.com",
      image: null,
      role: "MEMBRE",
      status: "Actif",
      hasIdentity: true,
      hasCoordonnees: false,
      hasContact: false,
    });
    const res = await GET(
      getReq("http://localhost/api/v1/me/profile?section=summary")
    );
    expect(res.status).toBe(200);
    expect(parseProfileSection).toHaveBeenCalledWith("summary");
    expect(getMyProfileSection).toHaveBeenCalledWith(
      { userId: "u1" },
      "summary"
    );
  });

  it("account au clic — section distincte", async () => {
    resolveApiActorMock.mockResolvedValue({ userId: "u1" });
    parseProfileSection.mockReturnValue("account");
    getMyProfileSection.mockResolvedValue({
      email: "a@b.com",
      role: "MEMBRE",
      status: "Actif",
      lastLogin: "2026-09-06T13:42:00.000Z",
      createdAt: "2024-01-01T00:00:00.000Z",
    });
    const res = await GET(
      getReq("http://localhost/api/v1/me/profile?section=account")
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.data.lastLogin).toBe("2026-09-06T13:42:00.000Z");
  });
});
