import { describe, expect, it } from "vitest";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  shouldApplyLoadResult,
} from "@/api/load-guard";

/**
 * Comportements anti-stale du lecteur (changement d’ID / unmount).
 * La protection est assurée par LoadGuard dans l’écran (pas de helper mort).
 */
describe("rapport load lifecycle", () => {
  it("chargement puis succès appliqué si génération courante", () => {
    let guard = createLoadGuard();
    const started = beginLoad(guard);
    guard = started.guard;
    expect(shouldApplyLoadResult(started.gen, guard.dataGen)).toBe(true);
    const ended = endLoad(guard);
    expect(ended.clearSpinners).toBe(true);
  });

  it("changement d’ID invalide le résultat précédent", () => {
    let guard = createLoadGuard();
    const first = beginLoad(guard);
    guard = first.guard;
    // nouvel ID → nouveau beginLoad
    const second = beginLoad(guard);
    guard = second.guard;
    expect(shouldApplyLoadResult(first.gen, guard.dataGen)).toBe(false);
    expect(shouldApplyLoadResult(second.gen, guard.dataGen)).toBe(true);
  });

  it("unmount / invalidation : pas d’update tardif", () => {
    let guard = createLoadGuard();
    const started = beginLoad(guard);
    guard = started.guard;
    // simule unmount : nouvelle génération
    const invalidated = beginLoad(guard);
    guard = invalidated.guard;
    expect(shouldApplyLoadResult(started.gen, guard.dataGen)).toBe(false);
  });
});
