/**
 * @vitest-environment jsdom
 *
 * Couverture UI recherche dédiée ops (nouveau composant).
 * Les cas page (session, sticky, double-clic, A→B) restent dans
 * rappels-operations-page.test.tsx — voir en-tête de ce fichier-là.
 */
import React from "react";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, render, screen, waitFor, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  RAPPEL_DETTE_ADHERENT_SEARCH_TRUNCATED_MESSAGE,
} from "@/lib/services/cotisations/rappel-dette/rappel-dette-adherent-search-constants";

const searchAction = vi.fn();

vi.mock("@/actions/cotisations/search-rappel-dette-adherents", () => ({
  searchRappelDetteAdherentsAction: (...args: unknown[]) =>
    searchAction(...args),
}));

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
  DialogTitle: ({ children }: { children: React.ReactNode }) => (
    <h2>{children}</h2>
  ),
  DialogDescription: ({ children }: { children: React.ReactNode }) => (
    <p>{children}</p>
  ),
}));

import { RappelsOperationsAdherentSearch } from "@/components/admin/RappelsOperationsAdherentSearch";

describe("RappelsOperationsAdherentSearch", () => {
  beforeEach(() => {
    searchAction.mockReset();
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("aucune requête sous le seuil (1 caractère)", async () => {
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    render(
      <RappelsOperationsAdherentSearch
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );
    await user.type(screen.getByRole("searchbox"), "A");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(400);
    });
    expect(searchAction).not.toHaveBeenCalled();
    expect(screen.getByText(/au moins 2 caractères pour lancer/i)).toBeTruthy();
  });

  it("debounce puis résultats ; sélection appelle onSelect", async () => {
    searchAction.mockResolvedValue({
      success: true,
      data: {
        query: "Ada",
        items: [
          {
            adherentId: "id-1",
            firstname: "Ada",
            lastname: "Lovelace",
            disambiguationLabel: "Fiche 1",
          },
        ],
        truncated: false,
        limit: 20,
      },
    });
    const onSelect = vi.fn();
    const onOpenChange = vi.fn();
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    render(
      <RappelsOperationsAdherentSearch
        open
        onOpenChange={onOpenChange}
        onSelect={onSelect}
      />
    );
    await user.type(screen.getByRole("searchbox"), "Ada");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => {
      expect(searchAction).toHaveBeenCalledWith({ query: "Ada" });
    });
    await waitFor(() => {
      expect(screen.getByText("Ada Lovelace")).toBeTruthy();
    });
    expect(screen.getByText("Fiche 1")).toBeTruthy();
    expect(screen.queryByText(/passeport|P-001/i)).toBeNull();
    await user.click(screen.getByRole("option"));
    expect(onSelect).toHaveBeenCalledWith({
      id: "id-1",
      firstname: "Ada",
      lastname: "Lovelace",
      disambiguationLabel: "Fiche 1",
    });
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("affiche message tronqué", async () => {
    searchAction.mockResolvedValue({
      success: true,
      data: {
        query: "Du",
        items: [
          {
            adherentId: "id-1",
            firstname: "A",
            lastname: "Du",
            disambiguationLabel: null,
          },
        ],
        truncated: true,
        limit: 20,
      },
    });
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    render(
      <RappelsOperationsAdherentSearch
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );
    await user.type(screen.getByRole("searchbox"), "Du");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => {
      expect(
        screen.getByText(RAPPEL_DETTE_ADHERENT_SEARCH_TRUNCATED_MESSAGE)
      ).toBeTruthy();
    });
  });

  it("vide ≠ erreur technique (status, pas alert)", async () => {
    searchAction.mockResolvedValue({
      success: true,
      data: { query: "Zz", items: [], truncated: false, limit: 20 },
    });
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    render(
      <RappelsOperationsAdherentSearch
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );
    await user.type(screen.getByRole("searchbox"), "Zz");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => {
      expect(screen.getByText(/Aucun adhérent trouvé/i)).toBeTruthy();
    });
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("erreur technique affichée (role=alert)", async () => {
    searchAction.mockResolvedValue({
      success: false,
      error: "Erreur technique lors de la recherche d’adhérents.",
      code: "INTERNAL_ERROR",
    });
    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    render(
      <RappelsOperationsAdherentSearch
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );
    await user.type(screen.getByRole("searchbox"), "Er");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => {
      expect(screen.getByRole("alert").textContent).toMatch(/Erreur technique/i);
    });
  });

  it("ignore réponse obsolète (ordre inverse)", async () => {
    let resolveSlow: (v: unknown) => void = () => {};
    const slow = new Promise((resolve) => {
      resolveSlow = resolve;
    });
    searchAction
      .mockImplementationOnce(() => slow)
      .mockResolvedValueOnce({
        success: true,
        data: {
          query: "Bo",
          items: [
            {
              adherentId: "id-bob",
              firstname: "Bob",
              lastname: "Builder",
              disambiguationLabel: null,
            },
          ],
          truncated: false,
          limit: 20,
        },
      });

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    render(
      <RappelsOperationsAdherentSearch
        open
        onOpenChange={() => {}}
        onSelect={() => {}}
      />
    );
    const box = screen.getByRole("searchbox");
    await user.type(box, "Ad");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => expect(searchAction).toHaveBeenCalledTimes(1));

    await user.clear(box);
    await user.type(box, "Bo");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => expect(searchAction).toHaveBeenCalledTimes(2));
    await waitFor(() => {
      expect(screen.getByText("Bob Builder")).toBeTruthy();
    });

    await act(async () => {
      resolveSlow({
        success: true,
        data: {
          query: "Ad",
          items: [
            {
              adherentId: "id-ada",
              firstname: "Ada",
              lastname: "Lovelace",
              disambiguationLabel: null,
            },
          ],
          truncated: false,
          limit: 20,
        },
      });
    });
    expect(screen.queryByText("Ada Lovelace")).toBeNull();
    expect(screen.getByText("Bob Builder")).toBeTruthy();
  });

  it("ignore réponse après fermeture", async () => {
    let resolveLate: (v: unknown) => void = () => {};
    const late = new Promise((resolve) => {
      resolveLate = resolve;
    });
    searchAction.mockImplementationOnce(() => late);

    const user = userEvent.setup({
      advanceTimers: vi.advanceTimersByTime,
    });
    const onSelect = vi.fn();
    const { rerender } = render(
      <RappelsOperationsAdherentSearch
        open
        onOpenChange={() => {}}
        onSelect={onSelect}
      />
    );
    await user.type(screen.getByRole("searchbox"), "Ad");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });
    await waitFor(() => expect(searchAction).toHaveBeenCalledTimes(1));

    rerender(
      <RappelsOperationsAdherentSearch
        open={false}
        onOpenChange={() => {}}
        onSelect={onSelect}
      />
    );

    await act(async () => {
      resolveLate({
        success: true,
        data: {
          query: "Ad",
          items: [
            {
              adherentId: "id-1",
              firstname: "Ada",
              lastname: "Lovelace",
              disambiguationLabel: null,
            },
          ],
          truncated: false,
          limit: 20,
        },
      });
    });
    expect(onSelect).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
