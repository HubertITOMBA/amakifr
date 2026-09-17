import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  userFindUnique,
  userAdminRoleFindMany,
  resolveActionPermissionConfig,
} = vi.hoisted(() => ({
  userFindUnique: vi.fn(),
  userAdminRoleFindMany: vi.fn(),
  resolveActionPermissionConfig: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: (...a: unknown[]) => userFindUnique(...a) },
    userAdminRole: {
      findMany: (...a: unknown[]) => userAdminRoleFindMany(...a),
    },
  },
}));

vi.mock("@/lib/dynamic-permissions", () => ({
  resolveActionPermissionConfig: (...a: unknown[]) =>
    resolveActionPermissionConfig(...a),
}));

import {
  canUserCorrectNoteFraisReglement,
  canUserReadNoteFraisCorrectionAudit,
  canUserRecordNoteFraisRestitution,
  canUserReadNoteFraisRestitutionReference,
  canUserReadNoteFraisFinancialView,
  canUserReadSubmittedNotesFrais,
  canUserRequestCancelNoteFraisReglement,
  canUserConfirmCancelNoteFraisReglement,
  canUserRefuseCancelNoteFraisReglement,
  canUserReadNoteFraisAnnulationAudit,
} from "@/lib/frais-avances/authz";

describe("canUserReadSubmittedNotesFrais (restrictive)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
  });

  it("accepte ADMIN|PRESID|SECRET|TRESOR principaux actifs", async () => {
    for (const role of ["ADMIN", "PRESID", "SECRET", "TRESOR"] as const) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      expect(await canUserReadSubmittedNotesFrais(`u-${role}`)).toBe(true);
    }
  });

  it("accepte rôle additionnel TRESOR / PRESID / SECRET / ADMIN", async () => {
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([{ role: "TRESOR" }]);
    expect(await canUserReadSubmittedNotesFrais("m-tresor")).toBe(true);

    userAdminRoleFindMany.mockResolvedValue([{ role: "PRESID" }]);
    expect(await canUserReadSubmittedNotesFrais("m-presid")).toBe(true);

    userAdminRoleFindMany.mockResolvedValue([{ role: "SECRET" }]);
    expect(await canUserReadSubmittedNotesFrais("m-secret")).toBe(true);

    userAdminRoleFindMany.mockResolvedValue([{ role: "ADMIN" }]);
    expect(await canUserReadSubmittedNotesFrais("m-admin")).toBe(true);
  });

  it("refuse MEMBRE / COMCPT seuls même si permission dynamique large", async () => {
    resolveActionPermissionConfig.mockResolvedValue({
      status: "configured",
      roles: ["MEMBRE", "COMCPT", "ADMIN", "TRESOR"],
    });
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    expect(await canUserReadSubmittedNotesFrais("membre")).toBe(false);

    userFindUnique.mockResolvedValue({ role: "COMCPT", status: "Actif" });
    expect(await canUserReadSubmittedNotesFrais("compt")).toBe(false);
  });

  it("refuse compte Inactif", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Inactif" });
    expect(await canUserReadSubmittedNotesFrais("inactif")).toBe(false);
  });

  it("permission disabled : refus sauf ADMIN principal bypass", async () => {
    resolveActionPermissionConfig.mockResolvedValue({ status: "disabled" });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserReadSubmittedNotesFrais("t")).toBe(false);
    userFindUnique.mockResolvedValue({ role: "PRESID", status: "Actif" });
    expect(await canUserReadSubmittedNotesFrais("p")).toBe(false);
    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    expect(await canUserReadSubmittedNotesFrais("a")).toBe(true);
  });

  it("permission configurée : hors liste refusée ; dans liste OK", async () => {
    resolveActionPermissionConfig.mockResolvedValue({
      status: "configured",
      roles: ["TRESOR"],
    });
    userFindUnique.mockResolvedValue({ role: "PRESID", status: "Actif" });
    expect(await canUserReadSubmittedNotesFrais("presid")).toBe(false);
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserReadSubmittedNotesFrais("tres")).toBe(true);
  });

  it("permission absente : rôle dur suffit", async () => {
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
    userFindUnique.mockResolvedValue({ role: "SECRET", status: "Actif" });
    expect(await canUserReadSubmittedNotesFrais("s")).toBe(true);
  });
});

