import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateEvenementsDates() {
  console.log('🔄 Mise à jour des dates de fin d\'affichage des événements...');

  try {
    const nouvelleDateFin = new Date('2025-12-15T23:59:59');
    
    const result = await prisma.evenement.updateMany({
      data: {
        dateFinAffichage: nouvelleDateFin,
      },
    });

    console.log(`✅ ${result.count} événement(s) mis à jour avec succès !`);
    console.log(`📅 Nouvelle date de fin d'affichage : ${nouvelleDateFin.toLocaleDateString('fr-FR')}`);

  } catch (error) {
    console.error('💥 Erreur lors de la mise à jour des événements:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

updateEvenementsDates();

