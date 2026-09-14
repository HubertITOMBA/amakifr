/**
 * @vitest-environment jsdom
 */
import React from "react";
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TypeNotification } from "@prisma/client";

const getAdminNotificationsPage = vi.fn();
const getAdminNotificationDetails = vi.fn();
const getAllUsersForAdmin = vi.fn();
const deleteNotification = vi.fn();
const createNotifications = vi.fn();

vi.mock("@/actions/notifications", () => ({
  getAdminNotificationsPage: (...args: unknown[]) =>
    getAdminNotificationsPage(...args),
  getAdminNotificationDetails: (...args: unknown[]) =>
    getAdminNotificationDetails(...args),
  deleteNotification: (...args: unknown[]) => deleteNotification(...args),
  createNotifications: (...args: unknown[]) => createNotifications(...args),
}));

vi.mock("@/actions/user", () => ({
  getAllUsersForAdmin: (...args: unknown[]) => getAllUsersForAdmin(...args),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/components/admin/UserMultiSelectComboboxWithFilters", () => ({
  UserMultiSelectComboboxWithFilters: () => (
    <div data-testid="user-multiselect" />
  ),
}));

import AdminNotificationsPage from "@/app/admin/notifications/page";

const sampleListItem = {
  id: "n1",
  type: TypeNotification.Systeme,
  titre: "Annonce importante",
  lue: false,
  createdAt: "2026-09-01T10:00:00.000Z",
  userId: "u1",
  User: { id: "u1", name: "Alice Dupont", email: "alice@amaki.fr" },
};

function lastSearchArg() {
  const calls = getAdminNotificationsPage.mock.calls;
  return calls[calls.length - 1]?.[0] as {
    page?: number;
    search?: string;
  };
}

