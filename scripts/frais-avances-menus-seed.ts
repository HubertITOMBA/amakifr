import { PrismaClient } from "@prisma/client";
import { upsertFraisAvancesMenusIdempotent } from "./frais-avances-menus-upsert";

async function main(): Promise<void> {
  const prisma = new PrismaClient({ log: ["error", "warn"] });

  try {
    await prisma.$connect();
    const result = await upsertFraisAvancesMenusIdempotent(prisma);
    console.log(
      `Menus frais-avances alignés : created=${result.created} updated=${result.updated}`
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Erreur inconnue";
  console.error(`Échec seed menus frais-avances : ${message}`);
  process.exitCode = 1;
});
