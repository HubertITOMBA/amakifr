#!/bin/bash
# Script pour résoudre la migration échouée 20260123150938_include_admin_roles_in_user_role

set -e

echo "🔍 Vérification de l'état de la migration..."

# Vérifier l'état de l'enum UserRole
echo "📊 Vérification des valeurs de l'enum UserRole..."
psql -h localhost -U ${PGUSER:-postgres} -d amakifr -c "
SELECT unnest(enum_range(NULL::\"UserRole\")) AS role_value ORDER BY role_value;
"

# Vérifier si UserRole_old existe
echo ""
echo "📊 Vérification de l'existence de UserRole_old..."
OLD_EXISTS=$(psql -h localhost -U ${PGUSER:-postgres} -d amakifr -t -c "
SELECT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserRole_old');
" | xargs)

if [ "$OLD_EXISTS" = "t" ]; then
  echo "⚠️  UserRole_old existe encore - la migration n'a pas été complétée"
  echo ""
  echo "🔧 Options :"
  echo "   1. Si la migration a été partiellement appliquée, vérifiez manuellement"
  echo "   2. Si rien n'a été appliqué, marquez comme rolled-back"
  echo ""
  read -p "Voulez-vous marquer la migration comme rolled-back ? (oui/non) " -n 3 -r
  echo
  if [[ $REPLY =~ ^[Oo]ui$ ]]; then
    echo "🔄 Marquage de la migration comme rolled-back..."
    npx prisma migrate resolve --rolled-back 20260123150938_include_admin_roles_in_user_role
    echo "✅ Migration marquée comme rolled-back"
  fi
else
  echo "✅ UserRole_old n'existe pas - la migration semble avoir été appliquée"
  echo ""
  echo "🔧 Vérification des valeurs de l'enum..."
  VALUES=$(psql -h localhost -U ${PGUSER:-postgres} -d amakifr -t -c "
  SELECT string_agg(unnest(enum_range(NULL::\"UserRole\"))::text, ', ' ORDER BY unnest(enum_range(NULL::\"UserRole\"))::text)
  FROM (SELECT unnest(enum_range(NULL::\"UserRole\"))) AS roles;
  " | xargs)
  
  echo "Valeurs actuelles de UserRole: $VALUES"
  
  EXPECTED="ADMIN, MEMBRE, INVITE, PRESID, VICEPR, SECRET, VICESE, COMCPT"
  if [[ "$VALUES" == *"PRESID"* ]] && [[ "$VALUES" == *"SECRET"* ]]; then
    echo "✅ L'enum contient les nouvelles valeurs - la migration semble complète"
    echo ""
    read -p "Voulez-vous marquer la migration comme appliquée ? (oui/non) " -n 3 -r
    echo
    if [[ $REPLY =~ ^[Oo]ui$ ]]; then
      echo "🔄 Marquage de la migration comme appliquée..."
      npx prisma migrate resolve --applied 20260123150938_include_admin_roles_in_user_role
      echo "✅ Migration marquée comme appliquée"
    fi
  else
    echo "⚠️  L'enum ne contient pas toutes les valeurs attendues"
    echo "   Attendu: ADMIN, MEMBRE, INVITE, PRESID, VICEPR, SECRET, VICESE, COMCPT"
    echo "   Actuel: $VALUES"
  fi
fi

echo ""
echo "📋 État final des migrations:"
npx prisma migrate status
