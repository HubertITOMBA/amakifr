/**
 * @vitest-environment jsdom
 *
 * Dialogs confirmation soumission / suppression justificatif — design + payloads.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const submitMock = vi.fn();
const deleteMock = vi.fn();

vi.mock("@/actions/frais-avances", () => ({
  actionSubmitNoteFrais: (...args: unknown[]) => submitMock(...args),
  actionDeleteNoteFraisJustificatif: (...args: unknown[]) =>
    deleteMock(...args),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { SubmitNoteFraisConfirmDialog } from "@/components/frais-avances/SubmitNoteFraisConfirmDialog";
import { DeleteJustificatifConfirmDialog } from "@/components/frais-avances/DeleteJustificatifConfirmDialog";

describe("Confirm dialogs frais avancés", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    submitMock.mockResolvedValue({ success: true, message: "Soumise" });
    deleteMock.mockResolvedValue({ success: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("soumission : header dégradé + payload inchangé", async () => {
    const user = userEvent.setup();
    render(
      <SubmitNoteFraisConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        noteId="n3"
        expectedVersion={2}
        idempotencyKey="submit-key"
        libelle="Note soumission"
        montantDemande={25}
        onDone={vi.fn()}
      />
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector(".bg-gradient-to-r")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /Soumettre la note/i })
    ).toBeTruthy();

    await user.click(screen.getByTestId("submit-note-frais-confirm"));
    await waitFor(() => {
      expect(submitMock).toHaveBeenCalledWith({
        noteId: "n3",
        idempotencyKey: "submit-key",
        expectedVersion: 2,
      });
    });
  });

  it("suppression justificatif : header dégradé + payload inchangé", async () => {
    const user = userEvent.setup();
    render(
      <DeleteJustificatifConfirmDialog
        open={true}
        onOpenChange={vi.fn()}
        noteId="n3"
        justificatifId="j1"
        fileName="facture.pdf"
        expectedVersion={2}
        onDone={vi.fn()}
      />
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector(".bg-gradient-to-r")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /Supprimer le justificatif/i })
    ).toBeTruthy();

    await user.click(screen.getByTestId("delete-justificatif-confirm"));
    await waitFor(() => {
      expect(deleteMock).toHaveBeenCalledWith({
        noteId: "n3",
        justificatifId: "j1",
        expectedVersion: 2,
      });
    });
  });
});
