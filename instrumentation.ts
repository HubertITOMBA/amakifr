/**
 * Instrumentation Next — reprise périodique outbox / file jobs frais avancés.
 * Compatible PM2 fork existant ; aucun changement VPS requis.
 *
 * - No-op si NOTES_FRAIS_ENABLED !== "true"
 * - No-op sur runtime Edge
 * - Worker Node : import dynamique bundlé de `./instrumentation-node`
 *   (sans webpackIgnore relatif — sinon résolution depuis `.next/server/` → MODULE_NOT_FOUND)
 * - Bundle Edge : `next.config` alias → `instrumentation-node-edge-stub` (sans Prisma/FS)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NOTES_FRAIS_ENABLED !== "true") return;

  const { startNotesFraisWorkers } = await import("./instrumentation-node");
  await startNotesFraisWorkers();
}
