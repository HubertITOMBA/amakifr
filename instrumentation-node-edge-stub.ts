/**
 * Stub Edge-only : remplace `instrumentation-node` dans le graphe Edge Webpack.
 * Aucun Prisma / fs — no-op si jamais appelé (register() sort déjà sur Edge).
 */
export async function startNotesFraisWorkers(): Promise<void> {
  return;
}

export function __resetNotesFraisWorkersForTests(): void {
  return;
}
