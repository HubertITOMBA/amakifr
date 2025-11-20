#!/usr/bin/env tsx

/**
 * Script pour comparer les schémas de base de données entre dev et production
 * 
 * Usage:
 *   ts-node scripts/compare-db-schemas.ts
 * 
 * Variables d'environnement requises:
 *   - DATABASE_URL_DEV : URL de la base de développement
 *   - DATABASE_URL_PROD : URL de la base de production
 */

import { PrismaClient } from '@prisma/client';

interface TableInfo {
  tableName: string;
  columns: ColumnInfo[];
}

interface ColumnInfo {
  columnName: string;
  dataType: string;
  isNullable: string;
  columnDefault: string | null;
}

async function getTablesInfo(prisma: PrismaClient): Promise<TableInfo[]> {
  const tables = await prisma.$queryRaw<Array<{ table_name: string }>>`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `;

  const tablesInfo: TableInfo[] = [];

  for (const table of tables) {
    const columns = await prisma.$queryRaw<ColumnInfo[]>`
      SELECT 
        column_name as "columnName",
        data_type as "dataType",
        is_nullable as "isNullable",
        column_default as "columnDefault"
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = ${table.table_name}
      ORDER BY ordinal_position;
    `;

    tablesInfo.push({
      tableName: table.table_name,
      columns,
    });
  }

  return tablesInfo;
}

function compareSchemas(devSchema: TableInfo[], prodSchema: TableInfo[]): void {
  const devTables = new Set(devSchema.map(t => t.tableName));
  const prodTables = new Set(prodSchema.map(t => t.tableName));

  console.log('\n📊 COMPARAISON DES SCHÉMAS\n');
  console.log('='.repeat(80));

  // Tables manquantes en production
  const missingInProd = Array.from(devTables).filter(t => !prodTables.has(t));
  if (missingInProd.length > 0) {
    console.log('\n⚠️  TABLES MANQUANTES EN PRODUCTION:');
    missingInProd.forEach(table => {
      console.log(`   - ${table}`);
    });
  } else {
    console.log('\n✅ Toutes les tables de dev existent en production');
  }

  // Tables supplémentaires en production
  const extraInProd = Array.from(prodTables).filter(t => !devTables.has(t));
  if (extraInProd.length > 0) {
    console.log('\n📦 TABLES SUPPLÉMENTAIRES EN PRODUCTION:');
    extraInProd.forEach(table => {
      console.log(`   - ${table}`);
    });
  }

  // Comparaison des colonnes pour les tables communes
  console.log('\n🔍 COMPARAISON DES COLONNES:');
  console.log('-'.repeat(80));

  const commonTables = Array.from(devTables).filter(t => prodTables.has(t));
  let hasDifferences = false;

  for (const tableName of commonTables) {
    const devTable = devSchema.find(t => t.tableName === tableName)!;
    const prodTable = prodSchema.find(t => t.tableName === tableName)!;

    const devColumns = new Set(devTable.columns.map(c => c.columnName));
    const prodColumns = new Set(prodTable.columns.map(c => c.columnName));

    const missingInProdCols = devTable.columns.filter(c => !prodColumns.has(c.columnName));
    const extraInProdCols = prodTable.columns.filter(c => !devColumns.has(c.columnName));

    if (missingInProdCols.length > 0 || extraInProdCols.length > 0) {
      hasDifferences = true;
      console.log(`\n📋 Table: ${tableName}`);
      
      if (missingInProdCols.length > 0) {
        console.log('   ⚠️  Colonnes manquantes en production:');
        missingInProdCols.forEach(col => {
          console.log(`      - ${col.columnName} (${col.dataType})`);
        });
      }

      if (extraInProdCols.length > 0) {
        console.log('   📦 Colonnes supplémentaires en production:');
        extraInProdCols.forEach(col => {
          console.log(`      - ${col.columnName} (${col.dataType})`);
        });
      }
    }
  }

  if (!hasDifferences) {
    console.log('✅ Toutes les colonnes correspondent');
  }

  console.log('\n' + '='.repeat(80));
  console.log('\n📝 RÉSUMÉ:');
  console.log(`   Tables en dev: ${devTables.size}`);
  console.log(`   Tables en prod: ${prodTables.size}`);
  console.log(`   Tables manquantes en prod: ${missingInProd.length}`);
  console.log(`   Colonnes manquantes en prod: ${commonTables.reduce((sum, t) => {
    const devTable = devSchema.find(tt => tt.tableName === t)!;
    const prodTable = prodSchema.find(tt => tt.tableName === t)!;
    const prodCols = new Set(prodTable.columns.map(c => c.columnName));
    return sum + devTable.columns.filter(c => !prodCols.has(c.columnName)).length;
  }, 0)}`);
}

async function main() {
  const devUrl = process.env.DATABASE_URL_DEV || process.env.DATABASE_URL;
  const prodUrl = process.env.DATABASE_URL_PROD;

  if (!devUrl) {
    console.error('❌ DATABASE_URL_DEV ou DATABASE_URL non défini');
    process.exit(1);
  }

  if (!prodUrl) {
    console.error('❌ DATABASE_URL_PROD non défini');
    console.error('   Définissez DATABASE_URL_PROD pour comparer avec la production');
    process.exit(1);
  }

  console.log('🔍 Récupération du schéma de développement...');
  const devPrisma = new PrismaClient({
    datasources: {
      db: {
        url: devUrl,
      },
    },
  });

  console.log('🔍 Récupération du schéma de production...');
  const prodPrisma = new PrismaClient({
    datasources: {
      db: {
        url: prodUrl,
      },
    },
  });

  try {
    const devSchema = await getTablesInfo(devPrisma);
    const prodSchema = await getTablesInfo(prodPrisma);

    compareSchemas(devSchema, prodSchema);
  } catch (error) {
    console.error('❌ Erreur lors de la comparaison:', error);
    process.exit(1);
  } finally {
    await devPrisma.$disconnect();
    await prodPrisma.$disconnect();
  }
}

main();

