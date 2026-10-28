import { describe, expect, it } from "vitest";
import {
  COTISATIONS_VUE_DEFAULT,
  parseCotisationsVueParam,
  resolveCotisationsVue,
} from "@/lib/user/cotisations-vue";

describe("parseCotisationsVueParam", () => {
  it("accepte mois | annee | toutes", () => {
    expect(parseCotisationsVueParam("mois")).toBe("mois");
    expect(parseCotisationsVueParam("annee")).toBe("annee");
    expect(parseCotisationsVueParam("toutes")).toBe("toutes");
  });

  it("refuse absent, vide, invalide (casse, alias)", () => {
    expect(parseCotisationsVueParam(null)).toBeNull();
    expect(parseCotisationsVueParam(undefined)).toBeNull();
    expect(parseCotisationsVueParam("")).toBeNull();
    expect(parseCotisationsVueParam("Toutes")).toBeNull();
    expect(parseCotisationsVueParam("all")).toBeNull();
    expect(parseCotisationsVueParam("année")).toBeNull();
  });
});

describe("resolveCotisationsVue", () => {
  it("applique le défaut pour valeur invalide", () => {
    expect(resolveCotisationsVue(null)).toBe(COTISATIONS_VUE_DEFAULT);
    expect(resolveCotisationsVue("nope")).toBe("mois");
  });

  it("conserve une valeur valide", () => {
    expect(resolveCotisationsVue("toutes")).toBe("toutes");
  });
});
