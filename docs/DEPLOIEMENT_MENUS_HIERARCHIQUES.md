# Guide de Déploiement - Menus Hiérarchiques

## 📋 Résumé des modifications

Cette mise à jour implémente un système de **menus hiérarchiques** avec dropdown pour regrouper les options électorales sous un menu parent "Scrutin".

### Objectifs
- ✅ Éliminer le scroll horizontal dans la navbar
- ✅ Améliorer l'organisation des menus
- ✅ Offrir une UX plus professionnelle

### Fichiers modifiés
```
modified:   components/home/DynamicNavbar.tsx
modified:   scripts/seed-menus.ts
new file:   scripts/seed-menus-auto.sh
new file:   docs/MENUS_HIERARCHIQUES.md
new file:   docs/DEPLOIEMENT_MENUS_HIERARCHIQUES.md
```

### Changements en base de données
- ✅ **Aucune migration requise** : Le schéma Prisma avait déjà le champ `parent`
- ⚠️ **Re-seed requis** : Les menus existants doivent être recréés avec la nouvelle hiérarchie

## 🚀 Procédure de déploiement

### Étape 1 : Sauvegarde (Recommandé)

```bash
# Sauvegarder les menus actuels
psql -h localhost -U postgres -d amakifr -c "COPY (SELECT * FROM menus) TO '/tmp/menus_backup.csv' CSV HEADER;"

# Ou via pg_dump
pg_dump -h localhost -U postgres -d amakifr -t menus > /tmp/menus_backup.sql
```

### Étape 2 : Arrêter l'application (Optionnel)

```bash
pm2 stop amakifr
```

**Note** : L'application peut rester en ligne pendant le déploiement. Le re-seed est rapide (< 10 secondes).

### Étape 3 : Pull du code

```bash
cd /sites/amakifr
git pull origin main
```

### Étape 4 : Installation des dépendances

```bash
npm install
```

**Note** : Les dépendances Radix UI (`@radix-ui/react-dropdown-menu`) sont déjà installées.

### Étape 5 : Vérifier Prisma

```bash
# Vérifier que le client Prisma est à jour
npx prisma generate
```

### Étape 6 : Re-seeder les menus

#### Option A : Mode interactif (recommandé en dev)

```bash
npx tsx scripts/seed-menus.ts
# Répondre "oui" quand demandé
```

#### Option B : Mode automatique (production)

```bash
bash scripts/seed-menus-auto.sh
```

**Sortie attendue** :
```
🌱 Démarrage du seed des menus...
✅ Connexion à la base de données réussie
⚠️  34 menu(s) déjà présent(s) dans la base.
✅ Menus existants supprimés

📝 Création de 33 menus parents...
✅ Menu créé: L'amicale (NAVBAR)
✅ Menu créé: Scrutin (NAVBAR)
[...]

📝 Création de 2 sous-menus électoraux...
✅ Sous-menu créé: Informations (parent: Scrutin)
✅ Sous-menu créé: Résultats (parent: Scrutin)

🎉 35 menus créés avec succès!

📊 Résumé:
- Menus NAVBAR: 9
- Menus SIDEBAR: 26
- Menus électoraux: 7
- Sous-menus: 2
```

### Étape 7 : Build de l'application

```bash
npm run build
```

### Étape 8 : Redémarrer l'application

```bash
pm2 restart amakifr
```

### Étape 9 : Vérification post-déploiement

#### 1. Vérifier que l'application démarre

```bash
pm2 logs amakifr --lines 50
```

**Logs attendus** :
```
✓ Ready in XXms
```

#### 2. Vérifier les menus en base

```bash
psql -h localhost -U postgres -d amakifr -c "
SELECT 
  libelle, 
  niveau, 
  parent, 
  ordre, 
  statut 
FROM menus 
WHERE niveau = 'NAVBAR' 
ORDER BY ordre;
"
```

**Résultat attendu** :
```
    libelle     | niveau | parent | ordre | statut 
----------------+--------+--------+-------+--------
 L'amicale      | NAVBAR | null   |     1 | t
 Scrutin        | NAVBAR | null   |     2 | t
 Evénements     | NAVBAR | null   |     3 | t
 Galerie        | NAVBAR | null   |     4 | t
 Contact        | NAVBAR | null   |     5 | t
 Messages       | NAVBAR | null   |     6 | t
 Admin          | NAVBAR | null   |     7 | t
 Informations   | NAVBAR | <id>   |     1 | t
 Résultats      | NAVBAR | <id>   |     2 | t
```

#### 3. Tester la navbar

1. **Desktop** :
   - [ ] Ouvrir https://www.amaki.fr/
   - [ ] Vérifier que "Scrutin" apparaît avec un chevron (▼)
   - [ ] Survoler "Scrutin" → Le dropdown s'ouvre
   - [ ] Cliquer sur "Informations" → Redirection vers `/extrat`
   - [ ] Cliquer sur "Résultats" → Redirection vers `/resultats`
   - [ ] Vérifier qu'il n'y a **pas de scroll horizontal**

2. **Mobile** :
   - [ ] Ouvrir le menu burger (☰)
   - [ ] Vérifier que "Scrutin" est en gris (non cliquable)
   - [ ] Vérifier que "Informations" et "Résultats" sont indentés
   - [ ] Cliquer sur "Informations" → Le menu se ferme et redirige

