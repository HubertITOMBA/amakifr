import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const badgesConnexion = [
  {
    nom: "Première visite",
    description: "Première connexion au portail AMAKI France",
    icone: "LogIn",
    couleur: "slate",
    condition: JSON.stringify({ type: "nombre_connexions", valeur: 1 }),
    ordre: 10,
  },
  {
    nom: "Explorateur",
    description: "5 connexions au portail — vous découvrez les services en ligne",
    icone: "Compass",
    couleur: "blue",
    condition: JSON.stringify({ type: "nombre_connexions", valeur: 5 }),
    ordre: 11,
  },
  {
    nom: "Habitué",
    description: "15 connexions au portail — vous consultez régulièrement le site",
    icone: "TrendingUp",
    couleur: "green",
    condition: JSON.stringify({ type: "nombre_connexions", valeur: 15 }),
    ordre: 12,
  },
  {
    nom: "Ambassadeur",
    description: "30 connexions au portail — ambassadeur du site auprès des membres",
    icone: "Megaphone",
    couleur: "purple",
    condition: JSON.stringify({ type: "nombre_connexions", valeur: 30 }),
    ordre: 13,
  },
  {
    nom: "Champion du portail",
    description: "50 connexions au portail — champion de l'utilisation du site",
    icone: "Trophy",
    couleur: "gold",
    condition: JSON.stringify({ type: "nombre_connexions", valeur: 50 }),
    ordre: 14,
  },
];

async function main() {
  console.log("🌱 Création des badges de connexion au portail...");

  for (const badge of badgesConnexion) {
    const existing = await prisma.badge.findFirst({
      where: { nom: badge.nom },
    });

    if (existing) {
      await prisma.badge.update({
        where: { id: existing.id },
        data: {
          ...badge,
          type: "Automatique",
          actif: true,
        },
      });
      console.log(`♻️  Badge "${badge.nom}" mis à jour`);
      continue;
    }

    await prisma.badge.create({
      data: {
        ...badge,
        type: "Automatique",
        actif: true,
      },
    });
    console.log(`✅ Badge "${badge.nom}" créé`);
  }

  console.log("✨ Badges de connexion prêts.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