describe("canUserReadNoteFraisFinancialView (restrictive)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
  });

  it("ADMIN TRESOR COMCPT oui ; PRESID SECRET MEMBRE non ; Inactif non", async () => {
    for (const role of ["ADMIN", "TRESOR", "COMCPT"] as const) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      expect(await canUserReadNoteFraisFinancialView(`u-${role}`)).toBe(true);
    }
    for (const role of ["PRESID", "SECRET", "MEMBRE"] as const) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      expect(await canUserReadNoteFraisFinancialView(`u-${role}`)).toBe(false);
    }
    userFindUnique.mockResolvedValue({ role: "COMCPT", status: "Inactif" });
    expect(await canUserReadNoteFraisFinancialView("u-inactif")).toBe(false);
  });

  it("rôle additionnel COMCPT OK ; MEMBRE seul non", async () => {
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([{ role: "COMCPT" }]);
    expect(await canUserReadNoteFraisFinancialView("m-compt")).toBe(true);
    userAdminRoleFindMany.mockResolvedValue([]);
    expect(await canUserReadNoteFraisFinancialView("m")).toBe(false);
  });

  it("disabled : refus sauf ADMIN principal ; configurée hors liste refus", async () => {
    resolveActionPermissionConfig.mockResolvedValue({ status: "disabled" });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserReadNoteFraisFinancialView("t")).toBe(false);
    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    expect(await canUserReadNoteFraisFinancialView("a")).toBe(true);

    resolveActionPermissionConfig.mockResolvedValue({
      status: "configured",
      roles: ["ADMIN"],
    });
    userFindUnique.mockResolvedValue({ role: "COMCPT", status: "Actif" });
    expect(await canUserReadNoteFraisFinancialView("c")).toBe(false);
  });
});

describe("canUserCorrectNoteFraisReglement", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
  });

  it("accepte TRESOR|ADMIN principaux et additionnels", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserCorrectNoteFraisReglement("t")).toBe(true);
    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    expect(await canUserCorrectNoteFraisReglement("a")).toBe(true);

    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([{ role: "TRESOR" }]);
    expect(await canUserCorrectNoteFraisReglement("m-t")).toBe(true);
  });

  it("refuse COMCPT|PRESID|SECRET|MEMBRE|Inactif", async () => {
    for (const role of ["COMCPT", "PRESID", "SECRET", "MEMBRE"] as const) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      userAdminRoleFindMany.mockResolvedValue([]);
      expect(await canUserCorrectNoteFraisReglement(`u-${role}`)).toBe(false);
    }
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Inactif" });
    expect(await canUserCorrectNoteFraisReglement("inact")).toBe(false);
  });

  it("dynamique restrictive + ADMIN bypass", async () => {
    resolveActionPermissionConfig.mockResolvedValue({ status: "disabled" });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserCorrectNoteFraisReglement("t")).toBe(false);
    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    expect(await canUserCorrectNoteFraisReglement("a")).toBe(true);

    resolveActionPermissionConfig.mockResolvedValue({
      status: "configured",
      roles: ["ADMIN"],
    });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserCorrectNoteFraisReglement("t2")).toBe(false);
  });

  it("audit correction = même capacité que correcteur", async () => {
    userFindUnique.mockResolvedValue({ role: "COMCPT", status: "Actif" });
    expect(await canUserReadNoteFraisCorrectionAudit("c")).toBe(false);
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserReadNoteFraisCorrectionAudit("t")).toBe(true);
  });
});

describe("canUserRecordNoteFraisRestitution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userAdminRoleFindMany.mockResolvedValue([]);
    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
  });

  it("accepte TRESOR|ADMIN principaux", async () => {
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserRecordNoteFraisRestitution("t")).toBe(true);
    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    expect(await canUserRecordNoteFraisRestitution("a")).toBe(true);
  });

  it("accepte ADMIN/TRESOR additionnels", async () => {
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([{ role: "TRESOR" }]);
    expect(await canUserRecordNoteFraisRestitution("m-t")).toBe(true);
    userAdminRoleFindMany.mockResolvedValue([{ role: "ADMIN" }]);
    expect(await canUserRecordNoteFraisRestitution("m-a")).toBe(true);
  });

  it("refuse COMCPT|PRESID|SECRET|MEMBRE|Inactif", async () => {
    for (const role of ["COMCPT", "PRESID", "SECRET", "MEMBRE"] as const) {
      userFindUnique.mockResolvedValue({ role, status: "Actif" });
      userAdminRoleFindMany.mockResolvedValue([]);
      expect(await canUserRecordNoteFraisRestitution(`u-${role}`)).toBe(false);
    }
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Inactif" });
    expect(await canUserRecordNoteFraisRestitution("inact")).toBe(false);
  });

  it("MEMBRE avec permission dynamique WRITE refusée sans élargissement", async () => {
    resolveActionPermissionConfig.mockResolvedValue({
      status: "configured",
      roles: ["MEMBRE", "COMCPT", "ADMIN", "TRESOR"],
    });
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    userAdminRoleFindMany.mockResolvedValue([]);
    expect(await canUserRecordNoteFraisRestitution("m")).toBe(false);
  });

  it("permission disabled refuse TRESOR ; ADMIN principal bypass", async () => {
    resolveActionPermissionConfig.mockResolvedValue({ status: "disabled" });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserRecordNoteFraisRestitution("t")).toBe(false);
    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    expect(await canUserRecordNoteFraisRestitution("a")).toBe(true);
  });

  it("permission configurée hors rôle refuse ; absente autorise métier", async () => {
    resolveActionPermissionConfig.mockResolvedValue({
      status: "configured",
      roles: ["ADMIN"],
    });
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserRecordNoteFraisRestitution("t")).toBe(false);

    resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
    expect(await canUserRecordNoteFraisRestitution("t2")).toBe(true);
  });

  it("lecture référence restitution ADMIN/TRESOR uniquement ; COMCPT refusé", async () => {
    userFindUnique.mockResolvedValue({ role: "COMCPT", status: "Actif" });
    expect(await canUserReadNoteFraisRestitutionReference("c")).toBe(false);
    userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
    expect(await canUserReadNoteFraisRestitutionReference("t")).toBe(true);
    userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
    expect(await canUserReadNoteFraisRestitutionReference("a")).toBe(true);
    userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
    expect(await canUserReadNoteFraisRestitutionReference("m")).toBe(false);
  });
});

