import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sqlPath = join(
  process.cwd(),
  "prisma/migrations/20261008190000_rapport_reunion_publication_status/migration.sql"
);

describe("migration rapport_reunion_publication_status", () => {
  const sql = readFileSync(sqlPath, "utf8");

  it("transaction atomique BEGIN/COMMIT", () => {
    expect(sql).toMatch(/^\s*BEGIN;/m);
    expect(sql).toMatch(/^\s*COMMIT;/m);
    expect(sql.indexOf("BEGIN;")).toBeLessThan(sql.indexOf("COMMIT;"));
  });

  it("aucun DELETE de lignes (FK ON DELETE SET NULL autorisé)", () => {
    expect(sql).not.toMatch(/\bDELETE\s+FROM\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("backfill PUBLISHED avant contraintes NOT NULL / DEFAULT DRAFT", () => {
    const backfillIdx = sql.indexOf("SET");
    const notNullIdx = sql.indexOf('ALTER COLUMN "statut" SET NOT NULL');
    const defaultIdx = sql.indexOf("SET DEFAULT 'DRAFT'");
    expect(backfillIdx).toBeGreaterThan(-1);
    expect(sql).toMatch(/PUBLISHED/);
    expect(sql).toMatch(/WHERE "statut" IS NULL/);
    expect(backfillIdx).toBeLessThan(notNullIdx);
    expect(notNullIdx).toBeLessThan(defaultIdx);
  });

  it("publishedAt cohérent (updatedAt sinon createdAt)", () => {
    expect(sql).toMatch(
      /COALESCE\("publishedAt",\s*"updatedAt",\s*"createdAt"\)/
    );
  });

  it("enum + indexes + précondition table", () => {
    expect(sql).toMatch(/RapportReunionStatut/);
    expect(sql).toMatch(/rapports_reunion_statut_idx/);
    expect(sql).toMatch(/rapports_reunion_publishedAt_idx/);
    expect(sql).toMatch(/table_name = 'rapports_reunion'/);
  });

  it("CHECK cohérence statut / publishedAt / publishedBy après backfill", () => {
    const backfillIdx = sql.indexOf('WHERE "statut" IS NULL');
    const checkIdx = sql.indexOf(
      "rapports_reunion_statut_published_consistency_check"
    );
    expect(checkIdx).toBeGreaterThan(-1);
    expect(backfillIdx).toBeLessThan(checkIdx);
    expect(sql).toMatch(
      /"statut" = 'PUBLISHED'::"RapportReunionStatut"\s+AND "publishedAt" IS NOT NULL/
    );
    expect(sql).toMatch(
      /"statut" = 'DRAFT'::"RapportReunionStatut"\s+AND "publishedAt" IS NULL\s+AND "publishedBy" IS NULL/
    );
  });
});
