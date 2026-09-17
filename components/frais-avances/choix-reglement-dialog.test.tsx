/**
 * @vitest-environment jsdom
 *
 * Dialog choix règlement — design + payload actionSetChoixReglementNoteFrais.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const setChoixMock = vi.fn();

vi.mock("@/actions/frais-avances", () => ({
  actionSetChoixReglementNoteFrais: (...args: unknown[]) =>
    setChoixMock(...args),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { ChoixReglementDialog } from "@/components/frais-avances/ChoixReglementDialog";

describe("ChoixReglementDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setChoixMock.mockResolvedValue({
      success: true,
      message: "Choix enregistré",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche header dégradé et conserve le payload remboursement", async () => {
    const user = userEvent.setup();
    render(
      <ChoixReglementDialog
        open={true}
        onOpenChange={vi.fn()}
        noteId="n2"
        expectedNoteVersion={4}
        idempotencyKey="choix-key"
        montantAccepte="50.00"
        cibles={[]}
        onDone={vi.fn()}
      />
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector(".bg-gradient-to-r")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /Choix de règlement/i })
    ).toBeTruthy();
    expect(
      screen.getByText(/Indiquez comment utiliser le montant accepté/i)
    ).toBeTruthy();

    await user.click(screen.getByTestId("choix-reglement-submit"));

    await waitFor(() => {
      expect(setChoixMock).toHaveBeenCalledWith({
        noteId: "n2",
        expectedNoteVersion: 4,
        idempotencyKey: "choix-key",
        mode: "REMBOURSEMENT",
        montantRemboursement: "50.00",
        montantCompensation: "0.00",
        cibles: [],
      });
    });
    expect(screen.getByRole("button", { name: /Annuler/i })).toBeTruthy();
  });
});
