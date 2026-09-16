/**
 * Non-régression : chargement instrumentation notes-frais (flag on, Node).
 * Garantit qu'on n'utilise plus webpackIgnore + chemin relatif vers les services
 * (cause ERR_MODULE_NOT_FOUND depuis .next/server/instrumentation.js).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";

const startNotesFraisWorkers = vi.fn().mockResolvedValue(undefined);

vi.mock("../../instrumentation-node", () => ({
  startNotesFraisWorkers: (...a: unknown[]) => startNotesFraisWorkers(...a),
}));

describe("instrumentation notes-frais", () => {
  const prevFlag = process.env.NOTES_FRAIS_ENABLED;
  const prevRuntime = process.env.NEXT_RUNTIME;

  beforeEach(() => {
    vi.resetModules();
    startNotesFraisWorkers.mockClear();
    startNotesFraisWorkers.mockResolvedValue(undefined);
  });

  afterEach(() => {
    if (prevFlag === undefined) delete process.env.NOTES_FRAIS_ENABLED;
    else process.env.NOTES_FRAIS_ENABLED = prevFlag;
    if (prevRuntime === undefined) delete process.env.NEXT_RUNTIME;
    else process.env.NEXT_RUNTIME = prevRuntime;
  });

  it("source : pas de webpackIgnore vers note-frais-service/archive-service", async () => {
    const src = await readFile(
      "/soft/dev/nextjs/amakifr/instrumentation.ts",
      "utf8"
    );
    expect(src).not.toMatch(
      /webpackIgnore[\s\S]{0,80}note-frais-(service|archive-service)/
    );
    expect(src).not.toMatch(
      /import\([\s\S]*note-frais-(service|archive-service)/
    );
    expect(src).toMatch(/instrumentation-node/);
  });

  it("flag off → no-op (pas d'import worker)", async () => {
    delete process.env.NOTES_FRAIS_ENABLED;
    process.env.NEXT_RUNTIME = "nodejs";
    const { register } = await import("../../instrumentation");
    await register();
    expect(startNotesFraisWorkers).not.toHaveBeenCalled();
  });

  it("runtime edge → no-op même si flag true", async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    process.env.NEXT_RUNTIME = "edge";
    const { register } = await import("../../instrumentation");
    await register();
    expect(startNotesFraisWorkers).not.toHaveBeenCalled();
  });

  it("flag true + nodejs → charge instrumentation-node et démarre le worker", async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    process.env.NEXT_RUNTIME = "nodejs";
    const { register } = await import("../../instrumentation");
    await register();
    expect(startNotesFraisWorkers).toHaveBeenCalledTimes(1);
  });

  it("flag true sans NEXT_RUNTIME (compat) → démarre aussi le worker Node", async () => {
    process.env.NOTES_FRAIS_ENABLED = "true";
    delete process.env.NEXT_RUNTIME;
    const { register } = await import("../../instrumentation");
    await register();
    expect(startNotesFraisWorkers).toHaveBeenCalledTimes(1);
  });
});
