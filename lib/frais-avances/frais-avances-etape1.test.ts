import { describe, expect, it, afterEach } from "vitest";
import {
  NOTES_FRAIS_DISABLED_MESSAGE,
  assertNotesFraisEnabled,
  isNotesFraisEnabled,
  NotesFraisDisabledError,
} from "@/lib/frais-avances/feature-flag";
import { isNotesFraisEnabledClientHint } from "@/lib/frais-avances/feature-flag-client";
import {
  assertAllowedJustificatifBuffer,
  detectFileKindFromMagic,
} from "@/lib/frais-avances/justificatif-validation";
import {
  absoluteFromRelative,
  assertPathInsideStorageRoot,
  getNotesFraisStorageRoot,
} from "@/lib/frais-avances/storage";
import { classifyExpoTicketError } from "@/lib/services/push/send-push";
import { isSubmissionNotifyRole } from "@/lib/frais-avances/recipients";

describe("notes-frais feature flag", () => {
  const prev = process.env.NOTES_FRAIS_ENABLED;
  const prevPublic = process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED;
  afterEach(() => {
    if (prev === undefined) delete process.env.NOTES_FRAIS_ENABLED;
    else process.env.NOTES_FRAIS_ENABLED = prev;
    if (prevPublic === undefined) {
      delete process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED;
    } else {
      process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED = prevPublic;
    }
  });

  it("false par défaut", () => {
    delete process.env.NOTES_FRAIS_ENABLED;
    expect(isNotesFraisEnabled()).toBe(false);
  });

  it("true uniquement si strictement \"true\"", () => {
    process.env.NOTES_FRAIS_ENABLED = "1";
    expect(isNotesFraisEnabled()).toBe(false);
    process.env.NOTES_FRAIS_ENABLED = "true";
    expect(isNotesFraisEnabled()).toBe(true);
  });

  it("NEXT_PUBLIC_* n'active pas le flag serveur", () => {
    delete process.env.NOTES_FRAIS_ENABLED;
    process.env.NEXT_PUBLIC_NOTES_FRAIS_ENABLED = "true";
    expect(isNotesFraisEnabledClientHint()).toBe(true);
    expect(isNotesFraisEnabled()).toBe(false);
    expect(() => assertNotesFraisEnabled()).toThrow(NotesFraisDisabledError);
  });

  it("assert lève NotesFraisDisabledError", () => {
    delete process.env.NOTES_FRAIS_ENABLED;
    expect(() => assertNotesFraisEnabled()).toThrow(NotesFraisDisabledError);
    expect(() => assertNotesFraisEnabled()).toThrow(NOTES_FRAIS_DISABLED_MESSAGE);
  });
});

describe("justificatif magic bytes", () => {
  it("détecte PDF", () => {
    const buf = Buffer.from("%PDF-1.4\n...");
    expect(detectFileKindFromMagic(buf)).toBe("pdf");
    expect(assertAllowedJustificatifBuffer(buf).mime).toBe("application/pdf");
  });

  it("refuse mismatch MIME", () => {
    const buf = Buffer.from("%PDF-1.4\n...");
    expect(() =>
      assertAllowedJustificatifBuffer(buf, "image/png")
    ).toThrow(/correspond pas/);
  });

  it("refuse trop volumineux", () => {
    const buf = Buffer.alloc(10 * 1024 * 1024 + 1, 0xff);
    buf[0] = 0xff;
    buf[1] = 0xd8;
    buf[2] = 0xff;
    expect(() => assertAllowedJustificatifBuffer(buf)).toThrow(/volumineux/);
  });
});

describe("storage paths", () => {
  const prev = process.env.NOTES_FRAIS_STORAGE_ROOT;
  afterEach(() => {
    if (prev === undefined) delete process.env.NOTES_FRAIS_STORAGE_ROOT;
    else process.env.NOTES_FRAIS_STORAGE_ROOT = prev;
  });

  it("refuse traversal", () => {
    process.env.NOTES_FRAIS_STORAGE_ROOT = "/tmp/amaki-notes-test-root";
    expect(() => absoluteFromRelative("../etc/passwd")).toThrow();
    const inside = absoluteFromRelative("notes/a/b.pdf");
    expect(inside.startsWith(getNotesFraisStorageRoot())).toBe(true);
    expect(() =>
      assertPathInsideStorageRoot("/tmp/other/file.pdf")
    ).toThrow(/hors racine/);
  });
});

describe("push classification", () => {
  it("classe DeviceNotRegistered comme définitif", () => {
    expect(classifyExpoTicketError("DeviceNotRegistered")).toBe("definitive");
    expect(classifyExpoTicketError("MessageTooBig")).toBe("definitive");
    expect(classifyExpoTicketError("ProviderError")).toBe("temporary");
    expect(classifyExpoTicketError(undefined)).toBe("temporary");
  });
});

describe("destinataires rôles", () => {
  it("COMCPT n'est pas un rôle de notif soumission", () => {
    expect(isSubmissionNotifyRole("COMCPT")).toBe(false);
    expect(isSubmissionNotifyRole("TRESOR")).toBe(true);
    expect(isSubmissionNotifyRole("ADMIN")).toBe(true);
  });
});

describe("actions refus module off", () => {
  it("createNoteFraisDraft refuse sans faux succès", async () => {
    const prev = process.env.NOTES_FRAIS_ENABLED;
    delete process.env.NOTES_FRAIS_ENABLED;
    const { createNoteFraisDraft } = await import(
      "@/lib/services/frais-avances/note-frais-service"
    );
    const res = await createNoteFraisDraft({
      userId: "u1",
      libelle: "x",
      dateDepense: new Date(),
      montantDemande: 10,
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.code).toBe("NOTES_FRAIS_DISABLED");
    }
    if (prev === undefined) delete process.env.NOTES_FRAIS_ENABLED;
    else process.env.NOTES_FRAIS_ENABLED = prev;
  });
});
