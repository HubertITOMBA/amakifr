/**
 * @vitest-environment jsdom
 */
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import OnboardingPage from "@/app/(auth)/auth/onboarding/page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({
      children,
      ...props
    }: React.HTMLAttributes<HTMLDivElement> & {
      children?: React.ReactNode;
    }) => <div {...props}>{children}</div>,
  },
}));

describe("Onboarding — attente activation admin", () => {
  afterEach(() => {
    cleanup();
  });

  it("explique l'attente administrative et la notification par e-mail", () => {
    render(<OnboardingPage />);

    expect(screen.getByText("Email confirmé")).toBeTruthy();
    expect(
      screen.getByText(
        /Votre adresse e-mail est confirmée\. Votre adhésion doit maintenant être validée par un administrateur\./,
      ),
    ).toBeTruthy();
    expect(
      screen.getByText(
        /Vous recevrez un e-mail dès que votre compte aura été activé\. Vous pourrez ensuite vous connecter et accéder à votre espace membre\./,
      ),
    ).toBeTruthy();
    expect(screen.getByRole("button", { name: /retour à l'accueil/i })).toBeTruthy();
  });

  it("n'affirme pas un compte actif ni un parcours profil", () => {
    const { container } = render(<OnboardingPage />);
    const body = document.body.textContent || "";
    const html = container.innerHTML;

    expect(body).not.toMatch(/compte actif/i);
    expect(body).not.toMatch(/maintenant actif/i);
    expect(body).not.toMatch(/compléter mon profil/i);
    expect(body).not.toMatch(/préparer votre profil/i);
    expect(html).not.toMatch(/\/user\/complete-profile/);
    expect(html).not.toMatch(/\/user\/profile/);
  });
});
