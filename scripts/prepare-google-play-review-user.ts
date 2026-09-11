/**
 * Prépare le compte Google Play Review en base (création ou mise à jour idempotente).
 *
 * Usage (VPS production) :
 *   cd /sites/amakifr
 *   set -a && source .env && set +a
 *   GOOGLE_REVIEW_PASSWORD='…' npx tsx scripts/prepare-google-play-review-user.ts
 *
 * Le mot de passe ne doit jamais être commité : uniquement via GOOGLE_REVIEW_PASSWORD.
 */

import bcrypt from "bcryptjs";
import { UserRole, UserStatus } from "@prisma/client";
import { db } from "@/lib/db";

const REVIEW_EMAIL = "google-review@amaki.fr";
const REVIEW_NAME = "Google Play Review";
/** Aligné sur register / change-password / admin-create-adherent */
const BCRYPT_ROUNDS = 10;

/**
 * Crée ou met à jour uniquement l'utilisateur google-review@amaki.fr.
 * Ne touche aucun autre compte.
 */
async function prepareGooglePlayReviewUser(): Promise<void> {
  const plainPassword = process.env.GOOGLE_REVIEW_PASSWORD?.trim();

  if (!plainPassword) {
    throw new Error(
      "GOOGLE_REVIEW_PASSWORD est absent. Définissez cette variable d'environnement (mot de passe en clair non stocké dans le code)."
    );
  }

  const hashedPassword = await bcrypt.hash(plainPassword, BCRYPT_ROUNDS);
  const emailVerified = new Date();

  const existing = await db.user.findUnique({
    where: { email: REVIEW_EMAIL },
    select: { id: true, email: true },
  });

  if (existing) {
    await db.user.update({
      where: { id: existing.id },
      data: {
        password: hashedPassword,
        role: UserRole.MEMBRE,
        status: UserStatus.Actif,
        emailVerified,
      },
    });
    console.log(
      `✅ Compte Google Play Review mis à jour (email=${REVIEW_EMAIL}, rôle=MEMBRE, statut=Actif, emailVerified=oui).`
    );
    return;
  }

  await db.user.create({
    data: {
      email: REVIEW_EMAIL,
      name: REVIEW_NAME,
      password: hashedPassword,
      role: UserRole.MEMBRE,
      status: UserStatus.Actif,
      emailVerified,
    },
  });

  console.log(
    `✅ Compte Google Play Review créé (email=${REVIEW_EMAIL}, rôle=MEMBRE, statut=Actif, emailVerified=oui).`
  );
}

prepareGooglePlayReviewUser()
  .then(async () => {
    await db.$disconnect();
    process.exit(0);
  })
  .catch(async (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`❌ Échec préparation compte Google Play Review : ${message}`);
    try {
      await db.$disconnect();
    } catch {
      // ignore
    }
    process.exit(1);
  });
