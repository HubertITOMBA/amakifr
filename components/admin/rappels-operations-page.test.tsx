/**
 * @vitest-environment jsdom
 *
 * Tests UI mockés (jsdom) — pas une recette navigateur.
 * Dialog/Checkbox/Select Radix sont mockés (surfaces accessibles minimales) :
 * ils prouvent les branches métier / verrous / stale ; pas le comportement Radix.
 *
 * Répartition couverture UI (nombre de tests ≠ conservation) :
 * — Ce fichier (page ops) : session/rôles, flags, capacités, double-clic
 *   confirm, stale historiques A→B, prepare tardif, session perdue,
 *   incertitude sticky A→B→A + Actualiser, source indisponible ≠ vide,
 *   message gel non rétroactif. Sélection adhérent via mock du composant
 *   RappelsOperationsAdherentSearch (pas la logique debounce/seuil).
 * — RappelsOperationsAdherentSearch.test.tsx : seuil, debounce, sélection,
 *   tronqué, vide≠erreur, réponse obsolète, fermeture.
 * — rappel-dette-adherent-search.test.ts + search-rappel-dette-adherents.test.ts :
 *   auth/rôles avant DB, Zod, DTO/limite/homonymes, erreurs serveur.
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserRole } from "@prisma/client";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";
import {
  RAPPEL_DETTE_CONFIRM_UNCERTAIN_MESSAGE,
  RAPPEL_DETTE_ENVOI_FLAG_OFF_BANNER,
  RAPPEL_DETTE_GEL_FLAG_OFF_BANNER,
  RAPPEL_DETTE_GEL_NON_RETROACTIF_MESSAGE,
  RAPPEL_DETTE_SOURCE_UNAVAILABLE_UI,
} from "@/lib/services/cotisations/rappel-dette/rappels-operations-display";
import { RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE } from "@/lib/services/cotisations/rappel-dette/rappel-dette-admin-read-constants";

const getCapabilities = vi.fn();
const listEnvois = vi.fn();
const listGels = vi.fn();
const prepareAction = vi.fn();
const confirmAction = vi.fn();
const resumeAction = vi.fn();
const poseAction = vi.fn();
const leveAction = vi.fn();
const toastSuccess = vi.fn();
const toastWarning = vi.fn();
const toastError = vi.fn();

let mockSessionStatus: "loading" | "authenticated" | "unauthenticated" =
  "authenticated";
let mockRole: UserRole | string = UserRole.ADMIN;
let mockUserId = "admin-1";

vi.mock("@/actions/cotisations/get-rappel-dette-admin-capabilities", () => ({
  getRappelDetteAdminCapabilitiesAction: (...args: unknown[]) =>
    getCapabilities(...args),
}));
vi.mock("@/actions/cotisations/list-rappel-dette-envois", () => ({
  listRappelDetteEnvoisAction: (...args: unknown[]) => listEnvois(...args),
}));
vi.mock("@/actions/cotisations/list-rappel-dette-gels", () => ({
  listRappelDetteGelsAction: (...args: unknown[]) => listGels(...args),
}));
vi.mock("@/actions/cotisations/prepare-rappel-dette-confirmation", () => ({
  prepareRappelDetteConfirmationAction: (...args: unknown[]) =>
    prepareAction(...args),
}));
vi.mock("@/actions/cotisations/confirm-rappel-dette-manual-send", () => ({
  confirmRappelDetteManualSendAction: (...args: unknown[]) =>
    confirmAction(...args),
}));
vi.mock("@/actions/cotisations/resume-rappel-dette-notification", () => ({
  resumeRappelDetteNotificationAction: (...args: unknown[]) =>
    resumeAction(...args),
}));
vi.mock("@/actions/cotisations/pose-rappel-dette-gel", () => ({
  poseRappelDetteGelAction: (...args: unknown[]) => poseAction(...args),
}));
vi.mock("@/actions/cotisations/leve-rappel-dette-gel", () => ({
  leveRappelDetteGelAction: (...args: unknown[]) => leveAction(...args),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    status: mockSessionStatus,
    data:
      mockSessionStatus === "authenticated"
        ? { user: { id: mockUserId, role: mockRole } }
        : null,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    warning: (...args: unknown[]) => toastWarning(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode;
    href: string;
  }) => <a href={href}>{children}</a>,
}));

vi.mock("@/components/admin/RappelsOperationsAdherentSearch", () => ({
  RappelsOperationsAdherentSearch: ({
    open,
    onSelect,
  }: {
    open: boolean;
    onSelect: (a: {
      id: string;
      firstname: string;
      lastname: string;
      disambiguationLabel: string | null;
    }) => void;
  }) =>
    open ? (
      <div>
        <button
          type="button"
          onClick={() =>
            onSelect({
              id: "adh-1",
              firstname: "Ada",
              lastname: "Lovelace",
              disambiguationLabel: "Fiche 1",
            })
          }
        >
          MockSelectAdherentA
        </button>
        <button
          type="button"
          onClick={() =>
            onSelect({
              id: "adh-2",
              firstname: "Bob",
              lastname: "Builder",
              disambiguationLabel: null,
            })
          }
        >
          MockSelectAdherentB
        </button>
      </div>
    ) : null,
}));

/** Mocks Radix — pas une validation navigateur. */
vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({
    open,
    children,
  }: {
    open?: boolean;
    children: React.ReactNode;
  }) => (open ? <div role="dialog">{children}</div> : null),
  DialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

