import { describe, expect, it } from "vitest";
import {
  DEFAULT_POST_LOGIN_REDIRECT,
  isSafeInternalCallbackPath,
  resolvePostLoginRedirect,
} from "@/lib/auth/safe-callback-url";

describe("isSafeInternalCallbackPath", () => {
  it("accepte les chemins internes relatifs avec query", () => {
    expect(
      isSafeInternalCallbackPath(
        "/user/profile?section=cotisations&vue=toutes"
      )
    ).toBe(true);
    expect(isSafeInternalCallbackPath("/")).toBe(true);
    expect(isSafeInternalCallbackPath("/admin/finances")).toBe(true);
  });

  it("accepte une valeur encore encodée (chemin interne)", () => {
    expect(
      isSafeInternalCallbackPath(
        encodeURIComponent("/user/profile?section=cotisations")
      )
    ).toBe(true);
  });

  it("refuse externe, //host, antislash, malformé", () => {
    expect(isSafeInternalCallbackPath("https://evil.example/x")).toBe(false);
    expect(isSafeInternalCallbackPath("http://evil.example")).toBe(false);
    expect(isSafeInternalCallbackPath("//evil.example/phish")).toBe(false);
    expect(isSafeInternalCallbackPath("/\\evil.example")).toBe(false);
    expect(isSafeInternalCallbackPath("\\/evil")).toBe(false);
    expect(isSafeInternalCallbackPath("javascript:alert(1)")).toBe(false);
    expect(isSafeInternalCallbackPath("")).toBe(false);
    expect(isSafeInternalCallbackPath(null)).toBe(false);
    expect(isSafeInternalCallbackPath("user/profile")).toBe(false);
    expect(isSafeInternalCallbackPath("/https://evil.example")).toBe(false);
    expect(isSafeInternalCallbackPath("/user@evil.com")).toBe(false);
    expect(isSafeInternalCallbackPath("%E0%A4%A")).toBe(false); // decode fail
  });

  it("refuse TAB/LF/CR encodés et contrôles C0/DEL", () => {
    expect(isSafeInternalCallbackPath("/%09evil")).toBe(false); // TAB
    expect(isSafeInternalCallbackPath("/%0aevil")).toBe(false); // LF
    expect(isSafeInternalCallbackPath("/%0Aevil")).toBe(false);
    expect(isSafeInternalCallbackPath("/%0devil")).toBe(false); // CR
    expect(isSafeInternalCallbackPath("/%0Devil")).toBe(false);
    expect(isSafeInternalCallbackPath("/%00x")).toBe(false);
    expect(isSafeInternalCallbackPath("/%7Fx")).toBe(false); // DEL
    expect(isSafeInternalCallbackPath("/evil\tpath")).toBe(false); // TAB brut
  });

  it("refuse // et antislash encodés", () => {
    expect(
      isSafeInternalCallbackPath(encodeURIComponent("//evil.example/x"))
    ).toBe(false);
    expect(isSafeInternalCallbackPath("/%5Cevil")).toBe(false); // \
    expect(
      isSafeInternalCallbackPath(encodeURIComponent("/\\evil"))
    ).toBe(false);
  });

  it("ne décode pas de façon récursive non bornée", () => {
    // Après un seul decode : encore des %2F → ne commence pas par / utile
    // ou reste une forme refusée ; jamais de boucle de decode.
    const doubleEncoded = encodeURIComponent(
      encodeURIComponent("/user/profile")
    );
    // Un seul decode → "%2Fuser%2Fprofile" qui ne commence pas par "/"
    expect(isSafeInternalCallbackPath(doubleEncoded)).toBe(false);
  });
});

describe("resolvePostLoginRedirect", () => {
  it("renvoie le callback sûr", () => {
    expect(
      resolvePostLoginRedirect("/user/profile?section=cotisations&vue=toutes")
    ).toBe("/user/profile?section=cotisations&vue=toutes");
  });

  it("repli sans callbackUrl ou invalide (y compris contrôles encodés)", () => {
    expect(resolvePostLoginRedirect(null)).toBe(DEFAULT_POST_LOGIN_REDIRECT);
    expect(resolvePostLoginRedirect("//evil")).toBe(DEFAULT_POST_LOGIN_REDIRECT);
    expect(resolvePostLoginRedirect("https://x")).toBe(
      DEFAULT_POST_LOGIN_REDIRECT
    );
    expect(resolvePostLoginRedirect("/%0aevil")).toBe(
      DEFAULT_POST_LOGIN_REDIRECT
    );
    expect(
      resolvePostLoginRedirect(encodeURIComponent("//evil.example"))
    ).toBe(DEFAULT_POST_LOGIN_REDIRECT);
  });
});
