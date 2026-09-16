/**
 * @vitest-environment jsdom
 *
 * Dialog création brouillon — design + payload actionCreateNoteFraisDraft.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const createDraftMock = vi.fn();
const push = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}));

vi.mock("@/actions/frais-avances", () => ({
  actionCreateNoteFraisDraft: (...args: unknown[]) => createDraftMock(...args),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import { CreateNoteFraisDraftDialog } from "@/components/frais-avances/CreateNoteFraisDraftDialog";

describe("CreateNoteFraisDraftDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createDraftMock.mockResolvedValue({
      success: true,
      message: "Brouillon créé",
      data: { id: "note-1" },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche header dégradé, titres accessibles, labels et conserve le payload", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <CreateNoteFraisDraftDialog open={true} onOpenChange={onOpenChange} />
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector(".bg-gradient-to-r")).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: /Nouveau brouillon/i })
    ).toBeTruthy();
    expect(
      screen.getByText(/Saisissez les informations minimales/i)
    ).toBeTruthy();
    // Radix DescriptionWarning : id DOM = context.descriptionId
    await waitFor(() => {
      const describedBy = dialog.getAttribute("aria-describedby");
      expect(describedBy).toBeTruthy();
      expect(document.getElementById(describedBy!)).toBeTruthy();
    });
    expect(
      warnSpy.mock.calls.some((c) =>
        String(c[0] ?? "").includes("Missing `Description`")
      )
    ).toBe(false);
    warnSpy.mockRestore();

    const libelle = screen.getByLabelText(/Libellé/i);
    const date = screen.getByLabelText(/Date de dépense/i);
    const montant = screen.getByLabelText(/Montant demandé/i);
    expect(libelle.id).toBeTruthy();
    expect(date.id).toBeTruthy();
    expect(montant.id).toBeTruthy();

    await user.type(libelle, "Achat test");
    await user.type(date, "2026-03-15");
    await user.type(montant, "42.5");
    await user.click(
      screen.getByTestId("create-note-frais-draft-submit")
    );

    await waitFor(() => {
      expect(createDraftMock).toHaveBeenCalledWith({
        libelle: "Achat test",
        description: "",
        dateDepense: "2026-03-15",
        montantDemande: 42.5,
      });
    });
    expect(screen.getByRole("button", { name: /Annuler/i })).toBeTruthy();
  });
});
