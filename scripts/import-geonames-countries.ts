/**
 * Script pour télécharger et importer les pays Geonames dans la base de données
 * 
 * Ce script :
 * 1. Télécharge le dump Geonames (allCountries.zip - toutes les entités)
 * 2. Extrait le fichier TSV
 * 3. Parse et filtre uniquement les pays (featureClass='A' et featureCode='PCLI')
 * 4. Importe les données dans la table GeonamesCountry
 * 
 * Usage: npm run db:import-geonames-countries
 * 
 * Note: Le fichier fait environ 1.5 GB, l'import peut prendre 30-60 minutes
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const prisma = new PrismaClient();

// URL du dump Geonames (toutes les entités)
const GEONAMES_URL = 'https://download.geonames.org/export/dump/allCountries.zip';
const DOWNLOAD_DIR = path.join(process.cwd(), 'data', 'geonames');
const ZIP_FILE = path.join(DOWNLOAD_DIR, 'allCountries.zip');
const TSV_FILE = path.join(DOWNLOAD_DIR, 'allCountries.txt');

interface GeonamesRow {
  geonameId: number;
  name: string;
  asciiName: string;
  alternateNames: string;
  latitude: number;
  longitude: number;
  featureClass: string;
  featureCode: string;
  countryCode: string;
  cc2: string;
  admin1Code: string;
  admin2Code: string;
  admin3Code: string;
  admin4Code: string;
  population: number;
  elevation: number;
  dem: number;
  timezone: string;
  modificationDate: string;
}

/**
 * Télécharge le fichier depuis l'URL
 */
async function downloadFile(url: string, dest: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`📥 Téléchargement de ${url}...`);
    console.log('⚠️  Le fichier fait environ 1.5 GB, cela peut prendre du temps...\n');
    
    // Créer le répertoire si nécessaire
    const dir = path.dirname(dest);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const file = fs.createWriteStream(dest);
    let downloadedBytes = 0;
    let totalBytes = 0;

    https.get(url, (response) => {
      if (response.statusCode !== 200) {
        file.close();
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
        reject(new Error(`Erreur HTTP: ${response.statusCode}`));
        return;
      }

      totalBytes = parseInt(response.headers['content-length'] || '0', 10);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const percent = ((downloadedBytes / totalBytes) * 100).toFixed(2);
          const mbDownloaded = (downloadedBytes / 1024 / 1024).toFixed(2);
          const mbTotal = (totalBytes / 1024 / 1024).toFixed(2);
          process.stdout.write(`\r📥 Progression: ${percent}% (${mbDownloaded} MB / ${mbTotal} MB)`);
        } else {
          const mbDownloaded = (downloadedBytes / 1024 / 1024).toFixed(2);
          process.stdout.write(`\r📥 Téléchargé: ${mbDownloaded} MB`);
        }
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        console.log('\n✅ Téléchargement terminé');
        resolve();
      });

      response.on('error', (err) => {
        file.close();
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
        reject(err);
      });

      file.on('error', (err) => {
        file.close();
        if (fs.existsSync(dest)) {
          fs.unlinkSync(dest);
        }
        reject(err);
      });
    }).on('error', (err) => {
      if (fs.existsSync(dest)) {
        fs.unlinkSync(dest);
      }
      reject(err);
    });
  });
}

/**
 * Extrait le fichier ZIP
 */
async function extractZip(zipPath: string, destDir: string): Promise<void> {
  console.log('📦 Extraction du fichier ZIP...');
  console.log('⚠️  Cela peut prendre plusieurs minutes...\n');
  
  const { execSync } = require('child_process');
  
  try {
    // Vérifier si unzip est disponible
    execSync('which unzip', { stdio: 'ignore' });
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' });
    console.log('✅ Extraction terminée');
  } catch (error) {
    // Fallback: utiliser adm-zip si disponible
    try {
      const AdmZip = require('adm-zip');
      const zip = new AdmZip(zipPath);
      zip.extractAllTo(destDir, true);
      console.log('✅ Extraction terminée (via adm-zip)');
    } catch (zipError) {
      console.error('\n❌ Erreur: Impossible d\'extraire le fichier ZIP');
      console.error('💡 Solutions:');
      console.error('   1. Installez "unzip": sudo apt-get install unzip (Linux) ou brew install unzip (macOS)');
      console.error('   2. Ou installez "adm-zip": npm install --save-dev adm-zip');
      throw new Error('Impossible d\'extraire le fichier ZIP');
    }
  }
}

/**
 * Parse une ligne TSV et retourne un objet GeonamesRow
 */
function parseTSVLine(line: string): GeonamesRow | null {
  const parts = line.split('\t');
  
  if (parts.length < 19) {
    return null;
  }

  try {
    return {
      geonameId: parseInt(parts[0], 10),
      name: parts[1],
      asciiName: parts[2],
      alternateNames: parts[3],
      latitude: parseFloat(parts[4]),
      longitude: parseFloat(parts[5]),
      featureClass: parts[6],
      featureCode: parts[7],
      countryCode: parts[8],
      cc2: parts[9],
      admin1Code: parts[10],
      admin2Code: parts[11],
      admin3Code: parts[12],
      admin4Code: parts[13],
      population: parseInt(parts[14], 10) || 0,
      elevation: parseInt(parts[15], 10) || 0,
      dem: parseInt(parts[16], 10) || 0,
      timezone: parts[17],
      modificationDate: parts[18],
    };
  } catch (error) {
    return null;
  }
}

/**
 * Importe les pays dans la base de données
 * Filtre uniquement les pays: featureClass='A' et featureCode='PCLI'
 */
