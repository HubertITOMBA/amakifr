/**
 * @vitest-environment jsdom
 */
import React, { useState } from "react";
import { describe, expect, it, vi, afterEach, beforeAll } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserMultiSelectComboboxWithFilters } from "@/components/admin/UserMultiSelectComboboxWithFilters";

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);

  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = vi.fn();
  }
});

const users = [
  {
    id: "u1",
    name: "Alice Dupont",
    email: "alice@amaki.fr",
    status: "Actif",
    role: "MEMBRE",
    adherent: { firstname: "Alice", lastname: "Dupont" },
  },
  {
    id: "u2",
    name: "Bob Martin",
    email: "bob@example.com",
    status: "Actif",
    role: "MEMBRE",
    adherent: { firstname: "Bob", lastname: "Martin" },
  },
  {
    id: "u3",
    name: "Charlie Durand",
    email: "charlie@amaki.fr",
    status: "Actif",
    role: "MEMBRE",
    adherent: { firstname: "Charlie", lastname: "Durand" },
  },
];

function Harness({
  initialValue = [] as string[],
}: {
  initialValue?: string[];
}) {
  const [value, setValue] = useState<string[]>(initialValue);
  return (
    <div>
      <div data-testid="selected-ids">{value.join(",")}</div>
      <UserMultiSelectComboboxWithFilters
        users={users}
        value={value}
        onValueChange={setValue}
        placeholder="Rechercher des utilisateurs..."
        showAllOption
      />
    </div>
  );
}

async function openCombobox(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("combobox"));
  expect(await screen.findByPlaceholderText(/Rechercher par nom/i)).toBeTruthy();
}

describe("UserMultiSelectComboboxWithFilters", () => {
  afterEach(() => {
    cleanup();
  });

  it("trouve un e-mail exact (shouldFilter=false, pas de CommandEmpty erroné)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCombobox(user);

    await user.type(
      screen.getByPlaceholderText(/Rechercher par nom/i),
      "alice@amaki.fr"
    );

    expect(await screen.findByText("alice@amaki.fr")).toBeTruthy();
    expect(
      screen.queryByText(/Aucun utilisateur ne correspond aux filtres/i)
    ).toBeNull();
    expect(screen.queryByText("bob@example.com")).toBeNull();
  });

  it("trouve un e-mail partiel", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCombobox(user);

    await user.type(screen.getByPlaceholderText(/Rechercher par nom/i), "amaki");

    expect(await screen.findByText("alice@amaki.fr")).toBeTruthy();
    expect(screen.getByText("charlie@amaki.fr")).toBeTruthy();
    expect(screen.queryByText("bob@example.com")).toBeNull();
  });

  it("trouve par name", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCombobox(user);

    await user.type(screen.getByPlaceholderText(/Rechercher par nom/i), "bob martin");

    expect(await screen.findByText("Bob Martin")).toBeTruthy();
    expect(screen.queryByText("Alice Dupont")).toBeNull();
  });

  it("trouve par firstname/lastname", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCombobox(user);

    await user.type(screen.getByPlaceholderText(/Rechercher par nom/i), "dupont");

    expect(await screen.findByText("Alice Dupont")).toBeTruthy();
    expect(screen.queryByText("Bob Martin")).toBeNull();
  });

  it("sélection individuelle", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCombobox(user);

    await user.click(screen.getByText("Alice Dupont"));

    await waitFor(() => {
      expect(screen.getByTestId("selected-ids").textContent).toBe("u1");
    });
  });

  it("sélectionne tous les résultats filtrés sans toucher aux IDs hors filtre", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue={["u2"]} />);
    await openCombobox(user);

    await user.type(screen.getByPlaceholderText(/Rechercher par nom/i), "amaki");
    expect(await screen.findByText("alice@amaki.fr")).toBeTruthy();

    await user.click(
      screen.getByText(/Sélectionner tous les résultats \(2\)/i)
    );

    await waitFor(() => {
      const ids = (screen.getByTestId("selected-ids").textContent || "").split(
        ","
      );
      expect(ids).toEqual(expect.arrayContaining(["u1", "u2", "u3"]));
      expect(ids).toHaveLength(3);
      expect(new Set(ids).size).toBe(3);
    });
  });

  it("désélectionne uniquement les résultats filtrés", async () => {
    const user = userEvent.setup();
    render(<Harness initialValue={["u1", "u2", "u3"]} />);
    await openCombobox(user);

    await user.type(screen.getByPlaceholderText(/Rechercher par nom/i), "amaki");
    expect(await screen.findByText(/Désélectionner les résultats/i)).toBeTruthy();

    await user.click(screen.getByText(/Désélectionner les résultats/i));

    await waitFor(() => {
      expect(screen.getByTestId("selected-ids").textContent).toBe("u2");
    });
  });

  it("isAllSelected correct avec IDs hors filtre déjà sélectionnés", async () => {
    const user = userEvent.setup();
    // u2 hors filtre "amaki" ; u1 dans filtre
    render(<Harness initialValue={["u1", "u2"]} />);
    await openCombobox(user);

    await user.type(screen.getByPlaceholderText(/Rechercher par nom/i), "alice@amaki.fr");
    // Un seul résultat filtré (u1), déjà sélectionné → Désélectionner
    expect(await screen.findByText(/Désélectionner les résultats/i)).toBeTruthy();
    expect(
      screen.queryByText(/Sélectionner tous les résultats/i)
    ).toBeNull();
  });

  it("Command a shouldFilter={false} (comportement e-mail)", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCombobox(user);
    await user.type(
      screen.getByPlaceholderText(/Rechercher par nom/i),
      "alice@amaki.fr"
    );
    expect(await screen.findByText("alice@amaki.fr")).toBeTruthy();
    expect(
      screen.queryByText(/Aucun utilisateur ne correspond aux filtres/i)
    ).toBeNull();
  });

  it("navigation clavier de base : Escape ferme le popover", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await openCombobox(user);
    expect(screen.getByPlaceholderText(/Rechercher par nom/i)).toBeTruthy();

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByPlaceholderText(/Rechercher par nom/i)).toBeNull();
    });
  });
});
