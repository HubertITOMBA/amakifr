import { describe, expect, it } from "vitest";
import {
  beginLoad,
  createLoadGuard,
  endLoad,
  invalidatePendingLoads,
  shouldApplyLoadResult,
} from "@/api/load-guard";

describe("load-guard anti-stale", () => {
  it("load ancien invalidé par mutation → résultat ignoré", () => {
    let guard = createLoadGuard();
    const started = beginLoad(guard);
    guard = started.guard;

    // Mutation réussie pendant le fetch
    guard = invalidatePendingLoads(guard);

    expect(shouldApplyLoadResult(started.gen, guard.dataGen)).toBe(false);

    // Simuler application mutation locale
    const mutatedUnread = 2;

    // Load obsolète ne doit pas écraser
    let unread = mutatedUnread;
    if (shouldApplyLoadResult(started.gen, guard.dataGen)) {
      unread = 99; // ne doit pas arriver
    }
    expect(unread).toBe(2);

    const ended = endLoad(guard);
    expect(ended.clearSpinners).toBe(true);
  });

  it("deux loads : le plus récent gagne ; spinner clear à inFlight=0", () => {
    let guard = createLoadGuard();
    const a = beginLoad(guard);
    guard = a.guard;
    const b = beginLoad(guard);
    guard = b.guard;

    expect(shouldApplyLoadResult(a.gen, guard.dataGen)).toBe(false);
    expect(shouldApplyLoadResult(b.gen, guard.dataGen)).toBe(true);

    const endA = endLoad(guard);
    guard = endA.guard;
    expect(endA.clearSpinners).toBe(false);

    const endB = endLoad(guard);
    expect(endB.clearSpinners).toBe(true);
  });

  it("invalidate pendant refresh → clearSpinners quand même via endLoad", () => {
    let guard = createLoadGuard();
    const started = beginLoad(guard);
    guard = started.guard;
    guard = invalidatePendingLoads(guard);
    expect(shouldApplyLoadResult(started.gen, guard.dataGen)).toBe(false);
    const ended = endLoad(guard);
    expect(ended.clearSpinners).toBe(true);
  });
});