async function importCountries(tsvPath: string, batchSize: number = 100): Promise<void> {
  console.log('📊 Import des pays dans la base de données...');
  console.log('🔍 Filtrage: featureClass=A et featureCode=PCLI (pays indépendants)\n');
  
  const fileStream = createReadStream(tsvPath, { encoding: 'utf8' });
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let filteredCount = 0;
  let importedCount = 0;
  let batch: any[] = [];

  for await (const line of rl) {
    lineCount++;
    
    // Afficher la progression tous les 100000 lignes
    if (lineCount % 100000 === 0) {
      process.stdout.write(`\r📊 Lignes traitées: ${lineCount.toLocaleString()} | Pays trouvés: ${filteredCount} | Importés: ${importedCount}`);
    }
    
    // Ignorer les lignes vides ou les commentaires
    if (!line.trim() || line.startsWith('#')) {
      continue;
    }

    const rowData = parseTSVLine(line);
    if (!rowData) {
      continue;
    }

    // Filtrer uniquement les pays indépendants
    // featureClass = 'A' (administrative boundaries)
    // featureCode = 'PCLI' (independent political entity)
    if (rowData.featureClass !== 'A' || rowData.featureCode !== 'PCLI') {
      continue;
    }

    // Ignorer si pas de countryCode
    if (!rowData.countryCode || rowData.countryCode.length !== 2) {
      continue;
    }

    filteredCount++;

    batch.push({
      geonameId: rowData.geonameId,
      name: rowData.name,
      asciiName: rowData.asciiName || null,
      alternateNames: rowData.alternateNames || null,
      latitude: rowData.latitude || null,
      longitude: rowData.longitude || null,
      countryCode: rowData.countryCode.toUpperCase(),
      cc2: rowData.cc2 || null,
      admin1Code: rowData.admin1Code || null,
      admin2Code: rowData.admin2Code || null,
      admin3Code: rowData.admin3Code || null,
      admin4Code: rowData.admin4Code || null,
      population: rowData.population > 0 ? BigInt(rowData.population) : null,
      elevation: rowData.elevation || null,
      timezone: rowData.timezone || null,
      featureClass: rowData.featureClass,
      featureCode: rowData.featureCode,
    });

    // Insérer par batch
    if (batch.length >= batchSize) {
      try {
        await prisma.geonamesCountry.createMany({
          data: batch,
          skipDuplicates: true,
        });
        importedCount += batch.length;
        batch = [];
      } catch (error) {
        console.error(`\n❌ Erreur lors de l'import du batch:`, error);
        batch = [];
      }
    }
  }

  // Insérer les derniers pays
  if (batch.length > 0) {
    try {
      await prisma.geonamesCountry.createMany({
        data: batch,
        skipDuplicates: true,
      });
      importedCount += batch.length;
    } catch (error) {
      console.error(`\n❌ Erreur lors de l'import du dernier batch:`, error);
    }
  }

  console.log(`\n✅ Import terminé:`);
  console.log(`   - Lignes traitées: ${lineCount.toLocaleString()}`);
  console.log(`   - Pays trouvés: ${filteredCount}`);
  console.log(`   - Pays importés: ${importedCount}`);
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🌍 Import des pays Geonames\n');
  console.log('='.repeat(60));
  console.log('⚠️  ATTENTION: Le fichier allCountries.zip fait ~1.5 GB');
  console.log('⚠️  Le téléchargement et l\'import peuvent prendre 30-60 minutes');
  console.log('='.repeat(60));
  console.log('');
  
  try {
    // 1. Télécharger le fichier si nécessaire
    if (!fs.existsSync(ZIP_FILE)) {
      await downloadFile(GEONAMES_URL, ZIP_FILE);
    } else {
      console.log('✅ Fichier ZIP déjà présent, téléchargement ignoré');
      const stats = fs.statSync(ZIP_FILE);
      const sizeMB = (stats.size / 1024 / 1024).toFixed(2);
      console.log(`   Taille: ${sizeMB} MB\n`);
    }

    // 2. Extraire le fichier si nécessaire
    if (!fs.existsSync(TSV_FILE)) {
      await extractZip(ZIP_FILE, DOWNLOAD_DIR);
      
      // Renommer le fichier si nécessaire
      const extractedFiles = fs.readdirSync(DOWNLOAD_DIR);
      const txtFile = extractedFiles.find(f => f.endsWith('.txt') && f.includes('allCountries'));
      if (txtFile && txtFile !== 'allCountries.txt') {
        fs.renameSync(
          path.join(DOWNLOAD_DIR, txtFile),
          TSV_FILE
        );
      }
    } else {
      console.log('✅ Fichier TSV déjà présent, extraction ignorée');
      const stats = fs.statSync(TSV_FILE);
      const sizeGB = (stats.size / 1024 / 1024 / 1024).toFixed(2);
      console.log(`   Taille: ${sizeGB} GB\n`);
    }

    // 3. Vider la table avant import (optionnel)
    console.log('🗑️  Nettoyage de la table existante...');
    await prisma.geonamesCountry.deleteMany({});
    console.log('✅ Table nettoyée\n');

    // 4. Importer les pays
    await importCountries(TSV_FILE);

    console.log('\n🎉 Import terminé avec succès !');
    console.log('\n📋 Statistiques:');
    const totalCountries = await prisma.geonamesCountry.count();
    const countriesSample = await prisma.geonamesCountry.findMany({
      take: 10,
      orderBy: {
        name: 'asc',
      },
      select: {
        name: true,
        countryCode: true,
      },
    });
    
    console.log(`   Total de pays: ${totalCountries}`);
    console.log('\n   Exemples de pays importés:');
    countriesSample.forEach((country) => {
      console.log(`   - ${country.name} (${country.countryCode})`);
    });

  } catch (error) {
    console.error('\n💥 Erreur:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Exécuter le script
main();

