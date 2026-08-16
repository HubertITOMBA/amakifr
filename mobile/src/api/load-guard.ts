/**
 * Garde anti-stale pour chargements async vs mutations.
 * dataGen : invalidation des résultats.
 * inFlight : compteur pour libérer les spinners même si le load est invalidé.
 */

export type LoadGuard = {
  dataGen: number;
  inFlight: number;
};

export function createLoadGuard(): LoadGuard {
  return { dataGen: 0, inFlight: 0 };
}

/**
 * Démarre un load : nouvelle génération + inFlight++.
 * @returns gen à capturer pour shouldApplyLoadResult
 */
export function beginLoad(guard: LoadGuard): { gen: number; guard: LoadGuard } {
  const dataGen = guard.dataGen + 1;
  return {
    gen: dataGen,
    guard: { dataGen, inFlight: guard.inFlight + 1 },
  };
}

/**
 * Invalide tous les loads en cours (après mutation locale réussie).
 * N'affecte pas inFlight — les finally doivent toujours endLoad.
 */
export function invalidatePendingLoads(guard: LoadGuard): LoadGuard {
  return { ...guard, dataGen: guard.dataGen + 1 };
}

/**
 * true si le résultat du load démarré avec startedGen est encore valide.
 */
export function shouldApplyLoadResult(
  startedGen: number,
  currentGen: number
): boolean {
  return startedGen === currentGen;
}

/**
 * Termine un load : inFlight--.
 * clearSpinners=true quand plus aucun load en vol.
 */
export function endLoad(guard: LoadGuard): {
  clearSpinners: boolean;
  guard: LoadGuard;
} {
  const inFlight = Math.max(0, guard.inFlight - 1);
  return {
    clearSpinners: inFlight === 0,
    guard: { ...guard, inFlight },
  };
}
