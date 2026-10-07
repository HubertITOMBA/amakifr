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
const toastInfo = vi.fn();

vi.mock("@/actions/auth/new-verification", () => ({
  newVerification: (...args: unknown[]) => newVerificationMock(...args),
}));

vi.mock("@/actions/auth/resend-verification-code", () => ({
  resendVerificationCode: (...args: unknown[]) => resendMock(...args),
}));

vi.mock("react-toastify", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfo(...args),
    success: vi.fn(),
    error: vi.fn(),
  },
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
});

describe("NewVerificationForm — UX champ unique", () => {
  beforeEach(() => {
    newVerificationMock.mockReset();
    resendMock.mockReset();
    toastInfo.mockReset();
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

  function codeInput() {
    return screen.getByLabelText(/code de confirmation/i) as HTMLInputElement;
  }

  it("email absent → erreur locale sur renvoi, action non appelée", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.click(screen.getByRole("button", { name: /renvoyer le code/i }));
    await waitFor(() => {
      expect(screen.getByText(/adresse e-mail valide|requis/i)).toBeTruthy();
    });
    expect(resendMock).not.toHaveBeenCalled();
  });

  it("saisie des 6 chiffres caractère par caractère → payload email + code", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    await user.type(codeInput(), "1");
    await user.type(codeInput(), "2");
    await user.type(codeInput(), "3");
    await user.type(codeInput(), "4");
    await user.type(codeInput(), "5");
    await user.type(codeInput(), "6");
    expect(codeInput().value).toBe("123456");
    await user.click(screen.getByRole("button", { name: /vérifier le code/i }));
    await waitFor(() => {
      expect(newVerificationMock).toHaveBeenCalledWith({
        email: "membre@example.com",
        code: "123456",
      });
    });
  });

  it("collage des 6 chiffres → payload inchangé", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    await user.click(codeInput());
    await user.paste("654321");
    expect(codeInput().value).toBe("654321");
    await user.click(screen.getByRole("button", { name: /vérifier le code/i }));
    await waitFor(() => {
      expect(newVerificationMock).toHaveBeenCalledWith({
        email: "membre@example.com",
        code: "654321",
      });
    });
  });

  it("filtre lettres/espaces et limite à 6 chiffres", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(codeInput(), "12ab 34xy56789");
    expect(codeInput().value).toBe("123456");
    expect(codeInput().value).toHaveLength(6);
  });

  it("helper exact et attributs accessibles du champ code", () => {
    render(<NewVerificationForm />);
    expect(
      screen.getByText(
        /saisissez ou collez le code à 6 chiffres reçu par e-mail/i,
      ),
    ).toBeTruthy();
    const input = codeInput();
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("pattern")).toBe("[0-9]*");
    expect(input.getAttribute("maxlength")).toBe("6");
    expect(input.getAttribute("autocomplete")).toBe("one-time-code");
    expect(input.getAttribute("type")).toBe("text");
  });

  it("renvoi accepté vide le code, message d'invalidation, toast non énumérant, aria-live", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    await user.type(codeInput(), "111111");
    expect(codeInput().value).toBe("111111");
    await user.click(screen.getByRole("button", { name: /renvoyer le code/i }));
    await waitFor(() => {
      expect(resendMock).toHaveBeenCalledTimes(1);
    });
    expect(codeInput().value).toBe("");
    const banner = screen.getByRole("status");
    expect(banner.getAttribute("aria-live")).toBe("polite");
    expect(banner.textContent).toMatch(/ancien code n'est plus valable/i);
    expect(toastInfo).toHaveBeenCalledWith(
      "Demande de renvoi enregistrée. Vérifiez votre boîte mail.",
      expect.objectContaining({ position: "top-center" }),
    );
    expect(JSON.stringify(toastInfo.mock.calls)).not.toMatch(/@/);
  });

  it("provider KO serveur : pas de faux message provider, bandeau non énumérant", async () => {
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
    await user.click(screen.getByRole("button", { name: /renvoyer le code/i }));
    await waitFor(() => {
      expect(screen.getByText(/ancien code n'est plus valable/i)).toBeTruthy();
    });
    expect(screen.queryByText(/envoi temporairement impossible/i)).toBeNull();
  });

  it("timer / cooldown après réponse acceptée", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    await user.click(screen.getByRole("button", { name: /renvoyer le code/i }));
    await waitFor(() => {
      expect(resendMock).toHaveBeenCalledTimes(1);
    });
    const btn = screen.getByRole("button", { name: /renvoyer dans/i });
    expect((btn as HTMLButtonElement).disabled).toBe(true);
  });

  it("erreur visible avec role=alert et message générique serveur", async () => {
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    await user.type(codeInput(), "000000");
    await user.click(screen.getByRole("button", { name: /vérifier le code/i }));
    await waitFor(() => {
      expect(newVerificationMock).toHaveBeenCalled();
    });
    const alert = screen.getByRole("alert");
    expect(alert.textContent).toBe(
      "Code invalide, expiré ou indisponible. Demandez un nouveau code.",
    );
  });

  it("après 3 erreurs : Trop de tentatives. Demandez un nouveau code.", async () => {
    newVerificationMock.mockResolvedValue({
      error: "Code invalide, expiré ou indisponible. Demandez un nouveau code.",
    });
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    const verifyBtn = screen.getByRole("button", { name: /vérifier le code/i });
    for (let i = 0; i < 3; i++) {
      await user.clear(codeInput());
      await user.type(codeInput(), "111111");
      await user.click(verifyBtn);
      await waitFor(() => {
        expect(newVerificationMock).toHaveBeenCalledTimes(i + 1);
      });
    }
    await waitFor(() => {
      expect(
        screen.getByText("Trop de tentatives. Demandez un nouveau code."),
      ).toBeTruthy();
    });
  });

  it("succès affiche l'attente administrative (aria-live)", async () => {
    newVerificationMock.mockResolvedValue({ success: "Email vérifié !" });
    const user = userEvent.setup();
    render(<NewVerificationForm />);
    await user.type(
      screen.getByLabelText(/^adresse e-mail$/i),
      "membre@example.com",
    );
    await user.type(codeInput(), "123456");
    await user.click(screen.getByRole("button", { name: /vérifier le code/i }));
    await waitFor(() => {
      const status = screen.getByRole("status");
      expect(status.getAttribute("aria-live")).toBe("polite");
      expect(status.textContent).toMatch(
        /email confirmé\. votre adhésion attend maintenant la validation d'un administrateur/i,
      );
    });
  });

  it("aucun email dans l'URL et pas de console.log du code", async () => {
    render(<NewVerificationForm />);
    expect(window.location.search).not.toMatch(/email=/i);
    expect(console.log).not.toHaveBeenCalled();
  });
});
