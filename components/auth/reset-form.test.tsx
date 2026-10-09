/**
 * @vitest-environment jsdom
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
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PASSWORD_RESET_REQUEST_MESSAGE } from "@/lib/auth/password-reset-messages";

const resetMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@/actions/auth/reset", () => ({
  reset: (...args: unknown[]) => resetMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: vi.fn(),
  }),
  usePathname: () => "/auth/reset",
}));

vi.mock("@/components/auth/card-wrapper", () => ({
  CardWrapper: ({
    children,
    backButtonComponent,
  }: {
    children: React.ReactNode;
    backButtonComponent?: React.ReactNode;
  }) => (
    <div data-testid="card-wrapper">
      {children}
      <div data-testid="card-footer">{backButtonComponent}</div>
    </div>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  DialogClose: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { ResetForm } from "@/components/auth/reset-form";

describe("ResetForm — accès saisie code", () => {
  beforeEach(() => {
    resetMock.mockReset();
    pushMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it("succès request → router.push(/auth/new-password) une seule fois, sans query", async () => {
    resetMock.mockResolvedValue({ success: PASSWORD_RESET_REQUEST_MESSAGE });
    const user = userEvent.setup();
    render(<ResetForm />);

    await user.type(
      screen.getByLabelText(/adresse e-mail/i),
      "membre@example.com"
    );
    await user.click(
      screen.getByRole("button", {
        name: /envoyer un code de réinitialisation/i,
      })
    );

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1);
    });
    expect(pushMock).toHaveBeenCalledWith("/auth/new-password");
    const dest = pushMock.mock.calls[0][0] as string;
    expect(dest).not.toMatch(/[?=&#]/);
    expect(dest).not.toMatch(/email|code|token/i);
    expect(resetMock).toHaveBeenCalledTimes(1);
  });

  it("erreur → aucune navigation et message visible", async () => {
    resetMock.mockResolvedValue({ error: "Champs invalides !" });
    const user = userEvent.setup();
    render(<ResetForm />);

    await user.type(
      screen.getByLabelText(/adresse e-mail/i),
      "membre@example.com"
    );
    await user.click(
      screen.getByRole("button", {
        name: /envoyer un code de réinitialisation/i,
      })
    );

    await waitFor(() => {
      expect(screen.getByText(/champs invalides/i)).toBeTruthy();
    });
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("double activation pendant pending → un seul appel action", async () => {
    let resolveReset: (v: { success: string }) => void = () => {};
    resetMock.mockImplementation(
      () =>
        new Promise<{ success: string }>((resolve) => {
          resolveReset = resolve;
        })
    );
    const user = userEvent.setup();
    render(<ResetForm />);

    await user.type(
      screen.getByLabelText(/adresse e-mail/i),
      "membre@example.com"
    );
    const submit = screen.getByRole("button", {
      name: /envoyer un code de réinitialisation/i,
    });
    await user.click(submit);
    await user.click(submit);
    await user.click(submit);

    expect(resetMock).toHaveBeenCalledTimes(1);

    resolveReset({ success: PASSWORD_RESET_REQUEST_MESSAGE });
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledTimes(1);
    });
  });

  it("lien « J’ai déjà un code » présent avec le bon href", () => {
    render(<ResetForm />);
    const link = screen.getByRole("link", {
      name: /j’ai déjà un code/i,
    });
    expect(link.getAttribute("href")).toBe("/auth/new-password");
    expect(link.getAttribute("href")).not.toMatch(/[?=&#]/);
  });

  it("conserve Retour à la connexion", () => {
    render(<ResetForm />);
    expect(
      screen.getByRole("link", { name: /retour à la connexion/i })
    ).toBeTruthy();
  });
});