3. **Menus électoraux désactivés** :
   - [ ] Aller dans `/admin/settings`
   - [ ] Désactiver "Menus électoraux"
   - [ ] Retourner sur la page d'accueil
   - [ ] Vérifier que "Scrutin" n'apparaît plus dans la navbar

#### 4. Vérifier les performances

```bash
# Temps de réponse de la page d'accueil
curl -w "@-" -o /dev/null -s https://www.amaki.fr/ <<'EOF'
    time_namelookup:  %{time_namelookup}\n
       time_connect:  %{time_connect}\n
    time_appconnect:  %{time_appconnect}\n
   time_pretransfer:  %{time_pretransfer}\n
      time_redirect:  %{time_redirect}\n
 time_starttransfer:  %{time_starttransfer}\n
                    ----------\n
         time_total:  %{time_total}\n
EOF
```

**Attendu** : `time_total` < 2s

## ⚠️ Résolution de problèmes

### Erreur : "Cannot find module '@radix-ui/react-dropdown-menu'"

**Cause** : Dépendance manquante

**Solution** :
```bash
npm install @radix-ui/react-dropdown-menu
npm run build
pm2 restart amakifr
```

### Erreur : "PrismaClientValidationError: Invalid value for parent"

**Cause** : Le client Prisma n'est pas à jour

**Solution** :
```bash
npx prisma generate
npm run build
pm2 restart amakifr
```

### Les sous-menus n'apparaissent pas

**Diagnostic** :
```bash
psql -h localhost -U postgres -d amakifr -c "
SELECT COUNT(*) FROM menus WHERE parent IS NOT NULL;
"
```

**Attendu** : `2` (ou plus)

**Si 0** : Re-seeder
```bash
bash scripts/seed-menus-auto.sh
```

### Le dropdown ne s'ouvre pas (desktop)

**Cause possible** : Cache du navigateur ou build incomplet

**Solutions** :
1. Vider le cache du navigateur (Ctrl+Shift+R)
2. Rebuild l'application :
   ```bash
   rm -rf .next
   npm run build
   pm2 restart amakifr
   ```

### Menu "Scrutin" toujours visible même si menus électoraux désactivés

**Diagnostic** :
```bash
psql -h localhost -U postgres -d amakifr -c "
SELECT libelle, electoral FROM menus WHERE libelle = 'Scrutin';
"
```

**Attendu** : `electoral = true`

**Si `false`** : Mettre à jour
```bash
psql -h localhost -U postgres -d amakifr -c "
UPDATE menus SET electoral = true WHERE libelle = 'Scrutin';
"
```

### Application ne démarre pas après déploiement

**Vérifier les logs** :
```bash
pm2 logs amakifr --lines 100 --err
```

**Erreurs fréquentes** :
- `MODULE_NOT_FOUND` → `npm install`
- `Build failed` → `rm -rf .next && npm run build`
- `Database connection` → Vérifier PostgreSQL

## 🔄 Rollback (Si nécessaire)

### Rollback du code

```bash
cd /sites/amakifr
git log --oneline -5  # Trouver le commit précédent
git checkout <commit-hash-avant-menus-hierarchiques>
npm install
npm run build
pm2 restart amakifr
```

### Restaurer les menus depuis la sauvegarde

```bash
# Supprimer les menus actuels
psql -h localhost -U postgres -d amakifr -c "DELETE FROM menus;"

# Restaurer depuis le backup
psql -h localhost -U postgres -d amakifr < /tmp/menus_backup.sql
```

## 📊 Métriques de succès

Après le déploiement, vérifier :

- ✅ **Scroll horizontal** : Disparu sur tous les écrans (tester jusqu'à 1024px de large)
- ✅ **Temps de chargement** : Pas d'augmentation significative (< 50ms)
- ✅ **Erreurs JS** : Aucune dans la console du navigateur
- ✅ **Accessibilité** : Navigation au clavier fonctionnelle (Tab → Entrée)
- ✅ **Mobile** : Sous-menus visibles et cliquables

## 🎯 Checklist finale

- [ ] Code pulé depuis `main`
- [ ] Dépendances installées (`npm install`)
- [ ] Client Prisma généré (`npx prisma generate`)
- [ ] Menus re-seedés (`bash scripts/seed-menus-auto.sh`)
- [ ] Application buildée (`npm run build`)
- [ ] Application redémarrée (`pm2 restart amakifr`)
- [ ] Tests manuels (desktop + mobile)
- [ ] Vérification des logs (pas d'erreur)
- [ ] Performance vérifiée (temps de réponse OK)
- [ ] Documentation lue (`docs/MENUS_HIERARCHIQUES.md`)

## 📞 Support

En cas de problème :

1. **Logs** : `pm2 logs amakifr`
2. **Status** : `pm2 status`
3. **Redémarrage forcé** : `pm2 restart amakifr --update-env`
4. **Database** : `psql -h localhost -U postgres -d amakifr`
5. **Rollback** : Voir section ci-dessus

---

**Date** : 2026-01-13  
**Version** : 1.0.0  
**Impact** : Faible (amélioration UX uniquement)  
**Downtime requis** : Non (déploiement à chaud possible)  
**Durée estimée** : 5-10 minutes