describe("AdminNotificationsPage — consultation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllUsersForAdmin.mockResolvedValue({
      success: true,
      users: [{ id: "u1", adherent: { id: "a1" } }],
    });
    getAdminNotificationsPage.mockResolvedValue({
      success: true,
      notifications: [sampleListItem],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    getAdminNotificationDetails.mockResolvedValue({
      success: true,
      notification: {
        ...sampleListItem,
        message: "Bonjour\nDeuxième ligne",
        lien: "/notifications",
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("n'affiche pas de colonne Message", async () => {
    render(<AdminNotificationsPage />);
    await screen.findByText("Annonce importante");
    expect(screen.queryByRole("columnheader", { name: /^Message$/i })).toBeNull();
    expect(screen.getByRole("columnheader", { name: /Destinataire/i })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: /Titre/i })).toBeTruthy();
  });

  it("expose placeholder, aide et classes anti-chevauchement loupe", async () => {
    render(<AdminNotificationsPage />);
    await screen.findByText("Annonce importante");

    const input = screen.getByTestId("notifications-search-input");
    expect(input.getAttribute("placeholder")).toMatch(/titre, nom ou e-mail/i);
    expect(input.className).toMatch(/pl-10/);
    expect(input.className).toMatch(/sm:pl-10/);

    const icon = screen.getByTestId("search-icon");
    const iconClass = icon.getAttribute("class") || "";
    expect(iconClass).toMatch(/pointer-events-none/);
    expect(iconClass).toMatch(/absolute/);
    expect(iconClass).toMatch(/left-3/);

    expect(screen.getByTestId("notifications-search-help").textContent || "").toMatch(
      /titre|nom|e-mail/i
    );
  });

  it("un caractère n'envoie pas search et affiche l'aide min. 2", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationsPage />);
    await screen.findByText("Annonce importante");
    const callsBefore = getAdminNotificationsPage.mock.calls.length;

    await user.type(screen.getByTestId("notifications-search-input"), "z");

    await waitFor(
      () => {
        expect(screen.getByTestId("notifications-search-help").textContent || "").toContain(
          "Saisissez au moins 2 caractères"
        );
      },
      { timeout: 1500 }
    );

    await waitFor(() => {
      expect(getAdminNotificationsPage.mock.calls.length).toBeGreaterThan(callsBefore);
    });

    expect(lastSearchArg().search).toBeUndefined();
  });

  it("deux caractères lancent la recherche serveur", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationsPage />);
    await screen.findByText("Annonce importante");

    await user.type(screen.getByTestId("notifications-search-input"), "al");

    await waitFor(
      () => {
        expect(lastSearchArg().search).toBe("al");
      },
      { timeout: 2000 }
    );
  });

  it("effacer la recherche restaure la liste sans search", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationsPage />);
    await screen.findByText("Annonce importante");

    await user.type(screen.getByTestId("notifications-search-input"), "alice");
    await waitFor(
      () => {
        expect(lastSearchArg().search).toBe("alice");
      },
      { timeout: 2000 }
    );

    await user.click(screen.getByRole("button", { name: /Effacer la recherche/i }));

    await waitFor(
      () => {
        expect(lastSearchArg().search).toBeUndefined();
        expect(
          (screen.getByTestId("notifications-search-input") as HTMLInputElement).value
        ).toBe("");
      },
      { timeout: 2000 }
    );
  });

  it("désactive Actualiser pendant le chargement et ne recharge pas les users", async () => {
    let resolvePage: (value: unknown) => void = () => {};
    getAdminNotificationsPage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePage = resolve;
        })
    );

    const user = userEvent.setup();
    render(<AdminNotificationsPage />);

    await waitFor(() => {
      expect(getAllUsersForAdmin).toHaveBeenCalledTimes(1);
    });

    resolvePage({
      success: true,
      notifications: [sampleListItem],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    await screen.findByText("Annonce importante");

    getAdminNotificationsPage.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePage = resolve;
        })
    );

    const refreshBtn = screen.getByRole("button", { name: /Actualiser/i });
    await user.click(refreshBtn);

    expect((refreshBtn as HTMLButtonElement).disabled).toBe(true);
    expect(getAllUsersForAdmin).toHaveBeenCalledTimes(1);

    resolvePage({
      success: true,
      notifications: [{ ...sampleListItem, lue: true }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    await waitFor(() => {
      expect((refreshBtn as HTMLButtonElement).disabled).toBe(false);
    });
    expect(createNotifications).not.toHaveBeenCalled();
    expect(deleteNotification).not.toHaveBeenCalled();
  });

  it("Dialog Voir : header dégradé, description, badges et message multiligne", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationsPage />);
    await screen.findByText("Annonce importante");

    await user.click(screen.getByRole("button", { name: /Voir la notification/i }));

    const dialog = await screen.findByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText(/Bonjour/)).toBeTruthy();
    });
    expect(within(dialog).getByText(/Deuxième ligne/)).toBeTruthy();
    expect(
      within(dialog).getByText(/Consultation en lecture seule/i)
    ).toBeTruthy();
    expect(within(dialog).getByText("Alice Dupont")).toBeTruthy();
    expect(within(dialog).getByText("alice@amaki.fr")).toBeTruthy();
    expect(within(dialog).getByText("Système")).toBeTruthy();
    expect(within(dialog).getByText("Non lue")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /Fermer/i })).toBeTruthy();

    const header = dialog.querySelector(".bg-gradient-to-r");
    expect(header).toBeTruthy();
    expect(getAdminNotificationDetails).toHaveBeenCalledWith("n1");
  });

  it("affiche une erreur claire si les détails échouent", async () => {
    getAdminNotificationDetails.mockResolvedValue({
      success: false,
      error: "Notification introuvable",
    });
    const user = userEvent.setup();
    render(<AdminNotificationsPage />);
    await screen.findByText("Annonce importante");
    await user.click(screen.getByRole("button", { name: /Voir la notification/i }));
    const alert = await screen.findByRole("alert");
    expect(alert.textContent || "").toContain("Notification introuvable");
  });

  it("remet à la page 1 lors d'un changement de recherche", async () => {
    getAdminNotificationsPage.mockImplementation(async (opts: { page?: number }) => ({
      success: true,
      notifications: [sampleListItem],
      total: 40,
      page: opts?.page ?? 1,
      pageSize: 20,
      totalPages: 2,
    }));

    const user = userEvent.setup();
    render(<AdminNotificationsPage />);
    await screen.findByText("Annonce importante");

    await user.click(screen.getByRole("button", { name: /Page suivante/i }));

    await waitFor(() => {
      expect(lastSearchArg().page).toBe(2);
    });

    await user.type(screen.getByTestId("notifications-search-input"), "alice");

    await waitFor(
      () => {
        expect(lastSearchArg().page).toBe(1);
        expect(lastSearchArg().search).toBe("alice");
      },
      { timeout: 2000 }
    );
  });
});
