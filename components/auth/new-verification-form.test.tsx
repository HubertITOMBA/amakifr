/**
 * @vitest-environment jsdom
 */
import React from "react";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NewVerificationForm } from "@/components/auth/new-verification-form";

const newVerificationMock = vi.fn();
const resendMock = vi.fn();

vi.mock("@/actions/auth/new-verification", () => ({
  newVerification: (...args: unknown[]) => newVerificationMock(...args),
}));

vi.mock("@/actions/auth/resend-verification-code", () => ({
  resendVerificationCode: (...args: unknown[]) => resendMock(...args),
}));

vi.mock("@/components/auth/login-button", () => ({
  LoginButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/auth/card-wrapper", () => ({
  CardWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-wrapper">{children}</div>
  ),
}));

beforeAll(() => {
  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", ResizeObserverMock);
  if (typeof document !== "undefined") {
    document.elementFromPoint = () => null;
  }
});

describe("NewVerificationForm — email unifié", () => {
  beforeEach(() => {
    newVerificationMock.mockReset();
    resendMock.mockReset();
    resendMock.mockResolvedValue({
      accepted: true,
      message:
        "Si un compte non confirmé correspond à cette adresse, un nouveau code sera envoyé.",
      retryAfter: 60,
    });
    newVerificationMock.mockResolvedValue({
      error: "Code invalide, expiré ou indisponible. Demandez un nouveau code.",
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("email absent → erreur locale sur renvoi, action non appelée", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.click(
      screen.getByRole("button", { name: /renvoyer le code/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/adresse e-mail valide|requis/i),
      ).toBeTruthy();
    });
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("renvoi avec l'email unique (sans code)", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: /renvoyer le code/i }),
    );
    await waitFor(() => {
      expect(resendMock).toHaveBeenCalledTimes(1);
    });
    expect(resendMock.mock.calls[0][0]).toEqual({
      email: "membre@example.com",
    });
  });

  it("vérification envoie email + code ensemble", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    const verifyBtn = screen.getByRole("button", { name: /vérifier le code/i });
    const hiddenOtp = document.querySelector(
      "input[maxlength='6'], input[autocomplete='one-time-code']",
    ) as HTMLInputElement | null;
    expect(hiddenOtp).toBeTruthy();
    await user.type(hiddenOtp!, "123456");
    await user.click(verifyBtn);
    await waitFor(() => {
      expect(newVerificationMock).toHaveBeenCalled();
    });
    expect(newVerificationMock.mock.calls[0][0]).toEqual({
      email: "membre@example.com",
      code: "123456",
    });
  });

  it("affiche le message générique après acceptation du renvoi", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: /renvoyer le code/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/si un compte non confirmé correspond/i),
      ).toBeTruthy();
    });
  });

  it("provider KO côté serveur : message générique (anti-énumération)", async () => {
    resendMock.mockResolvedValue({
      accepted: true,
      message:
        "Si un compte non confirmé correspond à cette adresse, un nouveau code sera envoyé.",
      retryAfter: 60,
    });
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: /renvoyer le code/i }),
    );
    await waitFor(() => {
      expect(
        screen.getByText(/si un compte non confirmé correspond/i),
      ).toBeTruthy();
    });
    expect(
      screen.queryByText(/envoi temporairement impossible/i),
    ).toBeNull();
  });

  it("timer / cooldown après réponse acceptée empêche un second clic immédiat", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    await user.click(
      screen.getByRole("button", { name: /renvoyer le code/i }),
    );
    await waitFor(() => {
      expect(resendMock).toHaveBeenCalledTimes(1);
    });
    const btn = screen.getByRole("button", { name: /renvoyer dans/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("aucun email dans l'URL et pas de console.log du code", async () => {
    render(<NewVerificationForm />);
    expect(window.location.search).not.toMatch(/email=/i);
    expect(console.log).not.toHaveBeenCalled();
  });

  it("après 3 erreurs génériques, guide vers le renvoi", async () => {
    newVerificationMock.mockResolvedValue({
      error: "Code invalide, expiré ou indisponible. Demandez un nouveau code.",
    });
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    const hiddenOtp = document.querySelector(
      "input[maxlength='6'], input[autocomplete='one-time-code']",
    ) as HTMLInputElement | null;
    const verifyBtn = screen.getByRole("button", { name: /vérifier le code/i });

    if (hiddenOtp) {
      for (let i = 0; i < 3; i++) {
        await user.clear(hiddenOtp);
        await user.type(hiddenOtp, "111111");
        await user.click(verifyBtn);
        await waitFor(() => {
          expect(newVerificationMock).toHaveBeenCalledTimes(i + 1);
        });
      }
      await waitFor(() => {
        expect(
          screen.getByText(/demandez un nouveau code via le bouton/i),
        ).toBeTruthy();
      });
    }
  });
});
