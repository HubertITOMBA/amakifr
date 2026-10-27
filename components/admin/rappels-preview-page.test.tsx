/**
 * @vitest-environment jsdom
 */
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserRole } from "@prisma/client";
import {
  PREVIEW_REFRESH_INCOMPLETE_TOAST,
  PREVIEW_REFRESH_SUCCESS_TOAST,
} from "@/lib/services/cotisations/rappel-dette/preview-display";
import { PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE } from "@/lib/services/cotisations/rappel-dette/preview-access";

const getPreviewRappelsDetteAction = vi.fn();
const toastSuccess = vi.fn();
const toastWarning = vi.fn();
const toastError = vi.fn();

vi.mock("@/actions/cotisations/preview-rappels-dette", () => ({
  getPreviewRappelsDetteAction: (...args: unknown[]) =>
    getPreviewRappelsDetteAction(...args),
}));

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({ id: "admin-1", role: UserRole.ADMIN }),
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

import AdminRappelsPreviewPage from "@/app/admin/finances/rappels-preview/page";

function basePreviewData(
  overrides: Partial<{
    incomplete: boolean;
    computedAt: string;
  }> = {}
) {
  return {
    banner: "Prévisualisation — aucun envoi",
    computedAt: overrides.computedAt ?? "2024-06-30T12:00:00.000Z",
    timezone: "Europe/Paris",
    incomplete: overrides.incomplete ?? false,
    incompleteAlert: overrides.incomplete
      ? "Prévisualisation incomplète"
      : null,
    eligible: [],
    excluded: [],
    failed: overrides.incomplete
      ? [
          {
            adherentId: "a-fail",
            displayName: "Échec Tech",
            montantBrut: "0",
            avoirDisponible: "0",
            detteNette: "0",
            earliestDueDate: null,
            computationKind: "failed" as const,
            globalReasonLabels: [{ code: "TECH", label: "Échec" }],
            ignoredReasonLabels: [],
          },
        ]
      : [],
    totals: {
      adherentsScanned: 1,
      eligibleCount: 0,
      excludedCount: 0,
      failedCount: overrides.incomplete ? 1 : 0,
      montantBrutEligibleTotal: "0",
      detteNetteEligibleTotal: "0",
      totalsPartial: overrides.incomplete ?? false,
    },
  };
}

describe("AdminRappelsPreviewPage — Actualiser / toasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getPreviewRappelsDetteAction.mockResolvedValue({
      success: true,
      data: basePreviewData(),
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("chargement initial : pas de toast succès/avertissement", async () => {
    render(<AdminRappelsPreviewPage />);
    await screen.findByText("Prévisualisation des rappels");
    await waitFor(() => {
      expect(getPreviewRappelsDetteAction).toHaveBeenCalledTimes(1);
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastWarning).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("affiche computedAt avec secondes (instant serveur), pas seulement le jour", async () => {
    render(<AdminRappelsPreviewPage />);
    await screen.findByText("Date de référence");
    // 12:00 UTC → 14:00:00 Europe/Paris (CEST)
    await waitFor(() => {
      const ref = screen.getByText(/14:00:00/);
      expect(ref).toBeTruthy();
    });
  });

  it("clic Actualiser réussi : toast Prévisualisation actualisée.", async () => {
    const user = userEvent.setup();
    render(<AdminRappelsPreviewPage />);
    await screen.findByRole("button", { name: /Actualiser/i });
    await waitFor(() =>
      expect(getPreviewRappelsDetteAction).toHaveBeenCalledTimes(1)
    );

    getPreviewRappelsDetteAction.mockResolvedValueOnce({
      success: true,
      data: basePreviewData({ computedAt: "2024-06-30T13:00:00.000Z" }),
    });

    await user.click(screen.getByRole("button", { name: /Actualiser/i }));
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalledWith(PREVIEW_REFRESH_SUCCESS_TOAST);
    });
    expect(toastWarning).not.toHaveBeenCalled();
    expect(getPreviewRappelsDetteAction).toHaveBeenCalledTimes(2);
  });

  it("clic Actualiser incomplet : toast avertissement", async () => {
    const user = userEvent.setup();
    render(<AdminRappelsPreviewPage />);
    await waitFor(() =>
      expect(getPreviewRappelsDetteAction).toHaveBeenCalledTimes(1)
    );

    getPreviewRappelsDetteAction.mockResolvedValueOnce({
      success: true,
      data: basePreviewData({ incomplete: true }),
    });

    await user.click(screen.getByRole("button", { name: /Actualiser/i }));
    await waitFor(() => {
      expect(toastWarning).toHaveBeenCalledWith(
        PREVIEW_REFRESH_INCOMPLETE_TOAST
      );
    });
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("conserve le toast d’erreur métier existant", async () => {
    const user = userEvent.setup();
    render(<AdminRappelsPreviewPage />);
    await waitFor(() =>
      expect(getPreviewRappelsDetteAction).toHaveBeenCalledTimes(1)
    );

    getPreviewRappelsDetteAction.mockResolvedValueOnce({
      success: false,
      error: "Erreur de prévisualisation métier",
      code: "INTERNAL",
    });

    await user.click(screen.getByRole("button", { name: /Actualiser/i }));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith(
        "Erreur de prévisualisation métier"
      );
    });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("conserve l’écran de refus sans toast succès", async () => {
    getPreviewRappelsDetteAction.mockResolvedValueOnce({
      success: false,
      error: PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE,
      code: "FORBIDDEN",
    });
    render(<AdminRappelsPreviewPage />);
    await screen.findByText(PREVIEW_RAPPELS_ACCESS_DENIED_MESSAGE);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastWarning).not.toHaveBeenCalled();
  });

  it("désactive Actualiser et montre le Loader pendant le chargement", async () => {
    let resolveAction!: (value: unknown) => void;
    getPreviewRappelsDetteAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        })
    );

    render(<AdminRappelsPreviewPage />);
    const btn = await screen.findByRole("button", { name: /Actualiser/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);

    resolveAction({ success: true, data: basePreviewData() });
    await waitFor(() => {
      expect(
        (screen.getByRole("button", { name: /Actualiser/i }) as HTMLButtonElement)
          .disabled
      ).toBe(false);
    });
  });
});
