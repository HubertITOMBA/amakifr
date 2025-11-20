import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const badgesParDefaut = [
  {
    nom: "Premier Pas",
    description: "Vous avez complété votre inscription et vos informations d'adhérent",
    icone: "UserPlus",
    couleur: "blue",
    type: "Automatique" as const,
    condition: JSON.stringify({ type: "premiere_cotisation" }),
    actif: true,
    ordre: 1,
  },
  {
    nom: "Cotisant",
    description: "Vous avez payé votre première cotisation",
    icone: "Euro",
    couleur: "green",
    type: "Automatique" as const,
    condition: JSON.stringify({ type: "premiere_cotisation" }),
    actif: true,
    ordre: 2,
  },
  {
    nom: "Actif",
    description: "Vous avez payé 3 cotisations consécutives",
    icone: "TrendingUp",
    couleur: "purple",
    type: "Automatique" as const,
    condition: JSON.stringify({ type: "cotisant_actif" }),
    actif: true,
    ordre: 3,
  },
  {
    nom: "Événement",
    description: "Vous avez participé à un événement de l'association",
    icone: "Calendar",
    couleur: "orange",
    type: "Automatique" as const,
    condition: JSON.stringify({ type: "participation_evenement" }),
    actif: true,
    ordre: 4,
  },
  {
    nom: "Idée",
    description: "Vous avez proposé une idée qui a été validée",
    icone: "Lightbulb",
    couleur: "yellow",
    type: "Automatique" as const,
    condition: JSON.stringify({ type: "idee_validee" }),
    actif: true,
    ordre: 5,
  },
  {
    nom: "Voteur",
    description: "Vous avez participé à un vote de l'association",
    icone: "CheckCircle",
    couleur: "indigo",
    type: "Automatique" as const,
    condition: JSON.stringify({ type: "participation_vote" }),
    actif: true,
    ordre: 6,
  },
  {
    nom: "Ancien",
    description: "Membre de l'association depuis 1 an",
    icone: "Clock",
    couleur: "slate",
    type: "Automatique" as const,
    condition: JSON.stringify({ type: "anciennete", valeur: 1 }),
    actif: true,
    ordre: 7,
  },
  {
    nom: "Fidèle",
    description: "Membre de l'association depuis 3 ans",
    icone: "Award",
    couleur: "gold",
    type: "Automatique" as const,
    condition: JSON.stringify({ type: "fidélite" }),
    actif: true,
    ordre: 8,
  },
];

async function main() {
  console.log("🌱 Création des badges par défaut...");

  for (const badge of badgesParDefaut) {
    try {
      // Vérifier si le badge existe déjà
      const existing = await prisma.badge.findFirst({
        where: { nom: badge.nom },
      });

      if (existing) {
        console.log(`⏭️  Badge "${badge.nom}" existe déjà, ignoré`);
        continue;
      }

      await prisma.badge.create({
        data: badge,
      });

      console.log(`✅ Badge "${badge.nom}" créé`);
    } catch (error) {
      console.error(`❌ Erreur lors de la création du badge "${badge.nom}":`, error);
    }
  }

  console.log("✨ Création des badges terminée !");
}

main()
  .catch((e) => {
    console.error("Erreur:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

