import { describe, expect, it, vi } from "vitest";
import {
  buildReactNativeFilePart,
  fallbackJustificatifFileName,
  mapDocumentPickerAssetToFilePart,
  mapImagePickerAssetToFilePart,
  uriSchemeForLog,
} from "@/api/react-native-form-data-file";

vi.mock("expo-file-system", () => {
  class MockFile {
    uri: string;
    exists = true;
    size = 131190;
    type = "image/jpeg";
    constructor(uriOrPaths: string | { uri?: string }, ...rest: string[]) {
      if (typeof uriOrPaths === "string") {
        this.uri = rest.length
          ? `${uriOrPaths}/${rest.join("/")}`
          : uriOrPaths;
      } else {
        this.uri = "file:///cache/mock";
      }
    }
    copy = vi.fn(async () => undefined);
  }
  return {
    File: MockFile,
    Paths: { cache: "file:///cache" },
  };
});

import { appendJustificatifToFormData } from "@/api/react-native-form-data-file";

describe("react-native-form-data-file", () => {
  it("image asset → { uri, name, type }", () => {
    const part = mapImagePickerAssetToFilePart({
      uri: "file:///cache/photo.jpg",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
    });
    expect(part).toEqual({
      uri: "file:///cache/photo.jpg",
      name: "photo.jpg",
      type: "image/jpeg",
    });
  });

  it("document asset → { uri, name, type }", () => {
    const part = mapDocumentPickerAssetToFilePart({
      uri: "file:///cache/doc.pdf",
      name: "rib.pdf",
      mimeType: "application/pdf",
    });
    expect(part).toEqual({
      uri: "file:///cache/doc.pdf",
      name: "rib.pdf",
      type: "application/pdf",
    });
  });

  it("nom absent → fallback correct", () => {
    const part = buildReactNativeFilePart({
      uri: "file:///x",
      name: null,
      mimeType: "image/png",
    });
    expect(part.name).toMatch(/^justificatif_\d+\.png$/);
    expect(part.type).toBe("image/png");
  });

  it("MIME absent → fallback depuis le nom", () => {
    const part = buildReactNativeFilePart({
      uri: "file:///x",
      name: "preuve.webp",
      mimeType: null,
    });
    expect(part.type).toBe("image/webp");
    expect(part.name).toBe("preuve.webp");
  });

  it("MIME et nom absents → octet-stream + fallback", () => {
    const part = buildReactNativeFilePart({
      uri: "file:///x",
      name: "",
      mimeType: "",
    });
    expect(part.type).toBe("application/octet-stream");
    expect(part.name).toMatch(/\.bin$/);
  });

  it("uriSchemeForLog n'expose pas le chemin", () => {
    expect(uriSchemeForLog("file:///private/user/photo.jpg")).toBe("file");
    expect(uriSchemeForLog("content://media/123")).toBe("content");
  });

  it("fallbackJustificatifFileName", () => {
    expect(fallbackJustificatifFileName("image/jpeg")).toMatch(/\.jpg$/);
    expect(fallbackJustificatifFileName("application/pdf")).toMatch(/\.pdf$/);
  });

  it("appendJustificatifToFormData forme simple (pas d'asset picker)", async () => {
    const appended: unknown[] = [];
    const form = {
      append: (name: string, value: unknown, filename?: string) => {
        appended.push({ name, value, filename });
      },
    } as unknown as FormData;

    const pickerAsset = {
      uri: "file:///cache/a.jpg",
      fileName: "a.jpg",
      mimeType: "image/jpeg",
      width: 100,
      height: 100,
    };
    const part = mapImagePickerAssetToFilePart(pickerAsset);
    await appendJustificatifToFormData(form, "justificatif", part);

    expect(appended).toHaveLength(1);
    const call = appended[0] as {
      name: string;
      value: { uri?: string; width?: number; fileName?: string };
      filename?: string;
    };
    expect(call.name).toBe("justificatif");
    // Forme documentée : pas de 3e arg filename
    expect(call.filename).toBeUndefined();
    expect(call.value).not.toHaveProperty("width");
    expect(call.value).not.toHaveProperty("fileName");
    expect(call.value).not.toHaveProperty("mimeType");
  });

  it("refuse URI vide", () => {
    expect(() =>
      buildReactNativeFilePart({ uri: "  ", name: "x.jpg", mimeType: "image/jpeg" })
    ).toThrow(/URI/);
  });
});
