/**
 * Preuve migrate historique 45 → 46 (lot 4.10).
 * Base jetable dédiée allowlistée (même host/user, DB distincte).
 *
 * Scénario :
 * 1. park migration 46
 * 2. migrate deploy (45)
 * 3. fixtures archives/PJ/journal/reports/users
 * 4. restore migration 46 + migrate deploy
 * 5. assert conservation + seed ACTIVE + snapshots null
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { renameSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  NOTES_FRAIS_PG_TEST_ALLOWLIST,
  resolveAuthorizedNotesFraisPgTestUrl,
} from "@/lib/frais-avances/pg-test-allowlist";

const HIST_DB = "amaki_notes_frais_hist_410";
const MIG_410 =
  "prisma/migrations/20260918130000_notes_frais_4x10_retention_policies_legal_hold";
// Même filesystem que le dépôt (éviter EXDEV) — hors prisma/migrations/
const PARK_DIR = path.join(process.cwd(), ".tmp-amaki-park-410-migration");

let authorizedUrl: string | null = null;
try {
  authorizedUrl = resolveAuthorizedNotesFraisPgTestUrl(process.env);
} catch (e) {
  console.warn(
    "[notes-frais][pg-hist-410] skip:",
    e instanceof Error ? e.message : e
  );
}

const describePg = authorizedUrl ? describe : describe.skip;

function histUrl(base: string): string {
  const u = new URL(base.replace(/^postgresql:/i, "http:"));
  u.pathname = `/${HIST_DB}`;
  return u.toString().replace(/^http:/, "postgresql:");
}

function run(cmd: string, args: string[], env: NodeJS.ProcessEnv) {
  execFileSync(cmd, args, {
    cwd: process.cwd(),
    env,
    stdio: ["ignore", "pipe", "pipe"],
    encoding: "utf8",
  });
}

describePg("notes-frais 4.10 migrate historique 45→46", () => {
  const baseUrl = authorizedUrl!;
  const url = histUrl(baseUrl);
  let prisma: PrismaClient;

  beforeAll(() => {
    const pw = (() => {
      const u = new URL(baseUrl.replace(/^postgresql:/i, "http:"));
      return decodeURIComponent(u.password);
    })();
    process.env.PGPASSWORD = pw;
    // Drop/create DB jetable
    try {
      run("psql", [
        "-h",
        NOTES_FRAIS_PG_TEST_ALLOWLIST.hostname,
        "-p",
        String(NOTES_FRAIS_PG_TEST_ALLOWLIST.port),
        "-U",
        NOTES_FRAIS_PG_TEST_ALLOWLIST.username,
        "-d",
        "postgres",
        "-c",
        `DROP DATABASE IF EXISTS ${HIST_DB};`,
      ], process.env);
    } catch {
      /* ignore */
    }
    run("psql", [
      "-h",
      NOTES_FRAIS_PG_TEST_ALLOWLIST.hostname,
      "-p",
      String(NOTES_FRAIS_PG_TEST_ALLOWLIST.port),
      "-U",
      NOTES_FRAIS_PG_TEST_ALLOWLIST.username,
      "-d",
      "postgres",
      "-c",
      `CREATE DATABASE ${HIST_DB} OWNER ${NOTES_FRAIS_PG_TEST_ALLOWLIST.username};`,
    ], process.env);

    prisma = new PrismaClient({ datasources: { db: { url } } });
  }, 120_000);

  afterAll(async () => {
    // Restaure migration 46 si parkée
    if (existsSync(PARK_DIR) && !existsSync(MIG_410)) {
      renameSync(PARK_DIR, MIG_410);
    }
    try {
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  });

  it("45 fixtures puis 46 : données conservées + seed ACTIVE", async () => {
    const env = { ...process.env, DATABASE_URL: url };

    // Park 46
    if (existsSync(PARK_DIR)) {
      rmSync(PARK_DIR, { recursive: true, force: true });
    }
    mkdirSync(path.dirname(PARK_DIR), { recursive: true });
    renameSync(MIG_410, PARK_DIR);

    try {
      run("npx", ["prisma", "migrate", "deploy"], env);

      // Fixtures 4.9 via SQL brut (client Prisma 4.10 ne doit pas SELECT les colonnes absentes)
      await prisma.$executeRawUnsafe(`
        INSERT INTO notes_frais_archives (
          id, "dateDepense", "montantDemande", "soumiseAt", "statutFinal",
          "archivedAt", "retentionEndsAt", "reidentifiabilityNotice",
          "createdAt", "updatedAt"
        ) VALUES (
          'hist-arch-410',
          TIMESTAMP '2024-06-15',
          12.50,
          TIMESTAMP '2024-06-16',
          'VALIDEE',
          CURRENT_TIMESTAMP,
          TIMESTAMP '2034-12-31',
          'date_montant_potentially_reidentifying',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        INSERT INTO justificatifs_note_frais_archives (
          id, "archiveId", rang, "cheminRelatif", "typeMime", taille, statut,
          "createdAt", "updatedAt"
        ) VALUES (
          'hist-pj-410',
          'hist-arch-410',
          1,
          'archive/hist/p.bin',
          'application/pdf',
          10,
          'READY',
          CURRENT_TIMESTAMP,
          CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        INSERT INTO notes_frais_journal_financier_evenements (
          id, kind, "occurredAt", "periodeCle", montant, "retentionEndsAt", "createdAt"
        ) VALUES (
          'hist-jev-410',
          'REMBOURSEMENT_EXECUTE',
          TIMESTAMP '2024-05-01',
          '2024',
          100,
          TIMESTAMP '2034-12-31',
          CURRENT_TIMESTAMP
        )
      `);

      await prisma.$executeRawUnsafe(`
        INSERT INTO notes_frais_reports_financier_periode (
          id, "periodeCle",
          "totalDecaissementsRemboursement", "totalRestitutions", "totalCompensationsNettes",
          "consolidatedAt", "createdAt", "updatedAt"
        ) VALUES (
          'hist-rep-410',
          '2023',
          50, 0, 0,
          CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )
      `);

      const beforeArch = await prisma.$queryRaw<Array<{ c: number }>>`
        SELECT count(*)::int as c FROM notes_frais_archives WHERE id = 'hist-arch-410'
      `;
      expect(beforeArch[0]?.c).toBe(1);

      // Restore 46 + deploy
      renameSync(PARK_DIR, MIG_410);
      run("npx", ["prisma", "migrate", "deploy"], env);

      const afterArch = await prisma.$queryRaw<Array<{ c: number }>>`
        SELECT count(*)::int as c FROM notes_frais_archives WHERE id = 'hist-arch-410'
      `;
      expect(afterArch[0]?.c).toBe(1);
      const afterPj = await prisma.$queryRaw<Array<{ c: number }>>`
        SELECT count(*)::int as c FROM justificatifs_note_frais_archives WHERE id = 'hist-pj-410'
      `;
      expect(afterPj[0]?.c).toBe(1);
      const afterJev = await prisma.$queryRaw<Array<{ c: number }>>`
        SELECT count(*)::int as c FROM notes_frais_journal_financier_evenements WHERE id = 'hist-jev-410'
      `;
      expect(afterJev[0]?.c).toBe(1);
      const afterRep = await prisma.$queryRaw<Array<{ c: number }>>`
        SELECT count(*)::int as c FROM notes_frais_reports_financier_periode WHERE id = 'hist-rep-410'
      `;
      expect(afterRep[0]?.c).toBe(1);

      const arch = await prisma.$queryRaw<
        Array<{
          policyVersionId: string | null;
          exerciceClotureAt: Date | null;
          retentionEndsAtP1: Date | null;
          montantDemande: unknown;
        }>
      >`
        SELECT "policyVersionId", "exerciceClotureAt", "retentionEndsAtP1", "montantDemande"
        FROM notes_frais_archives WHERE id = 'hist-arch-410'
      `;
      expect(arch[0]?.policyVersionId).toBeNull();
      expect(arch[0]?.exerciceClotureAt).toBeNull();
      expect(arch[0]?.retentionEndsAtP1).toBeNull();
      expect(Number(arch[0]?.montantDemande)).toBe(12.5);

      const active = await prisma.$queryRaw<
        Array<{ id: string; p1Years: number; reportsSansEcheance: boolean }>
      >`
        SELECT id, "p1Years", "reportsSansEcheance"
        FROM notes_frais_retention_policy_versions WHERE statut = 'ACTIVE'
      `;
      expect(active).toHaveLength(1);
      expect(active[0]!.p1Years).toBe(10);
      expect(active[0]!.reportsSansEcheance).toBe(true);
      expect(active[0]!.id).toBe("nf_ret_pol_v1_seed_4x10");

      const idx = await prisma.$queryRaw<Array<{ indexname: string }>>`
        SELECT indexname FROM pg_indexes
        WHERE tablename = 'notes_frais_retention_policy_versions'
          AND indexname = 'nf_ret_pol_act_idem_uidx'
      `;
      expect(idx).toHaveLength(1);

      const chk = await prisma.$queryRaw<Array<{ conname: string }>>`
        SELECT conname FROM pg_constraint
        WHERE conname = 'nf_ret_pol_reports_sans_echeance_v1_chk'
      `;
      expect(chk).toHaveLength(1);
    } finally {
      if (existsSync(PARK_DIR) && !existsSync(MIG_410)) {
        renameSync(PARK_DIR, MIG_410);
      }
    }
  }, 300_000);
});
