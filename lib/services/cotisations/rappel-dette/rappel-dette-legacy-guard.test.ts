import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import {
  RAPPEL_DETTE_LEGACY_CHANNEL_DISABLED_CODE,
  assertLegacyRappelChannelsAllowed,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-legacy-guard";
import { RAPPEL_DETTE_ENVOI_ENABLED } from "@/lib/services/cotisations/rappel-dette/rappel-dette-activation";

describe("rappel-dette-legacy-guard", () => {
  it("flag dépôt off par défaut → legacy autorisé", () => {
    expect(RAPPEL_DETTE_ENVOI_ENABLED).toBe(false);
    const r = assertLegacyRappelChannelsAllowed("checkAndSendRelances");
    expect(r).toEqual({ ok: true });
  });

  it("flag on (injection tests) → refuse avant effets de bord", () => {
    const r = assertLegacyRappelChannelsAllowed(
      "sendRappelManuelCotisations",
      true
    );
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error("expected fail");
    expect(r.code).toBe(RAPPEL_DETTE_LEGACY_CHANNEL_DISABLED_CODE);
    expect(r.context).toBe("sendRappelManuelCotisations");
  });

  it("branchements legacy : garde avant mutation / émission", () => {
    const root = path.resolve(__dirname, "../../../..");
    const checks: Array<{ file: string; marker: string; before: string }> = [
      {
        file: "actions/notifications/rappel.ts",
        marker: 'assertLegacyRappelChannelsAllowed(\n      "sendRappelManuelCotisations"',
        before: "prisma.adherent.findMany",
      },
      {
        file: "actions/notifications/rappel.ts",
        marker: 'assertLegacyRappelChannelsAllowed("sendRappelsCotisations")',
        before: "prisma.obligationCotisation.findMany",
      },
      {
        file: "actions/paiements/index.ts",
        marker: 'assertLegacyRappelChannelsAllowed("checkAndSendRelances")',
        before: "prisma.typeCotisationMensuelle.findFirst",
      },
      {
        file: "actions/relances/automatiques.ts",
        marker:
          'assertLegacyRappelChannelsAllowed(\n      "executeRelancesAutomatiques"',
        before: "prisma.obligationCotisation.findMany",
      },
    ];

    for (const c of checks) {
      const src = readFileSync(path.join(root, c.file), "utf8");
      const gi = src.indexOf(c.marker);
      const bi = src.indexOf(c.before, gi >= 0 ? gi : 0);
      expect(gi, `${c.file} garde manquante`).toBeGreaterThanOrEqual(0);
      expect(bi, `${c.file} effet de bord manquant`).toBeGreaterThan(gi);
    }
  });
});
