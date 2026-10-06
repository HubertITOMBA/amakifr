import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const MIGRATION_DIR =
  "prisma/migrations/20261006170305_verification_token_security";
const SQL_PATH = join(process.cwd(), MIGRATION_DIR, "migration.sql");

describe("migration verification_token_security", () => {
  const sql = readFileSync(SQL_PATH, "utf8");

  it("contient une garde agrégée sur les emails en double", () => {
    expect(sql).toMatch(/DO\s+\$\$/i);
    expect(sql).toMatch(/HAVING COUNT\(\*\) > 1/i);
    expect(sql).toMatch(/RAISE EXCEPTION/i);
    expect(sql).toMatch(/duplicate/i);
    // Aucun email concret dans le message d'erreur
    expect(sql).not.toMatch(/@/);
  });

  it("n'effectue aucune suppression de lignes", () => {
    expect(sql).not.toMatch(/\bDELETE\b/i);
    expect(sql).not.toMatch(/\bTRUNCATE\b/i);
  });

  it("backfill createdAt = expires - 5 minutes", () => {
    expect(sql).toMatch(
      /SET\s+"createdAt"\s*=\s*"expires"\s*-\s*INTERVAL\s+'5 minutes'/i,
    );
  });

  it("ajoute les colonnes de sécurité et la contrainte CHECK", () => {
    expect(sql).toMatch(/ADD COLUMN "createdAt"/i);
    expect(sql).toMatch(/ADD COLUMN "failedAttempts" INTEGER NOT NULL DEFAULT 0/i);
    expect(sql).toMatch(/ADD COLUMN "lockedAt" TIMESTAMP\(3\)/i);
    expect(sql).toMatch(
      /failedAttempts"\s*>=\s*0\s+AND\s+"failedAttempts"\s*<=\s*3/i,
    );
  });

  it("passe à l'unique email et conserve l'unique token", () => {
    expect(sql).toMatch(
      /DROP INDEX IF EXISTS "verification_tokens_email_token_key"/i,
    );
    expect(sql).toMatch(
      /CREATE UNIQUE INDEX "verification_tokens_email_key"/i,
    );
    expect(sql).toMatch(/token_key.*conserv/i);
    expect(sql).not.toMatch(/DROP INDEX.*"verification_tokens_token_key"/i);
  });

  it("ne contient aucune donnée réelle", () => {
    expect(sql).not.toMatch(/INSERT INTO/i);
    expect(sql).not.toMatch(/@amaki\.fr/i);
    expect(sql).not.toMatch(/@example\.com/i);
  });

  it("est enveloppée dans une transaction atomique BEGIN … COMMIT", () => {
    const beginIdx = sql.search(/^\s*BEGIN\s*;/im);
    const commitIdx = sql.search(/^\s*COMMIT\s*;/im);
    const guardIdx = sql.search(/DO\s+\$\$/i);
    const uniqueEmailIdx = sql.search(
      /CREATE UNIQUE INDEX "verification_tokens_email_key"/i,
    );

    expect(beginIdx).toBeGreaterThanOrEqual(0);
    expect(commitIdx).toBeGreaterThanOrEqual(0);
    expect(guardIdx).toBeGreaterThan(beginIdx);
    expect(uniqueEmailIdx).toBeGreaterThan(beginIdx);
    expect(commitIdx).toBeGreaterThan(uniqueEmailIdx);
    // Un seul BEGIN / COMMIT explicites de transaction (hors bloc DO $$ … BEGIN)
    const txBegins = [...sql.matchAll(/^\s*BEGIN\s*;/gim)];
    const txCommits = [...sql.matchAll(/^\s*COMMIT\s*;/gim)];
    expect(txBegins).toHaveLength(1);
    expect(txCommits).toHaveLength(1);
  });
});
