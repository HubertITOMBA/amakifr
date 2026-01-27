#!/bin/bash
# Script pour corriger l'état des migrations et réappliquer correctement

set -e

echo "🔍 Correction de l'état des migrations..."
echo ""

# Vérifier l'état actuel
echo "📊 État actuel de l'enum UserRole:"
psql -h localhost -U ${PGUSER:-postgres} -d amakifr -c "
SELECT unnest(enum_range(NULL::\"UserRole\")) AS role_value ORDER BY role_value;
" || true

echo ""
echo "⚠️  Les migrations sont marquées comme appliquées mais ne l'ont pas été réellement."
echo "   (Les valeurs sont encore en minuscules: Admin, Membre, Invite)"
echo ""

read -p "Voulez-vous corriger l'état des migrations ? (oui/non) " -n 3 -r
echo
if [[ ! $REPLY =~ ^[Oo]ui$ ]]; then
  echo "❌ Opération annulée"
  exit 1
fi

echo ""
echo "🔄 Étape 1: Marquer la migration échouée comme rolled-back..."
npx prisma migrate resolve --rolled-back 20260123150938_include_admin_roles_in_user_role

echo ""
echo "🔄 Étape 2: Marquer la migration précédente comme rolled-back..."
echo "   (Elle est marquée comme finished mais n'a pas été appliquée)"
npx prisma migrate resolve --rolled-back 20260123115834_update_user_role_enum

echo ""
echo "✅ Migrations marquées comme rolled-back"
echo ""
echo "📋 Vérification de l'état:"
npx prisma migrate status

echo ""
echo "⚠️  IMPORTANT: Avant de réappliquer les migrations, assurez-vous que:"
echo "   1. PL/pgSQL est installé et fonctionne"
echo "   2. Vous avez une sauvegarde de la base de données"
echo ""
read -p "Voulez-vous réappliquer les migrations maintenant ? (oui/non) " -n 3 -r
echo
if [[ $REPLY =~ ^[Oo]ui$ ]]; then
  echo ""
  echo "🔄 Réapplication des migrations..."
  npx prisma migrate deploy
  
  echo ""
  echo "✅ Génération du client Prisma..."
  npx prisma generate
  
  echo ""
  echo "📋 État final:"
  npx prisma migrate status
else
  echo ""
  echo "ℹ️  Pour réappliquer plus tard, exécutez:"
  echo "   npx prisma migrate deploy"
fi
