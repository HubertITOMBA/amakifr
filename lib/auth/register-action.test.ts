import { beforeEach, describe, expect, it, vi } from "vitest";

const createUser = vi.fn();
const createAdherent = vi.fn();
const getUserByEmail = vi.fn();
const getUserByName = vi.fn();
const hash = vi.fn(async () => "hashed");
const sendTwoFactorTokenEmail = vi.fn(async () => true);
const generateVerificationToken = vi.fn(async () => ({
  status: "created" as const,
  token: {
    id: "tok-1",
    email: "nouveau@example.com",
    token: "123456",
    expires: new Date(Date.now() + 300_000),
    createdAt: new Date(),
    failedAttempts: 0,
    lockedAt: null,
  },
}));

vi.mock("@/lib/db", () => ({
  db: {
    user: { create: (...args: unknown[]) => createUser(...args) },
    adherent: { create: (...args: unknown[]) => createAdherent(...args) },
  },
}));

vi.mock("@/actions/auth/index", () => ({
  getUserByEmail: (...args: unknown[]) => getUserByEmail(...args),
  getUserByName: (...args: unknown[]) => getUserByName(...args),
}));

vi.mock("@/lib/mail", () => ({
  sendTwoFactorTokenEmail: (...args: unknown[]) =>
    sendTwoFactorTokenEmail(...args),
  sendNewUserNotificationEmail: vi.fn(async () => undefined),
  sendUserRegistrationThankYouEmail: vi.fn(async () => undefined),
}));

vi.mock("@/lib/token", () => ({
  generateVerificationToken: (...args: unknown[]) =>
    generateVerificationToken(...args),
  VERIFICATION_TOKEN_TTL_MS: 300_000,
  VERIFICATION_RESEND_COOLDOWN_MS: 60_000,
  PASSWORD_RESET_TOKEN_TTL_MS: 300_000,
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

const validPayload = {
  email: "nouveau@example.com",
  password: "secret1",
  name: "Jean Dupont",
  acceptConditions: true as const,
};

describe("register action — consentement", () => {
  beforeEach(() => {
    createUser.mockReset();
    createAdherent.mockReset();
    getUserByEmail.mockReset();
    getUserByName.mockReset();
    hash.mockReset();
    hash.mockResolvedValue("hashed");
    sendTwoFactorTokenEmail.mockReset();
    sendTwoFactorTokenEmail.mockResolvedValue(true);
    generateVerificationToken.mockClear();
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

    const result = await register(validPayload);

    expect(hash).toHaveBeenCalled();
    expect(getUserByEmail).toHaveBeenCalled();
    expect(createUser).not.toHaveBeenCalled();
    expect(createAdherent).not.toHaveBeenCalled();
    expect(result.error).toMatch(/email est déjà utilisé/i);
  });
});

describe("register action — livraison email confirmation", () => {
  beforeEach(() => {
    createUser.mockReset();
    createAdherent.mockReset();
    getUserByEmail.mockReset();
    getUserByName.mockReset();
    hash.mockReset();
    hash.mockResolvedValue("hashed");
    sendTwoFactorTokenEmail.mockReset();
    generateVerificationToken.mockClear();
    getUserByEmail.mockResolvedValue(null);
    getUserByName.mockResolvedValue(null);
    createUser.mockResolvedValue({ id: "u-new", email: "nouveau@example.com" });
    createAdherent.mockResolvedValue({});
  });

  it("email envoyé → succès twoFactor, sans code/token dans le retour", async () => {
    sendTwoFactorTokenEmail.mockResolvedValue(true);

    const result = await register(validPayload);

    expect(createUser).toHaveBeenCalled();
    expect(sendTwoFactorTokenEmail).toHaveBeenCalled();
    expect(result).toMatchObject({
      success: expect.any(String),
      twoFactor: true,
    });
    expect(result).not.toHaveProperty("deliveryFailed");
    expect(JSON.stringify(result)).not.toMatch(/123456/);
    expect(JSON.stringify(result)).not.toMatch(/token/i);
  });

  it("email échoué → verificationRequired/deliveryFailed, compte conservé", async () => {
    sendTwoFactorTokenEmail.mockResolvedValue(false);

    const result = await register(validPayload);

    expect(createUser).toHaveBeenCalled();
    expect(result).toMatchObject({
      verificationRequired: true,
      deliveryFailed: true,
    });
    expect(result).not.toHaveProperty("twoFactor");
    expect(JSON.stringify(result)).not.toMatch(/123456/);
  });
});
