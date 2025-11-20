#!/usr/bin/env tsx

/**
 * Script pour vérifier rapidement les tables manquantes en production
 * 
 * Usage:
 *   ts-node scripts/check-missing-tables.ts
 */

import { PrismaClient } from '@prisma/client';

const TABLES_TO_CHECK = [
  'documents',
  'ressources',
  'reservations',
  'notifications',
  'badges',
  'idees',
  'elections',
  'votes',
  'candidacies',
  'positions',
];

async function checkTableExists(prisma: PrismaClient, tableName: string): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name = ${tableName}
      ) as exists;
    `;
    return result[0]?.exists || false;
  } catch (error) {
    console.error(`Erreur lors de la vérification de ${tableName}:`, error);
    return false;
  }
}

async function checkColumnExists(
  prisma: PrismaClient,
  tableName: string,
  columnName: string
): Promise<boolean> {
  try {
    const result = await prisma.$queryRaw<Array<{ exists: boolean }>>`
      SELECT EXISTS (
        SELECT FROM information_schema.columns
        WHERE table_schema = 'public' 
          AND table_name = ${tableName}
          AND column_name = ${columnName}
      ) as exists;
    `;
    return result[0]?.exists || false;
  } catch (error) {
    console.error(`Erreur lors de la vérification de ${tableName}.${columnName}:`, error);
    return false;
  }
}

async function main() {
  const dbUrl = process.env.DATABASE_URL;
  
  if (!dbUrl) {
    console.error('❌ DATABASE_URL non défini');
    process.exit(1);
  }

  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: dbUrl,
      },
    },
  });

  console.log('🔍 Vérification des tables et colonnes...\n');

  const missingTables: string[] = [];
  const missingColumns: Array<{ table: string; column: string }> = [];

  // Vérifier les tables
  for (const table of TABLES_TO_CHECK) {
    const exists = await checkTableExists(prisma, table);
    if (!exists) {
      missingTables.push(table);
      console.log(`❌ Table manquante: ${table}`);
    } else {
      console.log(`✅ Table existe: ${table}`);
    }
  }

  // Vérifier les colonnes spécifiques
  const datePremiereAdhesionExists = await checkColumnExists(prisma, 'adherent', 'datePremiereAdhesion');
  if (!datePremiereAdhesionExists) {
    missingColumns.push({ table: 'adherent', column: 'datePremiereAdhesion' });
    console.log(`❌ Colonne manquante: adherent.datePremiereAdhesion`);
  } else {
    console.log(`✅ Colonne existe: adherent.datePremiereAdhesion`);
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📊 RÉSUMÉ:\n');
  
  if (missingTables.length === 0 && missingColumns.length === 0) {
    console.log('✅ Toutes les tables et colonnes vérifiées existent');
  } else {
    if (missingTables.length > 0) {
      console.log(`⚠️  ${missingTables.length} table(s) manquante(s):`);
      missingTables.forEach(t => console.log(`   - ${t}`));
    }
    
    if (missingColumns.length > 0) {
      console.log(`\n⚠️  ${missingColumns.length} colonne(s) manquante(s):`);
      missingColumns.forEach(c => console.log(`   - ${c.table}.${c.column}`));
    }
    
    console.log('\n💡 Ces tables/colonnes sont gérées avec safePrismaQuery() dans le code.');
    console.log('   L\'application devrait fonctionner même si elles n\'existent pas.');
  }

  await prisma.$disconnect();
}

main();

