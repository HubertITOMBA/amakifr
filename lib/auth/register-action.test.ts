import { beforeEach, describe, expect, it, vi } from "vitest";

const createUser = vi.fn();
const createAdherent = vi.fn();
const getUserByEmail = vi.fn();
const getUserByName = vi.fn();
const hash = vi.fn(async () => "hashed");

vi.mock("@/lib/db", () => ({
  db: {
    user: { create: (...args: unknown[]) => createUser(...args) },
    adherent: { create: (...args: unknown[]) => createAdherent(...args) },
  },
}));

/**
 * actions/auth/register.ts importe getUserByEmail / getUserByName via `from "."`,
 * résolu vers actions/auth/index (barrel). On mocke ce module exact, pas un alias
 * distinct qui pourrait laisser passer un faux positif.
 */
vi.mock("@/actions/auth/index", () => ({
  getUserByEmail: (...args: unknown[]) => getUserByEmail(...args),
  getUserByName: (...args: unknown[]) => getUserByName(...args),
}));

vi.mock("@/lib/mail", () => ({
  sendTwoFactorTokenEmail: vi.fn(async () => true),
  sendNewUserNotificationEmail: vi.fn(async () => undefined),
  sendUserRegistrationThankYouEmail: vi.fn(async () => undefined),
}));

vi.mock("@/lib/token", () => ({
  generateVerificationToken: vi.fn(async () => ({
    email: "nouveau@example.com",
    token: "123456",
  })),
}));

vi.mock("bcryptjs", () => ({
  default: { hash: (...args: unknown[]) => hash(...args) },
  hash: (...args: unknown[]) => hash(...args),
}));

import { register } from "@/actions/auth/register";

function expectNoSideEffects() {
  expect(hash).not.toHaveBeenCalled();
  expect(getUserByEmail).not.toHaveBeenCalled();
  expect(getUserByName).not.toHaveBeenCalled();
  expect(createUser).not.toHaveBeenCalled();
  expect(createAdherent).not.toHaveBeenCalled();
}

describe("register action — consentement", () => {
  beforeEach(() => {
    createUser.mockReset();
    createAdherent.mockReset();
    getUserByEmail.mockReset();
    getUserByName.mockReset();
    hash.mockReset();
    hash.mockResolvedValue("hashed");
  });

  it("refuse l'absence de acceptConditions avant bcrypt / DB / lookups", async () => {
    const result = await register({
      email: "nouveau@example.com",
      password: "secret1",
      name: "Jean Dupont",
    } as Parameters<typeof register>[0]);

    expect(result.error).toMatch(/accepter les conditions/i);
    expectNoSideEffects();
  });

  it("refuse acceptConditions=false avant bcrypt / DB / lookups", async () => {
    const result = await register({
      email: "nouveau@example.com",
      password: "secret1",
      name: "Jean Dupont",
      acceptConditions: false,
    });

    expect(result.error).toMatch(/accepter les conditions/i);
    expectNoSideEffects();
  });

  it("avec consentement valide, le mock getUserByEmail du barrel est bien branché", async () => {
    getUserByEmail.mockResolvedValue({ id: "existing" });

    const result = await register({
      email: "nouveau@example.com",
      password: "secret1",
      name: "Jean Dupont",
      acceptConditions: true,
    });

    expect(hash).toHaveBeenCalled();
    expect(getUserByEmail).toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
    expect(createAdherent).not.toHaveBeenCalled();
    expect(result.error).toMatch(/email est déjà utilisé/i);
  });
});