const ANNULATION_PERMS = [
  {
    label: "requestCancelNoteFraisReglement",
    action: "requestCancelNoteFraisReglement",
    fn: canUserRequestCancelNoteFraisReglement,
  },
  {
    label: "confirmCancelNoteFraisReglement",
    action: "confirmCancelNoteFraisReglement",
    fn: canUserConfirmCancelNoteFraisReglement,
  },
  {
    label: "refuseCancelNoteFraisReglement",
    action: "refuseCancelNoteFraisReglement",
    fn: canUserRefuseCancelNoteFraisReglement,
  },
  {
    label: "readNoteFraisAnnulationAudit",
    action: "readNoteFraisAnnulationAudit",
    fn: canUserReadNoteFraisAnnulationAudit,
  },
] as const;

describe.each(ANNULATION_PERMS)(
  "annulation 4.8 — $label (matrice)",
  ({ action, fn }) => {
    beforeEach(() => {
      vi.clearAllMocks();
      userAdminRoleFindMany.mockResolvedValue([]);
      resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
    });

    it("accepte TRESOR|ADMIN principaux et additionnels", async () => {
      userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
      expect(await fn("t")).toBe(true);
      userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
      expect(await fn("a")).toBe(true);

      userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
      userAdminRoleFindMany.mockResolvedValue([{ role: "TRESOR" }]);
      expect(await fn("m-t")).toBe(true);
      userAdminRoleFindMany.mockResolvedValue([{ role: "ADMIN" }]);
      expect(await fn("m-a")).toBe(true);
    });

    it("refuse COMCPT|PRESID|SECRET|MEMBRE|Inactif", async () => {
      for (const role of ["COMCPT", "PRESID", "SECRET", "MEMBRE"] as const) {
        userFindUnique.mockResolvedValue({ role, status: "Actif" });
        userAdminRoleFindMany.mockResolvedValue([]);
        expect(await fn(`u-${role}`)).toBe(false);
      }
      userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Inactif" });
      expect(await fn("inact")).toBe(false);
    });

    it("MEMBRE avec permission dynamique large refusée sans rôle dur", async () => {
      resolveActionPermissionConfig.mockResolvedValue({
        status: "configured",
        roles: ["MEMBRE", "COMCPT", "ADMIN", "TRESOR"],
      });
      userFindUnique.mockResolvedValue({ role: "MEMBRE", status: "Actif" });
      userAdminRoleFindMany.mockResolvedValue([]);
      expect(await fn("m")).toBe(false);
    });

    it("permission disabled refuse TRESOR ; ADMIN principal bypass", async () => {
      resolveActionPermissionConfig.mockResolvedValue({ status: "disabled" });
      userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
      expect(await fn("t")).toBe(false);
      userFindUnique.mockResolvedValue({ role: "ADMIN", status: "Actif" });
      expect(await fn("a")).toBe(true);
    });

    it("permission configurée hors rôle refuse ; absente autorise métier", async () => {
      resolveActionPermissionConfig.mockResolvedValue({
        status: "configured",
        roles: ["ADMIN"],
      });
      userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
      expect(await fn("t")).toBe(false);
      expect(resolveActionPermissionConfig).toHaveBeenCalledWith(action);

      resolveActionPermissionConfig.mockResolvedValue({ status: "absent" });
      expect(await fn("t2")).toBe(true);
    });

    it("TRESOR dynamique : configurée avec TRESOR autorise", async () => {
      resolveActionPermissionConfig.mockResolvedValue({
        status: "configured",
        roles: ["TRESOR"],
      });
      userFindUnique.mockResolvedValue({ role: "TRESOR", status: "Actif" });
      expect(await fn("t-dyn")).toBe(true);
    });
  }
);
