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
import { RegisterForm } from "@/components/auth/register-form";
import { RegisterFormEmbedded } from "@/components/auth/register-form-embedded";

const registerMock = vi.fn();

vi.mock("@/actions/auth/register", () => ({
  register: (...args: unknown[]) => registerMock(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("@/components/conditions", () => ({
  Conditions: () => null,
}));

vi.mock("@/components/statuamaki", () => ({
  StatuAmaki: () => null,
}));

vi.mock("@/components/forms/country-autocomplete", () => ({
  CountryAutocomplete: () => <div data-testid="country-autocomplete" />,
}));

vi.mock("@/components/forms/city-autocomplete", () => ({
  CityAutocomplete: () => <div data-testid="city-autocomplete" />,
}));

vi.mock("@/components/auth/social", () => ({
  Social: () => null,
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

async function fillRequiredFields(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText(/nom complet/i), "Jean Dupont");
  await user.type(
    screen.getByLabelText(/adresse e-mail/i),
    "nouveau@example.com",
  );
  await user.type(screen.getByLabelText(/^Mot de passe/i), "secret1");
}

describe.each([
  ["RegisterForm", RegisterForm],
  ["RegisterFormEmbedded", RegisterFormEmbedded],
] as const)("%s — consentement et bouton", (name, Component) => {
  beforeEach(() => {
    registerMock.mockReset();
    registerMock.mockResolvedValue({ success: "ok", twoFactor: true });
  });

  afterEach(() => {
    cleanup();
  });

  it("bouton utilisable hors soumission même si case non cochée", () => {
    render(<Component />);
    const button = screen.getByRole("button", { name: /créer mon compte/i });
    expect((button as HTMLButtonElement).disabled).toBe(false);
  });

  it("tentative sans consentement : erreur visible, register non appelé", async () => {
    const user = userEvent.setup();
    render(<Component />);
    await fillRequiredFields(user);
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() => {
      expect(
        screen.getByText(/vous devez accepter les conditions/i),
      ).toBeTruthy();
    });
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("case cochée + champs valides : payload acceptConditions=true", async () => {
    const user = userEvent.setup();
    render(<Component />);
    await fillRequiredFields(user);

    const checkbox = screen.getByRole("checkbox");
    await user.click(checkbox);
    await user.click(screen.getByRole("button", { name: /créer mon compte/i }));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledTimes(1);
    });
    const payload = registerMock.mock.calls[0][0];
    expect(payload.acceptConditions).toBe(true);
    expect(payload.email).toBe("nouveau@example.com");
    expect(payload.name).toBe("Jean Dupont");
  });

  it("cliquer un lien légal ne coche pas la case et n'appelle pas register", async () => {
    const user = userEvent.setup();
    render(<Component />);
    await fillRequiredFields(user);

    const checkbox = screen.getByRole("checkbox") as HTMLButtonElement;
    expect(checkbox.getAttribute("data-state") === "checked" || checkbox.checked).toBeFalsy();

    const legalLink = screen.getByRole("button", {
      name: /statut juridique/i,
    });
    expect(legalLink.getAttribute("type")).toBe("button");

    await user.click(legalLink);

    expect(checkbox.getAttribute("data-state")).not.toBe("checked");
    expect(registerMock).not.toHaveBeenCalled();
  });
});
