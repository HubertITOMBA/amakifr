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
import LoginForm from "@/components/auth/login-form";

const loginMock = vi.fn();
const pushMock = vi.fn();

vi.mock("@/actions/auth/login", () => ({
  login: (...args: unknown[]) => loginMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: vi.fn(),
  }),
  useSearchParams: () => ({
    get: () => null,
  }),
}));

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: null,
    status: "unauthenticated",
    update: vi.fn(),
  }),
}));

vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/components/auth/card-wrapper", () => ({
  CardWrapper: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="card-wrapper">{children}</div>
  ),
}));

vi.mock("@/components/auth/register-button", () => ({
  RegisterButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/auth/reset-button", () => ({
  ResetButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/ui/password-input", () => ({
  PasswordInput: React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
  >(function PasswordInputMock(props, ref) {
    return <input ref={ref} type="password" {...props} />;
  }),
}));

describe("LoginForm — compte non confirmé", () => {
  beforeEach(() => {
    loginMock.mockReset();
    pushMock.mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>) {
    await user.type(
      screen.getByLabelText(/email adresse/i),
      "membre@example.com",
    );
    await user.type(screen.getByLabelText(/mot de passe/i), "secret1");
    await user.click(screen.getByRole("button", { name: /^connexion$/i }));
  }

  it("provider KO → message + lien /auth/new-verification sans email, champs conservés", async () => {
    loginMock.mockResolvedValue({
      verificationRequired: true,
      deliveryFailed: true,
      message:
        "Votre compte n'est pas encore confirmé. L'envoi du code a échoué. Vous pouvez demander un nouveau code depuis la page de vérification.",
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(
        screen.getByRole("link", {
          name: /page de vérification/i,
        }),
      ).toBeTruthy();
    });

    expect(
      screen.getByText(/compte non confirmé : l'envoi du code a échoué/i),
    ).toBeTruthy();

    const link = screen.getByRole("link", {
      name: /page de vérification/i,
    });
    expect(link.getAttribute("href")).toBe("/auth/new-verification");
    expect(link.getAttribute("href")).not.toMatch(/email=/i);

    expect(
      (screen.getByLabelText(/email adresse/i) as HTMLInputElement).value,
    ).toBe("membre@example.com");
    expect(
      (screen.getByLabelText(/mot de passe/i) as HTMLInputElement).value,
    ).toBe("secret1");
    expect(pushMock).not.toHaveBeenCalledWith("/auth/new-verification");
  });

  it("cooldown → redirection vérification sans prétendre un nouvel envoi dans l'URL", async () => {
    loginMock.mockResolvedValue({
      verificationRequired: true,
      twoFactor: true,
      success:
        "Un code de confirmation a déjà été demandé récemment. Vérifiez votre e-mail ou réessayez dans une minute.",
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/auth/new-verification");
    });
    expect(pushMock.mock.calls[0][0]).not.toMatch(/email=/i);
    expect(loginMock).toHaveBeenCalledTimes(1);
  });

  it("succès envoi code → redirection /auth/new-verification sans email", async () => {
    loginMock.mockResolvedValue({
      twoFactor: true,
      success: "Code OTP envoyé !",
    });
    const user = userEvent.setup();
    render(<LoginForm />);
    await fillAndSubmit(user);

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith("/auth/new-verification");
    });
    expect(pushMock.mock.calls[0][0]).toBe("/auth/new-verification");
  });
});
