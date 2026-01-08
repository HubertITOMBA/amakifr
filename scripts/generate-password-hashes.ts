/**
 * Script pour générer les hash bcrypt des mots de passe
 * Usage: npx tsx scripts/generate-password-hashes.ts
 */

import bcrypt from 'bcryptjs';

async function generateHashes() {
  const password = 'password'; // Mot de passe par défaut
  const saltRounds = 10;

  console.log('='.repeat(70));
  console.log('Génération des hash bcrypt pour les nouveaux adhérents');
  console.log('='.repeat(70));
  console.log('\nMot de passe utilisé:', password);
  console.log('\n');

  const adherents = [
    { name: 'Thérèse Mayakampongo', email: 'maya.thethe@gmail.com' },
    { name: 'Eugène Mbongo', email: 'eugenembongopasy@gmail.com' },
    { name: 'Marie Muilu', email: 'mariemuilu243@gmail.com' },
    { name: 'JC Mvuama', email: 'Jcmvuama@yahoo.fr' },
    { name: 'José Tshikuna', email: 'jostshik@yahoo.fr' },
  ];

  // Générer un seul hash pour tous (ils utilisent tous le même mot de passe)
  const hash = await bcrypt.hash(password, saltRounds);
  
  console.log('Hash bcrypt généré:');
  console.log(hash);
  console.log('\n');
  
  console.log('Liste des adhérents qui utiliseront ce hash:');
  adherents.forEach((adherent, index) => {
    console.log(`${index + 1}. ${adherent.name} (${adherent.email})`);
  });
  
  console.log('\n');
  console.log('='.repeat(70));
  console.log('Instructions:');
  console.log('='.repeat(70));
  console.log('1. Copiez le hash ci-dessus');
  console.log('2. Ouvrez le fichier: scripts/insert-nouveaux-adherents.sql');
  console.log('3. Remplacez TOUTES les occurrences de:');
  console.log('   $2a$10$YourHashedPasswordHere');
  console.log('   par le hash généré');
  console.log('4. Exécutez le script SQL en production');
  console.log('='.repeat(70));
  console.log('\n');
  
  // Générer la commande sed pour remplacer automatiquement
  console.log('Ou utilisez cette commande pour remplacer automatiquement:');
  console.log('\n');
  console.log(`sed -i 's|\\$2a\\$10\\$YourHashedPasswordHere|${hash}|g' scripts/insert-nouveaux-adherents.sql`);
  console.log('\n');
}

generateHashes().catch(console.error);
