/**
 * Worker Node-only des notes de frais (outbox / file jobs / purge archive).
 *
 * Séparé de `instrumentation.ts` pour que Next.js le bundle uniquement dans
 * le graphe Node (import dynamique derrière NEXT_RUNTIME === "nodejs"),
 * sans laisser un chemin relatif `webpackIgnore` irrésolu depuis `.next/server/`.
 */

import {
  processNoteFraisFileJobsOnce,
  processNoteFraisOutboxOnce,
} from "@/lib/services/frais-avances/note-frais-service";
import { processNoteFraisArchivePurgeOnce } from "@/lib/services/frais-avances/note-frais-archive-service";

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

/**
 * Démarre le singleton worker (ticks non chevauchants, intervalle 60s).
 * No-op si déjà démarré dans ce processus.
 */
export async function startNotesFraisWorkers(): Promise<void> {
  const state = getWorkerState();
  if (state.started) return;
  state.started = true;

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

/** Exposé pour les tests — réinitialise le singleton processus. */
export function __resetNotesFraisWorkersForTests(): void {
  const g = globalThis as typeof globalThis & {
    [globalKey]?: WorkerState;
  };
  const state = g[globalKey];
  if (state?.intervalId) clearInterval(state.intervalId);
  g[globalKey] = {
    started: false,
    running: false,
    intervalId: null,
  };
}
