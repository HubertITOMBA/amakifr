/**
 * @vitest-environment jsdom
 *
 * Dialog décision admin — design + payload actionDecideNoteFrais.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const decideMock = vi.fn();

vi.mock("@/actions/frais-avances", () => ({
  actionDecideNoteFrais: (...args: unknown[]) => decideMock(...args),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { DecideNoteFraisDialog } from "@/components/frais-avances/DecideNoteFraisDialog";

describe("DecideNoteFraisDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decideMock.mockResolvedValue({
      success: true,
      message: "Décision enregistrée",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche header dégradé, labels liés et conserve le payload", async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    render(
      <DecideNoteFraisDialog
        open={true}
        onOpenChange={vi.fn()}
        noteId="n1"
        expectedVersion={3}
        idempotencyKey="decide-key"
        libelle="Note admin"
        montantDemande={100}
        onDone={onDone}
      />
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector(".bg-gradient-to-r")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /Décider de la note/i })
    ).toBeTruthy();
    expect(screen.getByText(/Validation ou rejet/i)).toBeTruthy();

    const montant = screen.getByLabelText(/Montant accepté/i);
    expect(montant.id).toBe("nf-decide-montant");
    await user.clear(montant);
    await user.type(montant, "80");
    await user.type(screen.getByLabelText(/Motif/i), "Partiel");

    await user.click(screen.getByTestId("decide-note-frais-submit"));

    await waitFor(() => {
      expect(decideMock).toHaveBeenCalledWith({
        noteId: "n1",
        expectedVersion: 3,
        idempotencyKey: "decide-key",
        outcome: "VALIDEE",
        montantAccepte: 80,
        motif: "Partiel",
      });
    });
    expect(screen.getByRole("button", { name: /Annuler/i })).toBeTruthy();
  });
});
