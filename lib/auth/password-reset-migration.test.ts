import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const sqlPath = join(
  process.cwd(),
  "prisma/migrations/20261007220000_password_reset_challenge_security/migration.sql"
);

describe("migration password_reset_challenge_security", () => {
  const sql = readFileSync(sqlPath, "utf8");

  it("atomique BEGIN/COMMIT ; backfill avant drop token", () => {
    expect(sql).toMatch(/^\s*BEGIN;/m);
    expect(sql).toMatch(/^\s*COMMIT;/m);
    expect(sql.indexOf("LEGACY_UUID_INVALIDATED")).toBeLessThan(
      sql.indexOf('DROP COLUMN IF EXISTS "token"')
    );
  });

  it("garde doublons ; pas de DELETE de masse sur tokens", () => {
    expect(sql).toMatch(/duplicate_email_count/);
    expect(sql).not.toMatch(/DELETE FROM "password_reset_tokens"/i);
  });

  it("table rate-limit PostgreSQL + indexes", () => {
    expect(sql).toMatch(/password_reset_rate_limits/);
    expect(sql).toMatch(/PasswordResetRateLimitScope/);
    expect(sql).toMatch(/"keyHash"/);
    expect(sql).toMatch(/password_reset_rate_limits_keyHash_key/);
    expect(sql).toMatch(/password_reset_rate_limits_expiresAt_idx/);
  });
});
