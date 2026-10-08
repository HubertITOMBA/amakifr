import { describe, expect, it } from "vitest";
import { parseRapportViewParam } from "@/lib/rapports-reunion/deep-link";

describe("deep-link ?view= rapports", () => {
  it("extrait un id valide", () => {
    expect(parseRapportViewParam("?view=rapp_abc")).toBe("rapp_abc");
    expect(parseRapportViewParam(new URLSearchParams("view=xyz"))).toBe("xyz");
  });

  it("ignore view vide ou absent", () => {
    expect(parseRapportViewParam("")).toBeNull();
    expect(parseRapportViewParam("?view=")).toBeNull();
    expect(parseRapportViewParam("?view=%20")).toBeNull();
  });
});
