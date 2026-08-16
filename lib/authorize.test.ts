import { beforeEach, describe, expect, it, vi } from "vitest";
import { PermissionType } from "@prisma/client";
import type { AuthContext } from "@/lib/auth-context";
import { ServiceError } from "@/lib/service-error";

const { hasPermissionMock } = vi.hoisted(() => ({
  hasPermissionMock: vi.fn(),
}));

vi.mock("@/lib/dynamic-permissions", () => ({
  hasPermission: hasPermissionMock,
}));

import { authorize } from "@/lib/authorize";

function actor(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    userId: "user-1",
    role: "MEMBRE",
    status: "Actif",
    email: "u@example.com",
    name: "User",
    sessionId: null,
    adminRoles: [],
    adherentId: null,
    channel: "web",
    ...overrides,
  };
}

describe("authorize", () => {
  beforeEach(() => {
    hasPermissionMock.mockReset();
  });

  it("refuse si actor.userId est absent (UNAUTHENTICATED) sans appeler le moteur", async () => {
    await expect(
      authorize({
        actor: actor({ userId: "" }),
        permissionKey: "getAllDettesInitiales",
        type: "READ",
      })
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(hasPermissionMock).not.toHaveBeenCalled();
  });

  it("autorise ADMIN sans appeler le moteur de permissions", async () => {
    await expect(
      authorize({
        actor: actor({ role: "ADMIN" }),
        permissionKey: "getAllDettesInitiales",
        type: "READ",
      })
    ).resolves.toBeUndefined();
    expect(hasPermissionMock).not.toHaveBeenCalled();
  });

  it("autorise un non-admin si hasPermission retourne true", async () => {
    hasPermissionMock.mockResolvedValue(true);
    await expect(
      authorize({
        actor: actor({ role: "TRESOR" }),
        permissionKey: "getAllDettesInitiales",
        type: "READ",
      })
    ).resolves.toBeUndefined();
    expect(hasPermissionMock).toHaveBeenCalledTimes(1);
  });

  it("refuse avec FORBIDDEN si hasPermission retourne false", async () => {
    hasPermissionMock.mockResolvedValue(false);
    await expect(
      authorize({
        actor: actor(),
        permissionKey: "getAllDettesInitiales",
        type: "READ",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("préserve ServiceError FORBIDDEN (pas de transformation en INTERNAL_ERROR)", async () => {
    hasPermissionMock.mockResolvedValue(false);
    try {
      await authorize({
        actor: actor(),
        permissionKey: "getAllDettesInitiales",
        type: "READ",
      });
      expect.unreachable("authorize aurait dû lever une erreur");
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceError);
      expect((error as ServiceError).code).toBe("FORBIDDEN");
      expect((error as ServiceError).code).not.toBe("INTERNAL_ERROR");
    }
  });

  it("refuse (FORBIDDEN) si permission absente/disabled côté moteur (false)", async () => {
    // Comportement legacy hasPermission : absente/disabled → false pour non-ADMIN
    hasPermissionMock.mockResolvedValue(false);
    await expect(
      authorize({
        actor: actor({ role: "PRESID" }),
        permissionKey: "unknownAction",
        type: "WRITE",
      })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("refuse (INTERNAL_ERROR) si le moteur de permissions lève une erreur", async () => {
    hasPermissionMock.mockRejectedValue(new Error("Prisma down"));
    await expect(
      authorize({
        actor: actor(),
        permissionKey: "getAllDettesInitiales",
        type: "READ",
      })
    ).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
  });

  it("transmet permissionKey au moteur legacy", async () => {
    hasPermissionMock.mockResolvedValue(true);
    await authorize({
      actor: actor(),
      permissionKey: "createPaiement",
      type: "WRITE",
    });
    expect(hasPermissionMock).toHaveBeenCalledWith(
      "user-1",
      "createPaiement",
      PermissionType.WRITE
    );
  });

  it.each([
    ["READ", PermissionType.READ],
    ["WRITE", PermissionType.WRITE],
    ["DELETE", PermissionType.DELETE],
    ["MANAGE", PermissionType.MANAGE],
  ] as const)("transmet le type %s correctement", async (type, prismaType) => {
    hasPermissionMock.mockResolvedValue(true);
    await authorize({
      actor: actor(),
      permissionKey: "getAllDettesInitiales",
      type,
    });
    expect(hasPermissionMock).toHaveBeenCalledWith(
      "user-1",
      "getAllDettesInitiales",
      prismaType
    );
  });

  it("n'importe pas NextAuth / Request (dépendance pure AuthContext)", async () => {
    // Garde-fou architectural : authorize ne dépend que du mock hasPermission
    hasPermissionMock.mockResolvedValue(true);
    await authorize({
      actor: actor({ channel: "mobile" }),
      permissionKey: "getAllDettesInitiales",
      type: "READ",
    });
    expect(hasPermissionMock).toHaveBeenCalled();
  });
});
