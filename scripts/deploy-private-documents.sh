#!/bin/bash

# Script de déploiement des documents privés sur le serveur de production
# Ces documents ne sont pas dans Git et doivent être déployés manuellement

set -e

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📦 Déploiement des documents privés"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# Configuration (à adapter selon votre serveur)
SERVER_USER="${SERVER_USER:-root}"
SERVER_HOST="${SERVER_HOST:-amakifrance.com}"
SERVER_PATH="${SERVER_PATH:-/soft/dev/nextjs/amakifr}"
LOCAL_PRIVATE_DIR="./private/documents"

echo "📋 Configuration:"
echo "   Serveur: $SERVER_USER@$SERVER_HOST"
echo "   Chemin distant: $SERVER_PATH/private/documents/"
echo "   Fichiers locaux: $LOCAL_PRIVATE_DIR"
echo ""

# Vérifier que le dossier local existe
if [ ! -d "$LOCAL_PRIVATE_DIR" ]; then
    echo "❌ Erreur: Le dossier $LOCAL_PRIVATE_DIR n'existe pas"
    exit 1
fi

# Vérifier qu'il y a des fichiers à déployer
FILE_COUNT=$(ls -1 "$LOCAL_PRIVATE_DIR"/*.pdf 2>/dev/null | wc -l)
if [ "$FILE_COUNT" -eq 0 ]; then
    echo "⚠️  Aucun fichier PDF trouvé dans $LOCAL_PRIVATE_DIR"
    echo "   Veuillez placer les documents à déployer dans ce dossier"
    exit 1
fi

echo "📄 Fichiers à déployer:"
ls -lh "$LOCAL_PRIVATE_DIR"/*.pdf
echo ""

# Demander confirmation
read -p "Voulez-vous continuer le déploiement ? (o/N) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Oo]$ ]]; then
    echo "❌ Déploiement annulé"
    exit 0
fi

echo ""
echo "🚀 Déploiement en cours..."

# Créer le dossier sur le serveur si nécessaire
echo "1. Création du dossier distant..."
ssh "$SERVER_USER@$SERVER_HOST" "mkdir -p $SERVER_PATH/private/documents"

# Copier les fichiers
echo "2. Copie des fichiers..."
scp "$LOCAL_PRIVATE_DIR"/*.pdf "$SERVER_USER@$SERVER_HOST:$SERVER_PATH/private/documents/"

# Vérifier les permissions
echo "3. Vérification des permissions..."
ssh "$SERVER_USER@$SERVER_HOST" "chmod 644 $SERVER_PATH/private/documents/*.pdf"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Déploiement terminé avec succès !"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📝 Vérification sur le serveur:"
ssh "$SERVER_USER@$SERVER_HOST" "ls -lh $SERVER_PATH/private/documents/"
echo ""
echo "✓ Les documents sont maintenant accessibles via l'API protégée"
echo "✓ URL: https://amakifrance.com/api/documents/statut"
