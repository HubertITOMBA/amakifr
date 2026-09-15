/**
 * Instrumentation Next — reprise périodique outbox / file jobs frais avancés.
 * Compatible PM2 fork existant ; aucun changement VPS requis.
 * No-op si NOTES_FRAIS_ENABLED !== "true".
 *
 * Singleton processus : un seul intervalle ; ticks non chevauchants.
 * webpackIgnore : modules Node (fs/crypto) hors graphe webpack instrumentation.
 */

type WorkerState = {
  started: boolean;
  running: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
};

const globalKey = "__amakiNotesFraisWorker__" as const;

function getWorkerState(): WorkerState {
  const g = globalThis as typeof globalThis & {
    [globalKey]?: WorkerState;
  };
  if (!g[globalKey]) {
    g[globalKey] = {
      started: false,
      running: false,
      intervalId: null,
    };
  }
  return g[globalKey]!;
}

function logWorkerError(scope: string, error: unknown) {
  const message =
    error instanceof Error ? error.message.slice(0, 160) : "unknown";
  console.error(`[notes-frais] ${scope}`, { err: message });
}

export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  if (process.env.NOTES_FRAIS_ENABLED !== "true") return;

  const state = getWorkerState();
  if (state.started) return;
  state.started = true;

  const { processNoteFraisOutboxOnce, processNoteFraisFileJobsOnce } =
    await import(
      /* webpackIgnore: true */
      "./lib/services/frais-avances/note-frais-service"
    );
  const { processNoteFraisArchivePurgeOnce } = await import(
    /* webpackIgnore: true */
    "./lib/services/frais-avances/note-frais-archive-service"
  );

  const tick = async () => {
    if (state.running) {
      console.info("[notes-frais] tick skipped (already running)");
      return;
    }
    state.running = true;
    try {
      await processNoteFraisOutboxOnce();
      await processNoteFraisFileJobsOnce();
      await processNoteFraisArchivePurgeOnce();
    } catch (error) {
      logWorkerError("tick failed", error);
    } finally {
      state.running = false;
    }
  };

  void tick();
  state.intervalId = setInterval(() => {
    void tick();
  }, 60_000);
}
