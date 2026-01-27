import { PrismaClient } from '@prisma/client';
import { join } from 'path';
import { existsSync, copyFileSync, mkdirSync } from 'fs';

const prisma = new PrismaClient();

/**
 * Script pour créer les événements liés aux élections du bureau
 * - Événement 1 : Élections du Bureau (événement principal)
 * - Événement 2 : Vote - Élections du Bureau (événement de vote)
 */
async function createEvenementsElections() {
  console.log('🗳️  Création des événements liés aux élections du bureau...\n');

  try {
    // Récupérer un admin pour createdBy
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN' },
      select: { id: true },
    });

    if (!admin) {
      throw new Error('Aucun administrateur trouvé dans la base de données');
    }

    // Créer le dossier evenements s'il n'existe pas
    const evenementsDir = join(process.cwd(), 'public', 'ressources', 'evenements');
    if (!existsSync(evenementsDir)) {
      mkdirSync(evenementsDir, { recursive: true });
      console.log('  ✓ Dossier /public/ressources/evenements créé');
    }

    // Copier les images dans le dossier evenements
    const imagesToCopy = [
      { src: 'amaki_flag_cf.jpeg', dest: 'amaki_flag_cf.jpeg' },
      { src: 'Bureau0.jpeg', dest: 'Bureau0.jpeg' },
      { src: 'Bureau1.jpeg', dest: 'Bureau1.jpeg' },
      { src: 'Bureau2.jpeg', dest: 'Bureau2.jpeg', optional: true }, // Optionnel si n'existe pas
      { src: 'vote_1.jpeg', dest: 'vote_1.jpeg' },
      { src: 'vote_2.jpeg', dest: 'vote_2.jpeg' },
    ];

    console.log('\n📁 Copie des images...');
    let bureau2Exists = false;
    for (const img of imagesToCopy) {
      const srcPath = join(process.cwd(), 'public', 'ressources', img.src);
      const destPath = join(evenementsDir, img.dest);
      
      if (existsSync(srcPath)) {
        copyFileSync(srcPath, destPath);
        console.log(`  ✓ ${img.src} copié vers /ressources/evenements/`);
        if (img.src === 'Bureau2.jpeg') {
          bureau2Exists = true;
        }
      } else {
        if (img.optional) {
          console.log(`  ℹ️  ${img.src} non trouvé (optionnel), utilisation de Bureau1.jpeg à la place`);
        } else {
          console.warn(`  ⚠️  ${img.src} non trouvé, ignoré`);
        }
      }
    }

    // Date de l'événement : 29 Novembre 2025
    const dateEvenement = new Date('2025-11-29T10:00:00');
    const dateFinEvenement = new Date('2025-11-29T18:00:00');
    const dateAffichage = new Date('2025-11-01T00:00:00'); // Affichage à partir du 1er novembre
    const dateFinAffichage = new Date('2025-12-31T23:59:59'); // Affichage jusqu'à fin décembre

    // ÉVÉNEMENT 1 : Élections du Bureau (événement principal)
    console.log('\n📅 Création de l\'événement "Élections du Bureau"...');
    
    const evenement1 = await prisma.evenement.create({
      data: {
        titre: 'ÉLECTIONS DU BUREAU - Renouvellement des postes de direction',
        description: 'Événement majeur : Renouvellement du Bureau - 29 Novembre 2025. Pour la première fois, nous élirons également les membres du comité directeur. Votre participation est essentielle pour l\'avenir de notre association.',
        contenu: `# ÉLECTIONS DU BUREAU

## Date des élections
Vendredi 29 Novembre 2025 - Assemblée Générale

## Lieu
77124 VILLENOY

## Postes à pourvoir
- Président(e) + Vice-Président(e)
- Secrétaire + Vice-Secrétaire
- Trésorier(ère) + Vice-Trésorier(ère)
- Commissaire aux comptes
- Membres du Comité Directeur

**Nouveauté :** Pour la première fois, nous élirons également les membres du comité directeur.

## Processus électoral

### 1. Candidatures
Dépôt des candidatures selon le calendrier établi. Chaque candidat doit présenter son programme et ses motivations.

### 2. Campagne
Période de campagne électorale avec présentation des candidats et débats.

### 3. Vote
Vote secret lors de l'Assemblée Générale. Chaque membre dispose d'une voix par poste.

### 4. Proclamation
Dépouillement et proclamation des résultats en présence de tous les membres.

## Profil Type du Candidat à la Présidence

### Qualités Essentielles
- Motivation et implication active
- Volonté d'assumer les responsabilités
- Honnêteté et transparence
- Respect des valeurs de l'association
- Aptitude à écouter et gérer les conflits
- Rigueur et capacité de planification
- Capacité à inspirer et fédérer
- Être à jour des cotisations

## Informations importantes
- **Date d'élection :** 29 Novembre 2025
- **Entrée en fonction :** Janvier 2026
- **Passation de pouvoir :** Lors de la réunion de décembre 2025`,
        dateDebut: dateEvenement,
        dateFin: dateFinEvenement,
        dateAffichage: dateAffichage,
        dateFinAffichage: dateFinAffichage,
        lieu: 'VILLENOY',
        adresse: '77124 VILLENOY',
        categorie: 'General',
        statut: 'Publie',
        imagePrincipale: '/ressources/evenements/amaki_flag_cf.jpeg',
        images: JSON.stringify(
          bureau2Exists
            ? [
                '/ressources/evenements/Bureau0.jpeg',
                '/ressources/evenements/Bureau2.jpeg',
              ]
            : [
                '/ressources/evenements/Bureau0.jpeg',
                '/ressources/evenements/Bureau1.jpeg',
              ]
        ),
        inscriptionRequis: false,
        createdBy: admin.id,
      },
    });

    console.log(`  ✅ Événement créé : ${evenement1.id}`);
    console.log(`     Titre : ${evenement1.titre}`);

    // ÉVÉNEMENT 2 : Vote - Élections du Bureau
    console.log('\n🗳️  Création de l\'événement "Vote - Élections du Bureau"...');
    
    const evenement2 = await prisma.evenement.create({
      data: {
        titre: 'Vote - Élections du Bureau 2026',
        description: 'Vote pour le renouvellement du Bureau. Chaque membre dispose d\'une voix par poste. Vote secret lors de l\'Assemblée Générale du 29 Novembre 2025.',
        contenu: `# Vote - Élections du Bureau 2026

## Date du vote
Vendredi 29 Novembre 2025 - Assemblée Générale

## Lieu
77124 VILLENOY

## Modalités de vote
- Vote secret
- Chaque membre dispose d'une voix par poste
- Dépouillement en présence de tous les membres
- Proclamation des résultats le jour même

## Postes à élire
- Président(e) + Vice-Président(e)
- Secrétaire + Vice-Secrétaire
- Trésorier(ère) + Vice-Trésorier(ère)
- Commissaire aux comptes
- Membres du Comité Directeur

## Votre voix compte !
Participez activement à la vie démocratique de votre amicale. Chaque vote compte pour construire l'avenir ensemble.`,
        dateDebut: dateEvenement,
        dateFin: dateFinEvenement,
        dateAffichage: dateAffichage,
        dateFinAffichage: dateFinAffichage,
        lieu: 'VILLENOY',
        adresse: '77124 VILLENOY',
        categorie: 'General',
        statut: 'Publie',
        imagePrincipale: '/ressources/evenements/vote_1.jpeg',
        images: JSON.stringify([
          '/ressources/evenements/vote_2.jpeg',
        ]),
        inscriptionRequis: false,
        createdBy: admin.id,
      },
    });

    console.log(`  ✅ Événement créé : ${evenement2.id}`);
    console.log(`     Titre : ${evenement2.titre}`);

    console.log('\n✅ Tous les événements ont été créés avec succès !');
    console.log('\n📋 Résumé :');
    console.log(`   - Événement 1 : Élections du Bureau (${evenement1.id})`);
    console.log(`   - Événement 2 : Vote - Élections du Bureau (${evenement2.id})`);
    console.log(`   - Images copiées dans /public/ressources/evenements/`);
    console.log('\n💡 Les événements sont maintenant disponibles dans :');
    console.log('   - /evenements (page publique)');
    console.log('   - /admin/evenements (gestion admin)');

  } catch (error) {
    console.error('❌ Erreur lors de la création des événements:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createEvenementsElections();

