/**
 * Script pour télécharger et importer les villes Geonames dans la base de données
 * 
 * Ce script :
 * 1. Télécharge le dump Geonames (cities15000.zip - villes avec > 15000 habitants)
 * 2. Extrait le fichier TSV
 * 3. Parse et importe les données dans la table GeonamesCity
 * 
 * Usage: npm run db:import-geonames
 * 
 * Note: Le fichier fait environ 20-30 MB, l'import peut prendre quelques minutes
 */

import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createReadStream } from 'fs';
import { createInterface } from 'readline';

const prisma = new PrismaClient();

// URL du dump Geonames (villes avec plus de 15000 habitants)
const GEONAMES_URL = 'https://download.geonames.org/export/dump/cities15000.zip';
const DOWNLOAD_DIR = path.join(process.cwd(), 'data', 'geonames');
const ZIP_FILE = path.join(DOWNLOAD_DIR, 'cities15000.zip');
const TSV_FILE = path.join(DOWNLOAD_DIR, 'cities15000.txt');

interface GeonamesCityRow {
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
        reject(new Error(`Erreur HTTP: ${response.statusCode}`));
        return;
      }

      totalBytes = parseInt(response.headers['content-length'] || '0', 10);

      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (totalBytes > 0) {
          const percent = ((downloadedBytes / totalBytes) * 100).toFixed(2);
          process.stdout.write(`\r📥 Progression: ${percent}% (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB)`);
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
  
  // Utiliser unzip si disponible, sinon utiliser node-unzip-js ou adm-zip
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
      console.log('✅ Extraction terminée');
    } catch (zipError) {
      throw new Error('Impossible d\'extraire le fichier ZIP. Installez "unzip" ou "adm-zip"');
    }
  }
}

/**
 * Parse une ligne TSV et retourne un objet GeonamesCityRow
 */
function parseTSVLine(line: string): GeonamesCityRow | null {
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
    console.error(`Erreur lors du parsing de la ligne: ${line.substring(0, 50)}...`);
    return null;
  }
}

/**
 * Importe les villes dans la base de données
 */
async function importCities(tsvPath: string, batchSize: number = 1000): Promise<void> {
  console.log('📊 Import des villes dans la base de données...');
  
  const fileStream = createReadStream(tsvPath, { encoding: 'utf8' });
  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  let lineCount = 0;
  let importedCount = 0;
  let batch: any[] = [];

  for await (const line of rl) {
    lineCount++;
    
    // Ignorer les lignes vides ou les commentaires
    if (!line.trim() || line.startsWith('#')) {
      continue;
    }

    const cityData = parseTSVLine(line);
    if (!cityData) {
      continue;
    }

    // Filtrer uniquement les villes (featureClass = 'P')
    if (cityData.featureClass !== 'P') {
      continue;
    }

    batch.push({
      geonameId: cityData.geonameId,
      name: cityData.name,
      asciiName: cityData.asciiName || null,
      alternateNames: cityData.alternateNames || null,
      latitude: cityData.latitude || null,
      longitude: cityData.longitude || null,
      countryCode: cityData.countryCode,
      admin1Code: cityData.admin1Code || null,
      admin2Code: cityData.admin2Code || null,
      admin3Code: cityData.admin3Code || null,
      admin4Code: cityData.admin4Code || null,
      population: cityData.population > 0 ? BigInt(cityData.population) : null,
      elevation: cityData.elevation || null,
      timezone: cityData.timezone || null,
      featureClass: cityData.featureClass || null,
      featureCode: cityData.featureCode || null,
    });

    // Insérer par batch
    if (batch.length >= batchSize) {
      try {
        await prisma.geonamesCity.createMany({
          data: batch,
          skipDuplicates: true,
        });
        importedCount += batch.length;
        process.stdout.write(`\r📊 Importé: ${importedCount} villes`);
        batch = [];
      } catch (error) {
        console.error(`\nErreur lors de l'import du batch:`, error);
        batch = [];
      }
    }
  }

  // Insérer les dernières villes
  if (batch.length > 0) {
    try {
      await prisma.geonamesCity.createMany({
        data: batch,
        skipDuplicates: true,
      });
      importedCount += batch.length;
    } catch (error) {
      console.error(`\nErreur lors de l'import du dernier batch:`, error);
    }
  }

  console.log(`\n✅ Import terminé: ${importedCount} villes importées`);
}

/**
 * Fonction principale
 */
async function main() {
  console.log('🌍 Import des villes Geonames\n');
  console.log('='.repeat(60));
  
  try {
    // 1. Télécharger le fichier si nécessaire
    if (!fs.existsSync(ZIP_FILE)) {
      await downloadFile(GEONAMES_URL, ZIP_FILE);
    } else {
      console.log('✅ Fichier ZIP déjà présent, téléchargement ignoré');
    }

    // 2. Extraire le fichier si nécessaire
    if (!fs.existsSync(TSV_FILE)) {
      await extractZip(ZIP_FILE, DOWNLOAD_DIR);
      
      // Renommer le fichier si nécessaire
      const extractedFiles = fs.readdirSync(DOWNLOAD_DIR);
      const txtFile = extractedFiles.find(f => f.endsWith('.txt') && f.includes('cities'));
      if (txtFile && txtFile !== 'cities15000.txt') {
        fs.renameSync(
          path.join(DOWNLOAD_DIR, txtFile),
          TSV_FILE
        );
      }
    } else {
      console.log('✅ Fichier TSV déjà présent, extraction ignorée');
    }

    // 3. Vider la table avant import (optionnel)
    console.log('🗑️  Nettoyage de la table existante...');
    await prisma.geonamesCity.deleteMany({});
    console.log('✅ Table nettoyée');

    // 4. Importer les villes
    await importCities(TSV_FILE);

    console.log('\n🎉 Import terminé avec succès !');
    console.log('\n📋 Statistiques:');
    const totalCities = await prisma.geonamesCity.count();
    const citiesByCountry = await prisma.geonamesCity.groupBy({
      by: ['countryCode'],
      _count: true,
      orderBy: {
        _count: {
          countryCode: 'desc',
        },
      },
      take: 10,
    });
    
    console.log(`   Total de villes: ${totalCities}`);
    console.log('\n   Top 10 pays:');
    citiesByCountry.forEach((item) => {
      console.log(`   - ${item.countryCode}: ${item._count} villes`);
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

