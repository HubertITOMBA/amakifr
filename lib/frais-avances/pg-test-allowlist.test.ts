import { describe, expect, it } from "vitest";
import {
  isAllowedNotesFraisPgTestUrl,
  resolveAuthorizedNotesFraisPgTestUrl,
  NOTES_FRAIS_PG_TEST_ALLOWLIST,
} from "@/lib/frais-avances/pg-test-allowlist";

const ALLOWED =
  "postgresql://amaki_test:amaki_local_test_only@127.0.0.1:55432/amaki_notes_frais_test?schema=public";

describe("pg-test-allowlist", () => {
  it("autorise uniquement host/port/db/user Docker jetable", () => {
    expect(isAllowedNotesFraisPgTestUrl(ALLOWED)).toBe(true);
    expect(NOTES_FRAIS_PG_TEST_ALLOWLIST.database).toBe(
      "amaki_notes_frais_test"
    );
  });

  it("refuse un nom contenant « test » hors allowlist", () => {
    expect(
      isAllowedNotesFraisPgTestUrl(
        "postgresql://amaki_test:x@127.0.0.1:5432/amakifr_test"
      )
    ).toBe(false);
    expect(
      isAllowedNotesFraisPgTestUrl(
        "postgresql://other:x@127.0.0.1:55432/amaki_notes_frais_test"
      )
    ).toBe(false);
  });

  it("resolveAuthorized : pas de fallback DATABASE_URL", () => {
    expect(() =>
      resolveAuthorizedNotesFraisPgTestUrl({
        DATABASE_URL: ALLOWED,
      } as NodeJS.ProcessEnv)
    ).toThrow(/TEST_DATABASE_URL absent/);

    expect(() =>
      resolveAuthorizedNotesFraisPgTestUrl({
        TEST_DATABASE_URL: ALLOWED,
        DATABASE_URL: ALLOWED,
      } as NodeJS.ProcessEnv)
    ).toThrow(/identique à DATABASE_URL/);

    expect(
      resolveAuthorizedNotesFraisPgTestUrl({
        TEST_DATABASE_URL: ALLOWED,
        DATABASE_URL: "postgresql://prod:x@db:5432/amaki",
      } as NodeJS.ProcessEnv)
    ).toBe(ALLOWED);
  });
});
