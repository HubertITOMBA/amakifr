import { describe, expect, it, vi } from "vitest";
import { buildHomeHighlightSlides } from "@/features/home/home-model";
import {
  applyHomeHighlightInputIfActive,
  buildHomeHighlightInputFromSettled,
  loadHomeHighlightInput,
  shouldKeepHighlightSlidesDuringRefresh,
  shouldRenderHomeHighlightBanner,
  type HomeHighlightLoadPhase,
} from "@/features/home/home-highlight-sources";

describe("shouldRenderHomeHighlightBanner", () => {
  it("loading vide → null (pas de rendu)", () => {
    expect(shouldRenderHomeHighlightBanner(0)).toBe(false);
  });

  it("ready vide → null", () => {
    expect(shouldRenderHomeHighlightBanner(0)).toBe(false);
  });

  it("actualité réelle → visible", () => {
    expect(shouldRenderHomeHighlightBanner(1)).toBe(true);
    expect(shouldRenderHomeHighlightBanner(3)).toBe(true);
  });
});

describe("refresh focus — conservation puis retrait", () => {
  it("refresh conserve l’actualité existante (everReady + ready)", () => {
    expect(shouldKeepHighlightSlidesDuringRefresh(true, "ready")).toBe(true);
    expect(shouldKeepHighlightSlidesDuringRefresh(false, "loading")).toBe(
      false
    );
  });

  it("résultat final vide → carte retirée", () => {
    const before = buildHomeHighlightSlides({
      electionsCount: 1,
      surveyCount: 0,
      eventsCount: 0,
      nextEventTitle: null,
      nextEventWhen: null,
    });
    expect(shouldRenderHomeHighlightBanner(before.length)).toBe(true);

    const after = buildHomeHighlightSlides({
      electionsCount: 0,
      surveyCount: 0,
      eventsCount: 0,
      nextEventTitle: null,
      nextEventWhen: null,
    });
    expect(after).toEqual([]);
    expect(shouldRenderHomeHighlightBanner(after.length)).toBe(false);
  });

  it("phase loading n’efface pas les slides déjà prêtes côté politique refresh", () => {
    const phase: HomeHighlightLoadPhase = "ready";
    expect(shouldKeepHighlightSlidesDuringRefresh(true, phase)).toBe(true);
  });
});

describe("buildHomeHighlightInputFromSettled", () => {
  const formatWhen = (iso: string) => `fmt:${iso}`;

  it("toutes sources OK → input complet", () => {
    const input = buildHomeHighlightInputFromSettled(
      [
        { status: "fulfilled", value: { aCompleterCount: 2 } },
        {
          status: "fulfilled",
          value: {
            upcomingCount: 1,
            nextEvent: {
              id: "e1",
              titre: "AG",
              dateDebut: "2026-10-12T10:00:00Z",
              lieu: null,
            },
          },
        },
        {
          status: "fulfilled",
          value: { aVoterCount: 1, candidaciesOpenCount: 0 },
        },
      ],
      formatWhen
    );
    expect(input.surveyCount).toBe(2);
    expect(input.eventsCount).toBe(1);
    expect(input.nextEventTitle).toBe("AG");
    expect(input.nextEventWhen).toBe("fmt:2026-10-12T10:00:00Z");
    expect(input.electionsCount).toBe(1);
  });

  it("erreur summary → état final déterministe (compteurs à 0 pour la source)", () => {
    const input = buildHomeHighlightInputFromSettled(
      [
        { status: "rejected", reason: new Error("network") },
        { status: "fulfilled", value: { upcomingCount: 0, nextEvent: null } },
        { status: "rejected", reason: new Error("500") },
      ],
      formatWhen
    );
    expect(input.surveyCount).toBe(0);
    expect(input.electionsCount).toBe(0);
    expect(input.eventsCount).toBe(0);
    expect(shouldRenderHomeHighlightBanner(0)).toBe(false);
  });
});

describe("loadHomeHighlightInput", () => {
  it("Promise.allSettled — une API lente n’empêche pas la résolution", async () => {
    const input = await loadHomeHighlightInput(
      {
        getSurveysSummary: () => Promise.resolve({ aCompleterCount: 1 }),
        getEventsSummary: () => Promise.reject(new Error("fail")),
        getElectionsSummary: () =>
          Promise.resolve({ aVoterCount: 0, candidaciesOpenCount: 0 }),
      },
      () => ""
    );
    expect(input.surveyCount).toBe(1);
    expect(input.eventsCount).toBe(0);
  });
});

describe("applyHomeHighlightInputIfActive", () => {
  it("unmount / focus perdu → pas de mise à jour", () => {
    const apply = vi.fn();
    applyHomeHighlightInputIfActive(
      () => false,
      {
        electionsCount: 0,
        surveyCount: 0,
        eventsCount: 0,
        nextEventTitle: null,
        nextEventWhen: null,
      },
      apply
    );
    expect(apply).not.toHaveBeenCalled();
  });

  it("actif → applique l’input", () => {
    const apply = vi.fn();
    applyHomeHighlightInputIfActive(
      () => true,
      {
        electionsCount: 0,
        surveyCount: 0,
        eventsCount: 0,
        nextEventTitle: null,
        nextEventWhen: null,
      },
      apply
    );
    expect(apply).toHaveBeenCalledTimes(1);
  });
});
