# Déploiement production frais-avances — runbook sécurisé

**État** : lot de sécurisation pré-déploiement (local).
**Flags** : `NOTES_FRAIS_ENABLED` / `NEXT_PUBLIC_NOTES_FRAIS_ENABLED` restent **off**.
**Production** : migrations 4.x **non appliquées** tant que la répétition n’est pas verte.
**Git** : aucun `git add` / commit / push tant que la revue pré-staging n’est pas GO.

---

## Anomalie migration orpheline (dossier ABSENT du dépôt)

| Champ | Valeur |
|-------|--------|
| Nom de la ligne `_prisma_migrations` | `20251204181751_add_unique_adherent_assistance_periode` |
| Checksum historique (SHA-256 du `migration.sql`) | `e352963e4d64ba9980bb25f45d60604dee386cefc95c7bfd73e15c495a7fe512` |
| Origine Git | ajout dans `5978376`, suppression dans `d65880c` |
| Contenu | **doublon bit-à-bit** de `20250101100000_initial_schema/migration.sql` (pas un `ADD UNIQUE`) |
| Dossier dans le dépôt | **ABSENT** (volontairement) |
| Ligne en production | déjà `finished` |

### Pourquoi le dossier reste absent

1. Le restaurer casse les installations **depuis zéro** (collision avec `initial_schema`).
2. Le remplacer par un autre SQL **changerait le checksum** historique attendu par Prisma.
3. La production a déjà la ligne `finished` : **ne pas** modifier / supprimer `_prisma_migrations` sans **procédure DBA** écrite et validée.
4. Interdit : `migrate resolve`, `UPDATE`/`DELETE` manuel improvisé sur `_prisma_migrations`.

### Preuves obligatoires

| Preuve | Contenu | Statut |
|--------|---------|--------|
| **A** | Base vide + **46** dossiers migrations présents → `prisma migrate deploy` OK + status up to date | **OK** (2026-09-18, Docker `127.0.0.1:55432`, 46 finished, base jetable droppée) |
| **B** | Copie **restaurée** de production (ligne orpheline présente, dossier **absent**) → `prisma migrate deploy` des quatre migrations 4.x | **en attente** — restauration autorisée uniquement ; ne pas inventer la ligne |

Si **B** échoue parce que Prisma refuse l’historique absent : **STOP bloquant**. Rapporter l’erreur exacte pour décision DBA. Ne pas contourner.

Conséquence documentaire : **46** dossiers normaux dans Git ; une copie prod peut avoir **47** lignes `finished` (46 + orpheline).

---

## Répétition obligatoire (copie isolée)

**Ne pas** donner `CREATEDB` à l’utilisateur applicatif `hubert`.

1. Admin (`postgres`) crée littéralement :
   `amakifr_migration_rehearsal_4x_YYYYMMDD`
   avec `OWNER hubert`.
2. Accès **local VPS uniquement** ; **aucun** branchement PM2 vers cette base.
3. Dump custom prod → restore vers la copie (`RESTORE_TARGET_DB=...`, `RESTORE_HOST=127.0.0.1`).
4. Comparer compteurs de lignes (tables métier critiques).
5. Vérifier `current_database` / `current_user`.
6. `EXPECTED_GIT_SHA` (40 hex = `origin/main`) + `DATABASE_URL` **uniquement** la copie → preuve **B** puis contrôles 4.x.
7. Contrôles index/CHECK/seed ACTIVE 4.10.
8. Smoke backend **sans** push/notif.
9. `DROP DATABASE` par admin après confirmation littérale du nom + rapport conservé.

### Gardes DROP / nom

- Préfixe exact : `amakifr_migration_rehearsal_4x_`
- Refus : `amakifr`, `postgres`, `template0`, `template1`
- Host : `localhost` / `127.0.0.1` uniquement (sauf `ALLOW_REMOTE_RESTORE_HOST=1` volontaire)

---

## Sauvegarde exigée (atomique)

- `pg_dump -F c` vers fichier créé par **`mktemp -p <BACKUP_DIR>`** (même filesystem)
- Vérification anti-symlink + `chmod 600` ; trap de nettoyage du temp
- exit 0, taille non nulle, `pg_restore -l`, SHA-256
- Renommage **atomique** dump + `.sha256` seulement après validation
- Chemin final via **variable** / `--print-path` — **jamais** `ls -t`
- Paire dump/checksum conservée ensemble
- **Aucune** rétention (`clean`) pendant le déploiement critique (`ALLOW_BACKUP_CLEAN=1` requis hors fenêtre)

---

## Ordre sécurisé (`scripts/deploy-production-safe.sh`)

1. **Contrôles Git** (cwd, fetch, SHA 40 = `origin/main`, dirty tracked/index, inventaire untracked) — **avant** toute indisponibilité / dump
2. Préflight PM2=`amakifr`, cwd PM2, flags off, disque, orpheline absente, URLs maint + smoke
3. Maintenance ON + HTTP **exactement 503**
4. **`pm2 stop amakifr`** + vérification **stopped**
5. Backup atomique (`mktemp` même répertoire) + checksum + TOC
6. `git switch --detach` (**sans** `-f`)
7. `npm ci`
8. `prisma generate`
9. **build** (flags off)
10. pre-migrate SQL si présent (**STOP**) + **`prisma migrate deploy`**
11. Contrôles SQL (**STOP**)
12. Seeds si `ALLOW_SEEDS=1` (**STOP**)
13. `pm2 restart` + **`pm2 save` bloquant** (**STOP** ; maint reste ON si save échoue)
14. Smoke (`SMOKE_URL` validée comme maint) + `deploy:check` (**STOP**)
15. Maintenance OFF **uniquement** si tout vert

### En échec

- Dépôt Git invalide / dirty → **STOP sans** maintenance ni dump
- Après activation : maintenance **reste ON**
- PM2 **reste stopped** (sauf si restart déjà fait)
- Si `pm2 save` échoue après restart : process up, **persistance non garantie**, maint **ON**
- **Aucun** trap ne fait `maintenance-off` ni restart auto
- Restore = **décision humaine** ; dump prêt
- **Aucune** réparation Prisma improvisée

Variables obligatoires : `EXPECTED_GIT_SHA` (40 hex), `MAINTENANCE_CHECK_URL`, `SMOKE_URL`.
Hôtes : `MAINTENANCE_ALLOWED_HOST` / `SMOKE_ALLOWED_HOST` (défaut `amaki.fr`).
Aucun `db push`. Aucune activation de flags.

---

## Critères STOP / rollback

| Situation | Action |
|-----------|--------|
| Flag `true` (shell / fichier / PM2) | STOP |
| PM2 ≠ `amakifr` / cwd ≠ `/sites/amakifr` / non stopped après stop | STOP |
| Maintenance ≠ 503 / URL invalide | STOP |
| Dump / checksum / TOC fail | STOP |
| Tracked/index dirty | STOP |
| SHA ≠ 40 hex ou ≠ `origin/main` | STOP |
| Build / pre-migrate / migrate / postflight / seed / restart / smoke fail | STOP — maint ON, PM2 stopped |
| Schéma migré + échec ultérieur | Décision humaine avant de relancer un process |

---

## Déploiement production = séparé

1. Preuve **A** locale OK
2. Preuve **B** sur copie restaurée OK (sinon STOP DBA)
3. Annonce fenêtre
4. Exécution du script sur prod avec les mêmes gardes
5. Pas d’activation module frais-avances dans ce lot

Voir aussi : `docs/frais-avances/MIGRATIONS-4x.md`, `GUIDE.md`.
