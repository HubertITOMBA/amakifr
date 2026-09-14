/**
 * @vitest-environment jsdom
 *
 * Dialog de création notifications — design + payload createNotifications.
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
  UserMultiSelectComboboxWithFilters: ({
    value,
    onValueChange,
  }: {
    value?: string[];
    onValueChange: (v: string[]) => void;
  }) => (
    <button
      type="button"
      data-testid="mock-user-multiselect"
      onClick={() => onValueChange(["u1", "u2"])}
    >
      Sélection mock ({value?.length ?? 0})
    </button>
  ),
}));

import AdminNotificationsPage from "@/app/admin/notifications/page";

describe("AdminNotificationsPage — Dialog création", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAllUsersForAdmin.mockResolvedValue({
      success: true,
      users: [
        {
          id: "u1",
          adherent: { id: "a1", firstname: "A", lastname: "B" },
        },
        {
          id: "u2",
          adherent: { id: "a2", firstname: "C", lastname: "D" },
        },
      ],
    });
    getAdminNotificationsPage.mockResolvedValue({
      success: true,
      notifications: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    createNotifications.mockResolvedValue({
      success: true,
      message: "2 notification(s) créée(s)",
      count: 2,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("affiche header dégradé, description, sections et footer", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationsPage />);

    await user.click(
      await screen.findByRole("button", { name: /Créer une notification/i })
    );

    const dialog = await screen.findByRole("dialog");
    expect(dialog.querySelector(".bg-gradient-to-r")).toBeTruthy();
    expect(
      within(dialog).getByText(
        /Envoyez la notification à un ou plusieurs adhérents\./i
      )
    ).toBeTruthy();
    expect(within(dialog).getByText(/Recherchez et sélectionnez les adhérents/i)).toBeTruthy();
    expect(
      within(dialog).queryByText(/Le message sera visible dans l’application/i)
    ).toBeNull();
    expect(
      within(dialog).getByText(/Facultatif — route interne ou URL HTTPS/i)
    ).toBeTruthy();
    expect(within(dialog).getByTestId("create-notification-recipients")).toBeTruthy();
    expect(within(dialog).getByTestId("create-notification-content")).toBeTruthy();
    expect(within(dialog).getByTestId("create-notification-footer")).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^Annuler$/i })).toBeTruthy();
    expect(within(dialog).getByRole("button", { name: /^Envoyer$/i })).toBeTruthy();
    expect(within(dialog).getByLabelText(/Titre/i)).toBeTruthy();
    expect(within(dialog).getByLabelText(/Message/i)).toBeTruthy();
    expect(within(dialog).getByLabelText(/^Lien$/i)).toBeTruthy();
  });

  it("soumet createNotifications avec le payload attendu (un seul appel)", async () => {
    const user = userEvent.setup();
    render(<AdminNotificationsPage />);

    await user.click(
      await screen.findByRole("button", { name: /Créer une notification/i })
    );
    const dialog = await screen.findByRole("dialog");

    await user.click(within(dialog).getByTestId("mock-user-multiselect"));
    await user.type(within(dialog).getByLabelText(/Titre/i), "Annonce test");
    await user.type(
      within(dialog).getByLabelText(/Message/i),
      "Contenu de test"
    );

    await user.click(within(dialog).getByRole("button", { name: /^Envoyer$/i }));

    await waitFor(() => {
      expect(createNotifications).toHaveBeenCalledTimes(1);
    });

    expect(createNotifications).toHaveBeenCalledWith({
      userIds: ["u1", "u2"],
      type: TypeNotification.Systeme,
      titre: "Annonce test",
      message: "Contenu de test",
      lien: undefined,
    });
  });

  it("ne double pas l'envoi pendant le loading", async () => {
    let resolveCreate: (v: unknown) => void = () => {};
    createNotifications.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
    );

    const user = userEvent.setup();
    render(<AdminNotificationsPage />);

    await user.click(
      await screen.findByRole("button", { name: /Créer une notification/i })
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByTestId("mock-user-multiselect"));
    await user.type(within(dialog).getByLabelText(/Titre/i), "T");
    await user.type(within(dialog).getByLabelText(/Message/i), "M");

    const sendBtn = within(dialog).getByRole("button", { name: /^Envoyer$/i });
    await user.click(sendBtn);

    await waitFor(() => {
      expect((sendBtn as HTMLButtonElement).disabled).toBe(true);
    });

    await user.click(sendBtn);
    expect(createNotifications).toHaveBeenCalledTimes(1);

    resolveCreate({ success: true, message: "ok", count: 2 });
    await waitFor(() => {
      expect(createNotifications).toHaveBeenCalledTimes(1);
    });
  });
});
