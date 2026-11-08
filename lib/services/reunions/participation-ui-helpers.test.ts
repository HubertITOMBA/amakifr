import { describe, expect, it } from "vitest";
import { shouldApplyLocalParticipationAfterServer } from "@/lib/services/reunions/participation-ui-helpers";

describe("shouldApplyLocalParticipationAfterServer", () => {
  it("n'applique le succès local qu'après succès serveur", () => {
    expect(shouldApplyLocalParticipationAfterServer(true)).toBe(true);
    expect(shouldApplyLocalParticipationAfterServer(false)).toBe(false);
  });
});
