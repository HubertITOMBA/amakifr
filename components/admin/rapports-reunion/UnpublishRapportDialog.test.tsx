/**
 * @vitest-environment jsdom
 *
 * Dépublication via AlertDialog — comportement vs window.confirm + Radix.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toastSuccess = vi.fn();
const toastError = vi.fn();

vi.mock("sonner", () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
  },
}));

import { UnpublishRapportDialog } from "@/components/admin/rapports-reunion/UnpublishRapportDialog";

describe("UnpublishRapportDialog", () => {
  const unpublishAction = vi.fn();
  const onOpenChange = vi.fn();
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    unpublishAction.mockResolvedValue({
      success: true,
      message: "Rapport repassé en brouillon. Les adhérents ne peuvent plus le consulter.",
    });
  });

  afterEach(() => {
    cleanup();
  });

  function renderDialog(open = true) {
    return render(
      <UnpublishRapportDialog
        open={open}
        rapport={{ id: "rapp-1", titre: "CR synthétique" }}
        onOpenChange={onOpenChange}
        unpublishAction={unpublishAction}
        onSuccess={onSuccess}
      />
    );
  }

  it("affiche le dialog avec titre et avertissement adhérents", async () => {
    renderDialog(true);
    const dialog = await screen.findByTestId("unpublish-rapport-dialog");
    expect(dialog).toBeTruthy();
    expect(
      screen.getByRole("heading", {
        name: /Repasser ce rapport en brouillon/i,
      })
    ).toBeTruthy();
    expect(screen.getByText(/ne sera plus visible/i)).toBeTruthy();
    expect(screen.getByText(/CR synthétique/i)).toBeTruthy();
  });

  it("Annuler ferme sans appeler l’action", async () => {
    const user = userEvent.setup();
    renderDialog(true);
    await user.click(screen.getByRole("button", { name: /Annuler/i }));
    expect(unpublishAction).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("Confirmer appelle l’action une fois avec le bon ID puis refresh", async () => {
    const user = userEvent.setup();
    renderDialog(true);
    await user.click(screen.getByTestId("unpublish-rapport-confirm"));
    await waitFor(() => {
      expect(unpublishAction).toHaveBeenCalledTimes(1);
      expect(unpublishAction).toHaveBeenCalledWith("rapp-1");
    });
    await waitFor(() => {
      expect(toastSuccess).toHaveBeenCalled();
      expect(onOpenChange).toHaveBeenCalledWith(false);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("double activation pendant pending → un seul appel", async () => {
    let resolveAction: (v: { success: boolean; message?: string }) => void =
      () => undefined;
    unpublishAction.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveAction = resolve;
        })
    );
    const user = userEvent.setup();
    renderDialog(true);
    const confirmBtn = screen.getByTestId("unpublish-rapport-confirm");
    await user.click(confirmBtn);
    await user.click(confirmBtn);
    await user.click(confirmBtn);
    expect(unpublishAction).toHaveBeenCalledTimes(1);
    resolveAction({ success: true, message: "ok" });
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("erreur → toast erreur, dialog reste, réessai possible", async () => {
    const user = userEvent.setup();
    unpublishAction
      .mockResolvedValueOnce({ success: false, error: "Droit requis." })
      .mockResolvedValueOnce({ success: true, message: "ok" });

    renderDialog(true);
    await user.click(screen.getByTestId("unpublish-rapport-confirm"));
    await waitFor(() => {
      expect(toastError).toHaveBeenCalledWith("Droit requis.");
    });
    expect(onSuccess).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalledWith(false);

    await user.click(screen.getByTestId("unpublish-rapport-confirm"));
    await waitFor(() => {
      expect(unpublishAction).toHaveBeenCalledTimes(2);
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it("n’utilise pas window.confirm", async () => {
    const confirmSpy = vi.spyOn(window, "confirm");
    const user = userEvent.setup();
    renderDialog(true);
    await user.click(screen.getByTestId("unpublish-rapport-confirm"));
    await waitFor(() => expect(unpublishAction).toHaveBeenCalled());
    expect(confirmSpy).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("sélection « Repasser en brouillon » ouvre le dialog (flux menu)", async () => {
    const user = userEvent.setup();
    function MenuHarness() {
      const [open, setOpen] = React.useState(false);
      const [rapport, setRapport] = React.useState<{
        id: string;
        titre: string;
      } | null>(null);
      return (
        <>
          <button
            type="button"
            onClick={() => {
              setRapport({ id: "rapp-1", titre: "CR synthétique" });
              setOpen(true);
            }}
          >
            Repasser en brouillon
          </button>
          <UnpublishRapportDialog
            open={open}
            rapport={rapport}
            onOpenChange={setOpen}
            unpublishAction={unpublishAction}
            onSuccess={onSuccess}
          />
        </>
      );
    }
    render(<MenuHarness />);
    expect(screen.queryByTestId("unpublish-rapport-dialog")).toBeNull();
    await user.click(
      screen.getByRole("button", { name: /^Repasser en brouillon$/i })
    );
    expect(
      await screen.findByTestId("unpublish-rapport-dialog")
    ).toBeTruthy();
    expect(unpublishAction).not.toHaveBeenCalled();
  });
});
