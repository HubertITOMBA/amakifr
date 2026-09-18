/**
 * Tests unitaires politique retention DB + authz + validation (lot 4.10).
 */
import { describe, expect, it, vi } from "vitest";
import {
  buildRetentionSnapshotFromPolicy,
  CreateRetentionPolicyDraftSchema,
  NOTES_FRAIS_RETENTION_POLICY_REQUIRED,
  requireActiveRetentionPolicy,
  type ActiveRetentionPolicy,
} from "@/lib/services/frais-avances/note-frais-retention-policy-service";
import {
  canUserReadNotesFraisRetentionPolicy,
  canUserWriteNotesFraisRetentionPolicy,
} from "@/lib/frais-avances/authz";
import { UserRole, UserStatus, AdminRole } from "@prisma/client";

const basePolicy: ActiveRetentionPolicy = {
  id: "pol-1",
  version: 1,
  p1Years: 10,
  p2Years: 10,
  p3Years: 10,
  exerciceClotureMois: 12,
  exerciceClotureJour: 31,
  reportsSansEcheance: true,
  motif: "test motif suffisamment long",
  effectiveAt: new Date("2026-09-18"),
  activatedAt: new Date("2026-09-18"),
  occVersion: 1,
};

describe("retention policy snapshot", () => {
  it("snapshot immuable depuis dateDepense", () => {
    const snap = buildRetentionSnapshotFromPolicy(
      basePolicy,
      new Date(Date.UTC(2023, 2, 1))
    );
    expect(snap.policyVersionId).toBe("pol-1");
    expect(snap.exerciceClotureAt.toISOString().slice(0, 10)).toBe("2023-12-31");
    expect(snap.retentionEndsAtP2.toISOString().slice(0, 10)).toBe("2033-12-31");
  });

  it("nouvelle version prospective ne change pas un snapshot figé", () => {
    const snapA = buildRetentionSnapshotFromPolicy(
      basePolicy,
      new Date(Date.UTC(2024, 0, 15))
    );
    const policyB = { ...basePolicy, id: "pol-2", version: 2, p2Years: 5 };
    const snapB = buildRetentionSnapshotFromPolicy(
      policyB,
      new Date(Date.UTC(2024, 0, 15))
    );
    // Snapshot A reste inchangé si on ne le recalcule pas
    expect(snapA.retentionEndsAtP2.toISOString().slice(0, 10)).toBe("2034-12-31");
    expect(snapB.retentionEndsAtP2.toISOString().slice(0, 10)).toBe("2029-12-31");
    expect(snapA.policyVersionId).not.toBe(snapB.policyVersionId);
  });

  it("fail-closed sans politique ACTIVE", async () => {
    const client = {
      noteFraisRetentionPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    };
    await expect(requireActiveRetentionPolicy(client as never)).rejects.toThrow(
      NOTES_FRAIS_RETENTION_POLICY_REQUIRED
    );
  });

  it("validation bornes — années hors plage", () => {
    expect(() =>
      CreateRetentionPolicyDraftSchema.parse({
        p1Years: 0,
        p2Years: 10,
        p3Years: 10,
        reportsSansEcheance: true,
        motif: "motif assez long pour passer",
        effectiveAt: new Date(),
      })
    ).toThrow();
    expect(() =>
      CreateRetentionPolicyDraftSchema.parse({
        p1Years: 10,
        p2Years: 10,
        p3Years: 10,
        exerciceClotureMois: 4,
        exerciceClotureJour: 31,
        reportsSansEcheance: true,
        motif: "motif assez long pour passer",
        effectiveAt: new Date(),
      })
    ).toThrow();
  });

  it("V1 refuse reportsSansEcheance=false", () => {
    expect(() =>
      CreateRetentionPolicyDraftSchema.parse({
        p1Years: 10,
        p2Years: 10,
        p3Years: 10,
        reportsSansEcheance: false,
        motif: "motif assez long pour passer",
        effectiveAt: new Date(),
      })
    ).toThrow();
  });

  it("V1 refuse effectiveAt dans le futur", () => {
    expect(() =>
      CreateRetentionPolicyDraftSchema.parse({
        p1Years: 10,
        p2Years: 10,
        p3Years: 10,
        reportsSansEcheance: true,
        motif: "motif assez long pour passer",
        effectiveAt: new Date(Date.now() + 86_400_000),
      })
    ).toThrow();
  });

  it("ACTIVE avec reportsSansEcheance=false → getActive null (fail-closed)", async () => {
    const { getActiveRetentionPolicy } = await import(
      "@/lib/services/frais-avances/note-frais-retention-policy-service"
    );
    const client = {
      noteFraisRetentionPolicyVersion: {
        findFirst: vi.fn().mockResolvedValue({
          id: "bad",
          version: 1,
          p1Years: 10,
          p2Years: 10,
          p3Years: 10,
          exerciceClotureMois: 12,
          exerciceClotureJour: 31,
          reportsSansEcheance: false,
          motif: "x",
          effectiveAt: new Date(),
          activatedAt: new Date(),
          occVersion: 1,
        }),
      },
    };
    expect(await getActiveRetentionPolicy(client as never)).toBeNull();
  });
});

function mockAuthzClient(user: {
  id: string;
  role: UserRole;
  status: UserStatus;
  extras?: AdminRole[];
}) {
  return {
    user: {
      findUnique: vi.fn().mockResolvedValue({
        id: user.id,
        role: user.role,
        status: user.status,
      }),
    },
    userAdminRole: {
      findMany: vi.fn().mockResolvedValue(
        (user.extras ?? []).map((role) => ({ role }))
      ),
    },
  };
}

describe("authz conservation", () => {
  it("ADMIN peut écrire", async () => {
    const c = mockAuthzClient({
      id: "u1",
      role: UserRole.ADMIN,
      status: UserStatus.Actif,
    });
    expect(await canUserWriteNotesFraisRetentionPolicy("u1", c as never)).toBe(
      true
    );
    expect(await canUserReadNotesFraisRetentionPolicy("u1", c as never)).toBe(
      true
    );
  });

  it("TRESOR lecture seule — pas d'écriture", async () => {
    const c = mockAuthzClient({
      id: "u2",
      role: UserRole.TRESOR,
      status: UserStatus.Actif,
    });
    expect(await canUserReadNotesFraisRetentionPolicy("u2", c as never)).toBe(
      true
    );
    expect(await canUserWriteNotesFraisRetentionPolicy("u2", c as never)).toBe(
      false
    );
  });

  it("COMCPT lecture seule", async () => {
    const c = mockAuthzClient({
      id: "u3",
      role: UserRole.COMCPT,
      status: UserStatus.Actif,
    });
    expect(await canUserReadNotesFraisRetentionPolicy("u3", c as never)).toBe(
      true
    );
    expect(await canUserWriteNotesFraisRetentionPolicy("u3", c as never)).toBe(
      false
    );
  });

  it("MEMBRE / PRESID / SECRET refusés lecture et écriture", async () => {
    for (const role of [UserRole.MEMBRE, UserRole.PRESID, UserRole.SECRET]) {
      const c = mockAuthzClient({
        id: `u-${role}`,
        role,
        status: UserStatus.Actif,
      });
      expect(
        await canUserReadNotesFraisRetentionPolicy(`u-${role}`, c as never)
      ).toBe(false);
      expect(
        await canUserWriteNotesFraisRetentionPolicy(`u-${role}`, c as never)
      ).toBe(false);
    }
  });
});
