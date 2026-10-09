import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildRapportRoute,
  rapportRouteFromReunion,
  sourceLooksLikeItLogsHtmlOrToken,
} from "@/features/rapports-reunion/rapport-reader-model";

describe("rapportRouteFromReunion", () => {
  it("navigue vers le bon ID si PUBLISHED", () => {
    expect(
      rapportRouteFromReunion({
        hasPublishedReport: true,
        publishedReportId: "rapp-42",
      })
    ).toBe("/reunions/rapport/rapp-42");
  });

  it("null sans rapport ou sans ID", () => {
    expect(
      rapportRouteFromReunion({
        hasPublishedReport: false,
        publishedReportId: null,
      })
    ).toBeNull();
    expect(
      rapportRouteFromReunion({
        hasPublishedReport: true,
        publishedReportId: null,
      })
    ).toBeNull();
  });
});

describe("buildRapportRoute", () => {
  it("encode l’ID", () => {
    expect(buildRapportRoute("a b")).toBe("/reunions/rapport/a%20b");
  });
});

describe("source scan complémentaire (pas de log HTML/token)", () => {
  it("client API et écran lecteur ne loguent pas HTML/token", () => {
    const root = join(process.cwd(), "src");
    const files = [
      "api/rapports-reunion.ts",
      "app/(app)/reunions/rapport/[id].tsx",
      "features/rapports-reunion/sanitize-meeting-report-html.ts",
    ];
    for (const f of files) {
      const src = readFileSync(join(root, f), "utf8");
      expect(sourceLooksLikeItLogsHtmlOrToken(src)).toBe(false);
    }
  });
});
