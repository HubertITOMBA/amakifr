#!/usr/bin/env bash
# Baseline des migrations Prisma : marque toutes les migrations locales comme déjà
# appliquées sans les exécuter. À utiliser quand la base a déjà le schéma mais
# que l'historique _prisma_migrations ne correspond pas (ex: migration appliquée
# en base supprimée du repo, ou DB migrée autrement).
# Usage: depuis la racine du projet : bash scripts/baseline-prisma-migrations.sh

set -e
cd "$(dirname "$0")/.."

MIGRATIONS=(
  "20250101100000_initial_schema"
  "20250118120000_add_projets_system"
  "20260105103250_add_email_model"
  "20260107162753_add_rapports_reunion"
  "20260113100048_add_dynamic_menus"
  "20260113134904_add_chat_notification_type"
  "20260116094531_add_suppression_adherent_historique"
  "20260116115248_add_data_deletion_requests"
  "20260117183215_add_user_activities"
  "20260123115834_update_user_role_enum"
  "20260123150938_include_admin_roles_in_user_role"
  "20260123164914_add_tresor_vtreso_to_user_role"
  "20260127130000_create_user_admin_roles_table"
  "20260128120000_add_validatedBy_to_depenses"
  "20260129000000_create_permissions_table"
  "20260129100000_add_categorie_type_cotisation"
  "20260129120000_cotisations_mensuelles_one_per_cdm"
  "20260131183928_add_adherent_beneficiaire_id_to_cotisations_mensuelles"
  "20260201180709_add_pass_assistance"
  "20260202120000_update_pass_assistance_structure"
  "20260226120000_pass_assistance_type_cotisation_id"
)

echo "Marquage de ${#MIGRATIONS[@]} migrations comme appliquées (baseline)..."
for name in "${MIGRATIONS[@]}"; do
  if npx prisma migrate resolve --applied "$name" 2>/dev/null; then
    echo "  OK: $name"
  else
    echo "  (déjà appliquée ou erreur): $name"
  fi
done
echo ""
echo "Vérification du statut :"
npx prisma migrate status
