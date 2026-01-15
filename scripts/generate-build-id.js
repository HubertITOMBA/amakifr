#!/usr/bin/env node

/**
 * Script pour générer un build ID unique à chaque build
 * Ce script est appelé lors du processus de build pour créer un identifiant unique
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Générer un build ID unique basé sur la date et un hash
const buildId = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`;
const buildTimestamp = new Date().toISOString();

// Créer l'objet build info
const buildInfo = {
  buildId,
  timestamp: buildTimestamp,
  version: process.env.npm_package_version || '0.1.0',
};

// Créer le répertoire public s'il n'existe pas
const publicDir = path.join(process.cwd(), 'public');
if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

// Écrire le fichier build-id.json dans public
const buildIdPath = path.join(publicDir, 'build-id.json');
fs.writeFileSync(buildIdPath, JSON.stringify(buildInfo, null, 2), 'utf-8');

console.log(`✅ Build ID généré: ${buildId}`);
console.log(`📝 Fichier créé: ${buildIdPath}`);
