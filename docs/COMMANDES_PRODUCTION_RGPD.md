# Commandes de Déploiement Production - Migrations RGPD

## 🚀 Commandes à exécuter en production

### Prérequis

```bash
# Se connecter au serveur de production
ssh user@vps-production

# Aller dans le répertoire de l'application
cd /sites/amakifr
```

---

## 📋 Checklist rapide

### 1. Sauvegarde de la base de données

```bash
# Créer un répertoire de sauvegarde
mkdir -p backups
cd backups

# Sauvegarde PostgreSQL
source ../.env
pg_dump "$DATABASE_URL" > backup_rgpd_$(date +%Y%m%d_%H%M%S).sql

# Vérifier la sauvegarde
ls -lh backup_*.sql
cd ..
```

---

### 2. Récupération du code

```bash
cd /sites/amakifr

# Récupérer les dernières modifications
git pull origin main
```

---

### 3. Installation des dépendances

```bash
cd /sites/amakifr

# Installation des dépendances
npm ci

# Génération du client Prisma
npx prisma generate
```

---

### 4. Application des migrations Prisma

**⚠️ CRITIQUE** : Cette étape modifie la structure de la base de données.

```bash
cd /sites/amakifr

# Vérifier l'état des migrations
npx prisma migrate status

# Appliquer les migrations en attente
npx prisma migrate deploy

# Vérifier que tout est à jour
npx prisma migrate status
```

**Résultat attendu** : `✅ Database schema is up to date!`

---

### 5. Ajout du menu RGPD

```bash
cd /sites/amakifr

# Ajouter le menu RGPD dans la sidebar admin
npx tsx scripts/add-rgpd-menu.ts
```

---

### 6. Build de production

```bash
cd /sites/amakifr

# Build de production
npm run build
```

---

### 7. Redémarrage de l'application

```bash
cd /sites/amakifr

# Redémarrer avec PM2
pm2 restart amakifr

# Vérifier le statut
pm2 status

# Vérifier les logs
pm2 logs amakifr --lines 50
```

---

## 🎯 Script automatisé (optionnel)

Pour exécuter toutes les étapes en une seule fois :

```bash
cd /sites/amakifr
chmod +x scripts/deploy-rgpd-production.sh
./scripts/deploy-rgpd-production.sh
```

---

## ✅ Vérifications post-déploiement

### 1. Vérifier que l'application démarre

```bash
pm2 logs amakifr --lines 20
```

**Vérifier** : Pas d'erreurs Prisma ou `dataDeletionRequest`

---

### 2. Vérifier les tables dans PostgreSQL

```bash
cd /sites/amakifr
source .env

# Se connecter à PostgreSQL
psql "$DATABASE_URL"

# Vérifier les tables
\dt suppressions_adherent
\dt data_deletion_requests

# Vérifier l'enum
\dT+ StatutDemandeSuppression

# Quitter
\q
```

---

### 3. Tester les fonctionnalités

1. **Page publique** : Accéder à `https://amaki.fr/suppression-donnees`
2. **Page admin** : Accéder à `https://amaki.fr/admin/rgpd/demandes` (admin uniquement)
3. **Menu sidebar** : Vérifier que "Demandes RGPD" est visible dans la sidebar admin

---

## 🔧 Commandes de dépannage

### Si les migrations échouent

```bash
# Voir l'état détaillé
npx prisma migrate status

# Voir les erreurs
npx prisma migrate deploy --verbose
```

### Si le client Prisma n'est pas à jour

```bash
# Régénérer le client
npx prisma generate
```

### Si l'application ne démarre pas

```bash
# Voir les erreurs
pm2 logs amakifr --err

# Redémarrer
pm2 restart amakifr
```

### Restauration depuis la sauvegarde

```bash
# ⚠️ DERNIER RECOURS
cd /sites/amakifr/backups
source ../.env
psql "$DATABASE_URL" < backup_rgpd_YYYYMMDD_HHMMSS.sql
```

---

## 📊 Migrations à appliquer

Les migrations suivantes seront appliquées :

1. ✅ `20260116094531_add_suppression_adherent_historique`
   - Table : `suppressions_adherent`
   - Historisation des suppressions

2. ✅ `20260116115248_add_data_deletion_requests`
   - Table : `data_deletion_requests`
   - Enum : `StatutDemandeSuppression`
   - Suivi des demandes RGPD

---

## ⚠️ Points d'attention

1. **Sauvegarde obligatoire** : Toujours faire une sauvegarde avant les migrations
2. **Redémarrage nécessaire** : Le serveur doit être redémarré après `prisma generate`
3. **Vérification** : Tester les fonctionnalités après déploiement
4. **Logs** : Surveiller les logs PM2 après redémarrage

---

## 📞 En cas de problème

1. Vérifier les logs : `pm2 logs amakifr`
2. Vérifier l'état des migrations : `npx prisma migrate status`
3. Restaurer la sauvegarde si nécessaire
4. Consulter la documentation complète : `/docs/DEPLOIEMENT_PRODUCTION_RGPD.md`

---

**Date** : Janvier 2025  
**Version** : 1.0
