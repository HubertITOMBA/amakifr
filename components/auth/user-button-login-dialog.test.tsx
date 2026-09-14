/**
 * @vitest-environment jsdom
 *
 * Intégration UserButton : fermeture DropdownMenu avant Dialog connexion,
 * pour éviter le conflit de focus/pointer Radix.
 */
import React from "react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { cleanup, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { UserButton } from "@/components/auth/user-button"
import { LoginButton } from "@/components/auth/login-button"

type SessionStatus = "authenticated" | "unauthenticated" | "loading"

const sessionState: {
  status: SessionStatus
  data: null | {
    user: { name: string; email: string; role: string }
  }
} = {
  status: "unauthenticated",
  data: null,
}

vi.mock("@/actions/auth/login", () => ({
  login: vi.fn(async () => ({ error: "Identifiants invalides" })),
}))

vi.mock("@/actions/user", () => ({
  changePassword: vi.fn(async () => ({ success: true, message: "ok" })),
}))

vi.mock("@/actions/user/request-password-reset", () => ({
  requestPasswordReset: vi.fn(),
}))

vi.mock("@/auth", () => ({
  auth: vi.fn(),
}))

vi.mock("@/components/user/ForgotPasswordDialog", () => ({
  ForgotPasswordDialog: () => null,
}))

vi.mock("@/components/auth/card-wrapper", () => ({
  CardWrapper: ({
    children,
    labelBox,
  }: {
    children: React.ReactNode
    labelBox?: string
  }) => (
    <div data-testid="card-wrapper">
      {labelBox ? <h2>{labelBox}</h2> : null}
      {children}
    </div>
  ),
}))

vi.mock("react-toastify", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: sessionState.data,
    status: sessionState.status,
    update: vi.fn(),
  }),
}))

vi.mock("@/hooks/use-session-update", () => ({
  useSessionUpdate: () => ({ forceUpdate: vi.fn() }),
}))

vi.mock("@/hooks/use-user-profile", () => ({
  useUserProfile: () => ({ userProfile: null }),
}))

vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => sessionState.data?.user ?? null,
}))

vi.mock("@/components/pwa/usePwaInstallPrompt", () => ({
  usePwaInstallPrompt: () => ({
    canInstall: false,
    isInstalled: true,
    isIOS: false,
    install: vi.fn(),
  }),
}))

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }),
  usePathname: () => "/",
}))

vi.mock("@/components/auth/register-button", () => ({
  RegisterButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/auth/reset-button", () => ({
  ResetButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("@/components/auth/social", () => ({
  Social: () => null,
}))

vi.mock("@/components/auth/logout-button", () => ({
  LogoutButton: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}))

vi.mock("next/link", () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

function inputValue(el: HTMLElement) {
  return (el as HTMLInputElement).value
}

async function openLoginFromAvatar(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByLabelText("Menu utilisateur"))
  expect(await screen.findByRole("menu")).toBeTruthy()
  await user.click(screen.getByRole("menuitem", { name: /Connexion/i }))
}

describe("UserButton — Dialog connexion hors DropdownMenu", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionState.status = "unauthenticated"
    sessionState.data = null
  })

  afterEach(() => {
    cleanup()
  })

  it("ferme le menu puis affiche la Dialog (pas de double overlay)", async () => {
    const user = userEvent.setup()
    render(<UserButton />)

    await openLoginFromAvatar(user)

    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull()
    })
    expect(
      document.querySelector('[data-slot="dropdown-menu-content"]')
    ).toBeNull()

    const dialog = await screen.findByRole("dialog")
    expect(dialog).toBeTruthy()
    expect(
      within(dialog).getByRole("button", { name: /^Connexion$/i })
    ).toBeTruthy()
  })

  it("place le focus dans le formulaire et conserve la saisie malgré un mouvement souris", async () => {
    const user = userEvent.setup()
    render(<UserButton />)

    await openLoginFromAvatar(user)

    const dialog = await screen.findByRole("dialog")
    const email = within(dialog).getByRole("textbox")

    await waitFor(() => {
      expect(dialog.contains(document.activeElement)).toBe(true)
    })

    await user.clear(email)
    await user.type(email, "hubert@example.com")
    expect(inputValue(email)).toBe("hubert@example.com")

    await user.pointer({
      keys: "[MouseLeft>]",
      target: dialog,
      coords: { x: 10, y: 10 },
    })
    await user.pointer({ keys: "[/MouseLeft]" })

    expect(inputValue(email)).toBe("hubert@example.com")
    expect(screen.queryByRole("menu")).toBeNull()
  })

  it("ferme la Dialog sans rouvrir le menu", async () => {
    const user = userEvent.setup()
    render(<UserButton />)

    await openLoginFromAvatar(user)
    await screen.findByRole("dialog")

    await user.keyboard("{Escape}")

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull()
    })
    expect(screen.queryByRole("menu")).toBeNull()
  })
})

describe("LoginButton modal hors dropdown (Hero)", () => {
  afterEach(() => {
    cleanup()
  })

  it("ouvre la Dialog via le trigger sans DropdownMenu", async () => {
    const user = userEvent.setup()
    render(
      <LoginButton mode="modal">
        <button type="button">Se connecter</button>
      </LoginButton>
    )

    expect(screen.queryByRole("dialog")).toBeNull()
    await user.click(screen.getByRole("button", { name: /Se connecter/i }))

    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("textbox")).toBeTruthy()
    expect(screen.queryByRole("menu")).toBeNull()
  })
})

describe("ChangePasswordDialog — architecture sœur (authenticated)", () => {
  beforeEach(() => {
    sessionState.status = "authenticated"
    sessionState.data = {
      user: {
        name: "Hubert",
        email: "hubert@example.com",
        role: "MEMBRE",
      },
    }
  })

  afterEach(() => {
    cleanup()
    sessionState.status = "unauthenticated"
    sessionState.data = null
  })

  it("ouvre le changement de mot de passe sans menu actif", async () => {
    const user = userEvent.setup()
    render(<UserButton />)

    await user.click(screen.getByLabelText("Menu utilisateur"))
    await user.click(
      await screen.findByRole("menuitem", { name: /Changer le mot de passe/i })
    )

    await waitFor(() => {
      expect(screen.queryByRole("menu")).toBeNull()
    })
    expect(
      document.querySelector('[data-slot="dropdown-menu-content"]')
    ).toBeNull()

    const dialog = await screen.findByRole("dialog")
    expect(
      within(dialog).getByRole("heading", { name: /Changer le mot de passe/i })
    ).toBeTruthy()
  })
})

describe("Page /auth/sign-in", () => {
  it("reste une page dédiée LoginForm (non modifiée par ce correctif)", async () => {
    const fs = await import("node:fs/promises")
    const path = await import("node:path")
    const pagePath = path.join(
      process.cwd(),
      "app/(auth)/auth/sign-in/page.tsx"
    )
    const source = await fs.readFile(pagePath, "utf8")
    expect(source).toContain("LoginForm")
    expect(source).not.toContain("UserButton")
    expect(source).not.toContain("DropdownMenu")
  })
})
