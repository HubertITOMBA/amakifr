import { describe, expect, it } from "vitest";
import {
  computeCanDeleteDocument,
  computeCanRequestDeleteDocument,
  isDocumentLockedForMember,
} from "@/lib/services/documents/document-lock";

describe("document-lock rules", () => {
  it("verrou uniquement Valide+Public", () => {
    expect(
      isDocumentLockedForMember({
        statutValidation: "Valide",
        estPublic: true,
      })
    ).toBe(true);
    expect(
      isDocumentLockedForMember({
        statutValidation: "Valide",
        estPublic: false,
      })
    ).toBe(false);
    expect(
      isDocumentLockedForMember({
        statutValidation: "EnAttente",
        estPublic: true,
      })
    ).toBe(false);
    expect(
      isDocumentLockedForMember({
        statutValidation: "Rejete",
        estPublic: false,
      })
    ).toBe(false);
  });

  it("canDelete / canRequestDelete", () => {
    const locked = {
      userId: "u1",
      statutValidation: "Valide",
      estPublic: true,
    };
    expect(computeCanDeleteDocument(locked, "u1")).toBe(false);
    expect(computeCanRequestDeleteDocument(locked, "u1")).toBe(true);
    expect(computeCanDeleteDocument(locked, "u2")).toBe(false);
    expect(computeCanRequestDeleteDocument(locked, "u2")).toBe(false);
  });
});