vi.mock("@/components/ui/checkbox", () => ({
  Checkbox: ({
    id,
    checked,
    onCheckedChange,
    disabled,
  }: {
    id?: string;
    checked?: boolean;
    onCheckedChange?: (v: boolean) => void;
    disabled?: boolean;
  }) => (
    <input
      id={id}
      type="checkbox"
      checked={!!checked}
      disabled={disabled}
      onChange={(e) => onCheckedChange?.(e.target.checked)}
    />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({
    value,
    onValueChange,
    children,
  }: {
    value?: string;
    onValueChange?: (v: string) => void;
    children: React.ReactNode;
  }) => (
    <select
      aria-label="Motif"
      value={value ?? ""}
      onChange={(e) => onValueChange?.(e.target.value)}
    >
      <option value="">Choisir un motif</option>
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({
    value,
    children,
  }: {
    value: string;
    children: React.ReactNode;
  }) => <option value={value}>{children}</option>,
}));

import AdminRappelsOperationsPage from "@/app/admin/finances/rappels-operations/page";

function caps(
  overrides: { envoiEnabled?: boolean; gelMutationEnabled?: boolean } = {}
) {
  return {
    success: true as const,
    data: {
      canAccess: true as const,
      envoiEnabled: overrides.envoiEnabled ?? true,
      gelMutationEnabled: overrides.gelMutationEnabled ?? true,
      canProposeResend: false as const,
    },
  };
}

function emptyPage() {
  return {
    success: true as const,
    data: {
      items: [],
      pageSize: 20,
      hasMore: false,
      nextCursor: null,
    },
  };
}

function prepareOk(adherentId: string, token = "tok-secret") {
  return {
    success: true as const,
    data: {
      adherentId,
      clientConfirmationId: "cc-1",
      expectedFingerprint: "fp",
      gelsRevision: "1",
      templateVersion: "v2",
      detteNette: "45.00",
      referenceAt: "2024-06-30T12:00:00.000Z",
      referenceLabel: "Réf test",
      recipientMasked: "a***@e***.com",
      prepareExpiresAt: new Date(Date.now() + 60_000).toISOString(),
      confirmationToken: token,
    },
  };
}

function deferred<T>() {
  let resolve!: (v: T) => void;
  let reject!: (e: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function selectAdherent(
  user: ReturnType<typeof userEvent.setup>,
  which: "A" | "B" = "A"
) {
  await user.click(
    screen.getByRole("button", { name: /Rechercher un adhérent|Changer/i })
  );
  await user.click(
    screen.getByRole("button", {
      name:
        which === "A" ? /MockSelectAdherentA/i : /MockSelectAdherentB/i,
    })
  );
  await waitFor(() => {
    expect(listEnvois).toHaveBeenCalled();
  });
}

describe("AdminRappelsOperationsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSessionStatus = "authenticated";
    mockRole = UserRole.ADMIN;
    mockUserId = "admin-1";
    getCapabilities.mockResolvedValue(caps());
    listEnvois.mockResolvedValue(emptyPage());
    listGels.mockResolvedValue(emptyPage());
    prepareAction.mockResolvedValue(prepareOk("adh-1"));
    confirmAction.mockResolvedValue({
      success: true,
      data: { ok: true, envoiId: "envoi-new" },
    });
    resumeAction.mockResolvedValue({ success: true, data: { ok: true } });
    poseAction.mockResolvedValue({
      success: true,
      data: {
        outcome: "posed",
        gelId: "gel-new",
        adherentId: "adh-1",
        scope: "ADHERENT",
        statut: "ACTIF",
        gelsRevision: "2",
      },
    });
    leveAction.mockResolvedValue({
      success: true,
      data: {
        outcome: "lifted",
        gelId: "gel-1",
        adherentId: "adh-1",
        scope: "ADHERENT",
        statut: "LEVE",
        gelsRevision: "3",
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("session loading : pas de loadCapabilities", async () => {
    mockSessionStatus = "loading";
    render(<AdminRappelsOperationsPage />);
    await screen.findByText(/Vérification de la session/i);
    expect(getCapabilities).not.toHaveBeenCalled();
  });

  it("refus rôle non ADMIN/PRESID sans loadCapabilities", async () => {
    mockRole = UserRole.MEMBRE;
    render(<AdminRappelsOperationsPage />);
    await screen.findByText(PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE);
    expect(getCapabilities).not.toHaveBeenCalled();
    expect(prepareAction).not.toHaveBeenCalled();
  });

  it("montage ADMIN : capacités uniquement — aucune mutation", async () => {
    render(<AdminRappelsOperationsPage />);
    await screen.findByText("Opérations rappels dette");
    await waitFor(() => expect(getCapabilities).toHaveBeenCalledTimes(1));
    expect(prepareAction).not.toHaveBeenCalled();
    expect(confirmAction).not.toHaveBeenCalled();
    expect(listEnvois).not.toHaveBeenCalled();
  });

  it("Actualiser : lectures seules, pas de mutation", async () => {
    const user = userEvent.setup();
    render(<AdminRappelsOperationsPage />);
    await waitFor(() => expect(getCapabilities).toHaveBeenCalledTimes(1));
    await user.click(screen.getByRole("button", { name: /Actualiser/i }));
    await waitFor(() => expect(getCapabilities).toHaveBeenCalledTimes(2));
    expect(prepareAction).not.toHaveBeenCalled();
    expect(confirmAction).not.toHaveBeenCalled();
  });

  it("flags off : bannières et gestes bloqués", async () => {
    getCapabilities.mockResolvedValue(
      caps({ envoiEnabled: false, gelMutationEnabled: false })
    );
    const user = userEvent.setup();
    render(<AdminRappelsOperationsPage />);
    await screen.findByText(RAPPEL_DETTE_ENVOI_FLAG_OFF_BANNER);
    expect(screen.getByText(RAPPEL_DETTE_GEL_FLAG_OFF_BANNER)).toBeTruthy();
    await selectAdherent(user);
    expect(
      (screen.getByRole("button", { name: /Préparer l’envoi/i }) as HTMLButtonElement)
        .disabled
    ).toBe(true);
  });

  it("confirmation explicite + double invocation avant re-render : 1 seul confirm", async () => {
    const user = userEvent.setup();
    const d = deferred<{ success: true; data: { ok: true; envoiId: string } }>();
    confirmAction.mockImplementation(() => d.promise);

    render(<AdminRappelsOperationsPage />);
    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    await selectAdherent(user);
    await user.click(screen.getByRole("button", { name: /Préparer l’envoi/i }));
    await waitFor(() => expect(prepareAction).toHaveBeenCalledTimes(1));
    await user.click(
      screen.getByLabelText(/Je confirme explicitement l’envoi/i)
    );
    const btn = screen.getByRole("button", { name: /Confirmer l’envoi/i });
    // Double invocation synchrone (avant re-render)
    btn.click();
    btn.click();
    expect(confirmAction).toHaveBeenCalledTimes(1);
    d.resolve({ success: true, data: { ok: true, envoiId: "e1" } });
    await waitFor(() => expect(confirmAction).toHaveBeenCalledTimes(1));
  });

  it("A→B réponses historiques en ordre inverse : état B uniquement", async () => {
    const user = userEvent.setup();
    const dA = deferred<ReturnType<typeof emptyPage>>();
    const dB = deferred<{
      success: true;
      data: {
        items: Array<{ id: string; adherentId: string; detteNette: string } & Record<string, unknown>>;
        pageSize: number;
        hasMore: boolean;
        nextCursor: null;
      };
    }>();

    listEnvois.mockImplementation(async (raw: { adherentId: string }) => {
      if (raw.adherentId === "adh-1") return dA.promise;
      if (raw.adherentId === "adh-2") return dB.promise;
      return emptyPage();
    });
    listGels.mockResolvedValue(emptyPage());

    render(<AdminRappelsOperationsPage />);
    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    await selectAdherent(user, "A");
    await selectAdherent(user, "B");

    // B résout d’abord, puis A (obsolète)
    await act(async () => {
      dB.resolve({
        success: true,
        data: {
          items: [
            {
              id: "envoi-b",
              adherentId: "adh-2",
              reservationStatus: "STATUS-B-ONLY",
              emailStatus: "Accepted",
              notifStatus: "Completed",
              emailAcceptedMeaning: "provider_accepted_not_delivery",
              detteNette: "10.00",
              gelsRevision: "1",
              recipientMasked: "b***@e***.com",
              reservedAt: "2024-06-01T10:00:00.000Z",
              callingAt: null,
              emailAcceptedAt: null,
              closedAt: null,
              unknownAt: null,
              notifResumeEligible: false,
              canResumeNotif: false,
              canProposeResend: false,
            },
          ],
          pageSize: 20,
          hasMore: false,
          nextCursor: null,
        },
      });
    });
    await screen.findByText("STATUS-B-ONLY");
    await act(async () => {
      dA.resolve({
        success: true,
        data: {
          items: [
            {
              id: "envoi-a-stale",
              adherentId: "adh-1",
              reservationStatus: "STATUS-A-STALE",
              emailStatus: "Accepted",
              notifStatus: "Completed",
              emailAcceptedMeaning: null,
              detteNette: "99.00",
              gelsRevision: "1",
              recipientMasked: "a***@e***.com",
              reservedAt: "2024-06-01T10:00:00.000Z",
              callingAt: null,
              emailAcceptedAt: null,
              closedAt: null,
              unknownAt: null,
              notifResumeEligible: false,
              canResumeNotif: false,
              canProposeResend: false as const,
            },
          ],
          pageSize: 20,
          hasMore: false,
          nextCursor: null,
        },
      } as ReturnType<typeof emptyPage>);
    });
    expect(screen.queryByText("STATUS-A-STALE")).toBeNull();
    expect(screen.getByText("STATUS-B-ONLY")).toBeTruthy();
  });

  it("prepare tardif après changement d’adhérent : jeton non appliqué", async () => {
    const user = userEvent.setup();
    const dPrep = deferred<ReturnType<typeof prepareOk>>();
    prepareAction.mockImplementation(() => dPrep.promise);

    render(<AdminRappelsOperationsPage />);
    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    await selectAdherent(user, "A");
    await user.click(screen.getByRole("button", { name: /Préparer l’envoi/i }));
    await selectAdherent(user, "B");
    await act(async () => {
      dPrep.resolve(prepareOk("adh-1", "tok-stale"));
    });
    // Pas de panneau prepare pour A sur B
    expect(screen.queryByText(/Destinataire \(masqué\)/i)).toBeNull();
    expect(confirmAction).not.toHaveBeenCalled();
  });

  it("session perdue : plus de mutation, écran refus", async () => {
    const user = userEvent.setup();
    const { rerender } = render(<AdminRappelsOperationsPage />);
    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    await selectAdherent(user);
    const capsBefore = getCapabilities.mock.calls.length;

    mockSessionStatus = "unauthenticated";
    rerender(<AdminRappelsOperationsPage />);
    await screen.findByText(PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE);
    expect(prepareAction).not.toHaveBeenCalled();
    // Pas de nouveau prepare possible
    expect(screen.queryByRole("button", { name: /Préparer l’envoi/i })).toBeNull();
    expect(getCapabilities.mock.calls.length).toBe(capsBefore);
  });

  it("incertitude A→B→A conservée ; Actualiser ne lève pas le blocage", async () => {
    const user = userEvent.setup();
    confirmAction.mockRejectedValueOnce(new Error("network down"));

    render(<AdminRappelsOperationsPage />);
    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    await selectAdherent(user, "A");
    await user.click(screen.getByRole("button", { name: /Préparer l’envoi/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Confirmer l’envoi/i })).toBeTruthy()
    );
    await user.click(
      screen.getByLabelText(/Je confirme explicitement l’envoi/i)
    );
    await user.click(
      screen.getByRole("button", { name: /Confirmer l’envoi/i })
    );
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        RAPPEL_DETTE_CONFIRM_UNCERTAIN_MESSAGE
      );
    });
    expect(screen.getByText(RAPPEL_DETTE_CONFIRM_UNCERTAIN_MESSAGE)).toBeTruthy();

    await selectAdherent(user, "B");
    // B non bloqué pour prepare
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /Préparer l’envoi/i })
      ).toBeTruthy()
    );

    await selectAdherent(user, "A");
    // A toujours incertain
    await waitFor(() =>
      expect(
        screen.getByText(RAPPEL_DETTE_CONFIRM_UNCERTAIN_MESSAGE)
      ).toBeTruthy()
    );
    expect(
      screen.queryByRole("button", { name: /Préparer l’envoi/i })
    ).toBeNull();

    await user.click(screen.getByRole("button", { name: /Actualiser/i }));
    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    expect(
      screen.getByText(RAPPEL_DETTE_CONFIRM_UNCERTAIN_MESSAGE)
    ).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: /Préparer l’envoi/i })
    ).toBeNull();
  });

  it("source indisponible ≠ liste vide", async () => {
    listEnvois.mockResolvedValue({
      success: false,
      error: "Tables absentes",
      code: RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
    });
    listGels.mockResolvedValue({
      success: false,
      error: "Tables absentes",
      code: RAPPEL_DETTE_ADMIN_READ_SOURCE_UNAVAILABLE,
    });
    const user = userEvent.setup();
    render(<AdminRappelsOperationsPage />);
    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    await selectAdherent(user);
    const msgs = await screen.findAllByText(RAPPEL_DETTE_SOURCE_UNAVAILABLE_UI);
    expect(msgs.length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/Aucun envoi pour cet adhérent/i)).toBeNull();
  });

  it("gels : message non rétroactif présent", async () => {
    const user = userEvent.setup();
    render(<AdminRappelsOperationsPage />);
    await waitFor(() => expect(getCapabilities).toHaveBeenCalled());
    await selectAdherent(user);
    expect(screen.getByText(RAPPEL_DETTE_GEL_NON_RETROACTIF_MESSAGE)).toBeTruthy();
  });
});
