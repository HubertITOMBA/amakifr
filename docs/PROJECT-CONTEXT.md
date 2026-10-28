# AMAKI — Contexte permanent du projet

Dernière mise à jour : 2026-10-28

## Baselines (ne pas confondre)

| Portée | SHA / version | Statut |
|--------|---------------|--------|
| Commit fonctionnel R1 Lot 1 | `ed253fd` | `feat(cotisations): compute reminder eligibility` — calcul d’éligibilité |
| Commit fonctionnel R1 Lot 2 (preview initial) | `773a5c4` | `feat(cotisations): add dry-run debt reminder preview for ADMIN and PRESID` — parent `f2dc638` |
| Correction Actualiser / libellés (Lot 2) | `aa08df9` (`aa08df96d759a0ebc22548f2af7b91f165314d0c`) | `fix(cotisations): clarify debt reminder preview refresh feedback` |
| Exclusion entité Assistance du rappel/preview | `b8c4edd` | `fix(cotisations): exclude received assistance from reminder debt` — **`origin/main`** |
| Production web / backend **attendue** | `b8c4edd` | Lots 1+2 + Actualiser + exclusion Assistance rappel (vérifier VPS avant toute mutation) |
| Commit embarqué dans l’AAB store | `7e4e51e` | `chore(mobile): exclude local assets from EAS builds` |
| Application Android Play Store **publiée** | `1.1.0` / `versionCode` `3` | Production 100 %, disponible sur Google Play depuis le 27 oct. 2026 01:05 |

**Règle** : M1 et M2 restent **en production web/backend** et **publiés sur le Play Store** (`1.1.0` / code `3`). Distinguer : `ed253fd` (Lot 1), `773a5c4` (Lot 2), `aa08df9` (Actualiser), `b8c4edd` (exclusion Assistance **rappel**). Totaux compte (`getCumulDette` / self lines/year) : correctif **local / non commité / non déployé** (worktree `fix/r1-totals-exclude-assistance-from-debt`).

> Ce document évite de répéter les audits déjà conclus. Il ne remplace pas les vérifications d’état courantes avant une mutation de production. En cas de contradiction entre ce document, le dépôt Git et l’état réel du VPS, arrêter l’opération, signaler l’écart et vérifier avant d’agir.

---

## Point de reprise — release Android 1.1.0 **clôturée**

La pause et le plan « piste interne → promo prod » sont **terminés**.

- Play Store Production : `fr.amaki.app` `1.1.0` / `versionCode` `3` — statut « Disponible sur Google Play », déploiement **100 %**, 1 pays/région.
- Recette **depuis Google Play** réussie (version installée `1.1.0`) :
  - connexion / session OK ;
  - API production HTTPS, aucun LAN / cleartext ;
  - M1 reset mot de passe OK ;
  - M2 badge / lecture CR OK ;
  - dépublication web → badge disparu OK ;
  - notifications / non-régression OK.
- Build EAS production :
  - ID `ee1ca777-aae1-4dc0-a795-5396707ed6a1` ;
  - commit embarqué `7e4e51e` ;
  - SHA-256 AAB `8288f9d4ec7c1942f4628c1d5cb5eae80d82d4b25a5751d90e234e8af1c6cf93`.
- Release Android **clôturée** ; pas de nouvelle release Android en cours.
- **Aucun** changement mobile/Expo dans le chantier R1 Lots 1+2 ; version Play Store **inchangée**.

---

## Point de reprise — R1 rappels cotisations/dettes

**ÉTAT AU 2026-10-28 — production `c95e611` ; Lot 3 en préparation locale (worktree) — non commité / non activé**

| Lot | État | SHA / remarque |
|-----|------|----------------|
| Lot 1 — calcul d’éligibilité | **Commité** + chaîne Lot 2 | `ed253fd` ; sources rappelables **corrigées** ensuite |
| Lot 2 — prévisualisation admin dry-run | **Commité** + déployé | Preview `773a5c4` ; Actualiser `aa08df9` |
| Exclusion Assistance (rappel) | **Production / `origin/main`** | Chaîne jusqu’à `b8c4edd` puis totaux `c95e611` |
| Totaux dette compte (F1–F3 + ownership S1) | **Production / `origin/main`** | `c95e611` — Obligations legacy **conservées** dans ces totaux |
| Lot 3 — envoi manuel | **Socle versionnable, non activé** | Branche `fix/r1-lot3-realign-on-c95e611` (base `c95e611`) ; services d’envoi **non branchés** (pas d’UI / action / cron) ; **aucune** migration appliquée aux bases applicatives |

### Distinction production vs WIP local (2026-10-28)

| Surface | Contenu |
|---------|---------|
| **Production / `origin/main` @ `c95e611`** | Lots 1+2 ; rappel/preview **sans** entité Assistance comme dette ; totaux compte F1–F3 + ownership S1 ; **aucun** Lot 3 activé en runtime prod tant que ce code + migration ne sont pas déployés |
| **WIP local principal @ `1455af5` + fichiers non suivis** | Broader WIP Lot 3 historique (peut encore contenir d’anciennes hypothèses) — **ne pas** confondre avec la greffe réalignée |
| **Branche Lot 3 réalignée** | Sources rappel = **CM** (y compris CM assistance **dues par des tiers**) + **DetteInitiale** ; **Assistance reçue exclue** ; services d’envoi (réservation / outcome email / notif interne) **présents mais non branchés** ; migration `20261027190000_rappel_dette_envoi` **dans le dépôt**, **non appliquée** à `amakifr_db` / `amakifr` / `amakifr_vcl` |

#### Garde-fous Lot 3 (socle inactif)

- **Services d’envoi non branchés** : aucun appel depuis `app/` / actions / cron ; email-outcome et notification hors barrel public.
- **Preview / `computeDetteRappelable`** : le calcul (donc la preview dry-run qui l’utilise) lit désormais aussi `RappelDetteEnvoi` pour le cooldown (preuve `Accepted` + `emailAcceptedAt`). **Déployer ce code sans la migration** fait échouer la lecture Prisma (fail-closed / erreur table absente).
- **Migration obligatoire avant déploiement** de ce code sur un environnement : appliquer `20261027190000_rappel_dette_envoi` **avant** ou **avec** la mise en service du binaire — **jamais** le code seul sur une base sans table.
- **Bases applicatives** : à la date de ce socle, **aucune** migration Lot 3.1 n’a été appliquée à `amakifr_db` / `amakifr` / `amakifr_vcl`.
- **Production courante** : `origin/main` / prod rappel+totaux = **`c95e611`** (sans Lot 3 runtime).

### Lot 1 (commité — `ed253fd`)

- Service serveur lecture seule :
  `lib/services/cotisations/rappel-dette/`
  (`computeDetteRappelable` + calendrier Europe/Paris + résolveurs d’échéance + tests).
- Commit : `ed253fd` — `feat(cotisations): compute reminder eligibility`.
- **Aucun** schéma / migration / UI d’envoi / cron / mobile / email / push dans ce lot.
- Calcul Lot 1 **inchangé** par le Lot 2 et par la correction Actualiser/libellés.

#### Périmètre métier retenu

| Inclure | Exclure |
|---------|---------|
| `CotisationMensuelle` (y compris CM catégorie Assistance dues par des **tiers**) | `ObligationCotisation` (**legacy**, exclusion explicite) |
| `DetteInitiale` | Entité Prisma `Assistance` (prestation versée au bénéficiaire — **pas** une dette) |

> **Correction rappel 2026-10-28** (`b8c4edd` sur `origin/main`) : l’historique Lot 1 (`ed253fd`) incluait à tort l’entité `Assistance` comme source de dette du bénéficiaire. Décision : Assistance = prestation de l’association au bénéficiaire — **pas** une dette. Les CM d’assistance dues par des tiers restent des dettes. Ne pas réécrire l’historique `ed253fd` comme s’il avait déjà cette règle.

#### Règles d’éligibilité (Lot 1)

- Dette **nette** = max(0, brut retenues − avoirs `Disponible`).
- Éligible à **J+15** (jours civils `Europe/Paris`) après échéance.
- `DetteInitiale` année N : échéance technique **01/01/(N+1) 00:00 Europe/Paris** (pas `createdAt`).
- Lignes avec paiement `EnAttente` ou `EnCours` **exclues**.
- User / adhérent **Actif** uniquement.
- Bénéficiaire d’une assistance sur CM : exclu selon règle métier existante (`adherentBeneficiaireId === adherentId`).
- Cooldown **30 jours** uniquement avec **preuve d’envoi réussi** :
  `RelanceCotisationMensuelle.statut ∈ {Envoye, Lu, Repondu}` **et** `dateEnvoi` non null.
  `EnAttente` / échec / absence de preuve → ne bloquent pas.
- Gel / contestation : paramètres serveur internes (`frozenAdherent`, `frozenLineKeys`) — **pas de persistance** Prisma à ce stade.
- **Totaux compte** (`getCumulDette`, résumés `getMyCotisationLines` / `getMyCotisationYear`) : correctif F1–F3 + ownership S1 **local / non commité / non déployé** (pas d’entité Assistance dans la dette bénéficiaire ; Obligations legacy **conservées** dans ces totaux — périmètre ≠ rappel). **Totaux admin** synthèse / `getFinancialStats` prestations : **non corrigés** dans ce lot.

#### Limites Lot 1 (toujours valables)

- Les producteurs actuels créent des relances en `EnAttente` **sans** marquer `Envoye` / `dateEnvoi` → cooldown **pas encore opérationnel** en conditions réelles.
- Historique d’envoi fiable + marquage preuve Lot 3 (`RappelDetteEnvoi` Accepted) : **en préparation locale** dans le worktree réaligné — **non commité / non activé / non déployé**.
- Aucun champ persistant de contestation / gel.

### Lot 2 (preview dry-run — déployé)

Prévisualisation administrateur dry-run : route `/admin/finances/rappels-preview`.

- Accès **ADMIN et PRESID** uniquement (helper `canAccessPreviewRappelsDette`) avec **garde serveur** avant toute lecture métier ; **permissions globales inchangées**.
- **Écart consignable** : plein accès général président souhaité vs bypass `authorize` **ADMIN seul** / `ROLE_PERMISSIONS` PRESID partiel — **non** corrigé hors Lot 2.
- **Sans** mutation métier, **sans** création de relance, **sans** envoi (email / notification / push) ; **aucun envoi de rappel ni automatisation** ; Lot 3 **non activé** en production (préparation locale worktree seulement).
- Motifs FR ; exclusions métier ≠ échecs techniques ; « Non calculé » + totaux partiels.
- Présentation : montants EUR à **deux décimales** ; homonymes distingués (« Fiche N ») ; tableaux avec défilement horizontal vérifiés en local.
- Libellés : « Non éligibles » / « Adhérents non éligibles au rappel » + sous-titre explicatif (correction `aa08df9`).
- Actualiser : toast succès après clic manuel ; `computedAt` date+heure+secondes Europe/Paris (instant serveur) ; pas de toast au chargement initial (couvert par tests).
- Validation ciblée Lot 2 initial : **91** tests ; tsc comparatif **11** communs / **0** ajouté ; correction Actualiser : **24** tests ciblés ; **compilation TypeScript globale non validée** (ne pas affirmer le contraire).
- PRESID / rôles refusés : **couverts par tests** ; **non vérifiés au navigateur**.
- Effet transitif : `auth()` → Redis `updateSessionActivity` (hors métier).
- **Aucune** migration Prisma dans Lot 1, Lot 2 ni la correction Actualiser.
- Chaîne Git : parent Lot 2 `f2dc638` → `773a5c4` → `aa08df9` (**SHA applicatif déployé**).

### Recette utilisateur production (confirmée)

- Bannière « Prévisualisation — aucun envoi » : **OK**.
- Toast après Actualiser : **OK**.
- Date/heure de référence (secondes, Europe/Paris) et évolution entre Actualiser : **OK**.

### Déploiements sécurisés associés (rappel)

- Sauvegardes PostgreSQL custom validées (checksum + `pg_restore -l`) lors des déploiements Lot 2 / correction.
- **Aucune** migration appliquée (schéma déjà à jour).
- PM2 `amakifr` stable, cwd `/sites/amakifr` ; écoute `127.0.0.1:9060` ; maintenance **OFF** ; HTTP interne/public **200** ; flags Notes de frais **true/true**.

### Décisions produit R1 (v1)

- Validation **admin obligatoire** avant tout envoi.
- Canaux futurs v1 : **email + notification interne** (pas de SMS ; push hors v1 sauf lot dédié).
- Fréquence max : **1 / 30 jours / adhérent**.
- Ton **factuel et neutre** (pas de wording culpabilisant / menaces ROI dans le canal v1).
- **Automatisation hors v1** (après preview + envoi manuel + recette).

### Prochaine étape

- **Lot 3** (envoi manuel idempotent) : socle sur branche dédiée ; **pas** d’activation app/cron ; **pas** d’application de migration aux bases applicatives sans autorisation explicite ; déployer code + migration ensemble (voir garde-fous ci-dessus).
- Ne pas lancer d’anciens producteurs de relances comme substitut du Lot 3.
- Validation PG isolée : bases jetables préfixées uniquement (`amakifr_r1_lot3_*_test_*`) — jamais `amakifr_db` / `amakifr` / `amakifr_vcl`.

---

## 1. Projet et environnements

| Élément | Valeur |
|---------|--------|
| Dépôt de développement local | `/soft/dev/nextjs/amakifr` |
| Dépôt de production VPS | `/sites/amakifr` |
| Worktree de déploiement/rehearsal | `/sites/amakifr-rehearsal-4x` |
| Branche de référence | `origin/main` |
| Application PM2 de production | `amakifr` |
| Répertoire PM2 attendu | `/sites/amakifr` |
| Port interne Next.js | `9060` |
| URL publique | `https://amaki.fr/` |
| Base PostgreSQL de production | `amakifr` |
| Base PostgreSQL de développement | `amakifr_db` |

Ne jamais afficher ni versionner les secrets de `.env`.

---

## 2. Règles Git et déploiement

**PROCÉDURES OPÉRATIONNELLES**

- Toujours vérifier `origin/main`, le SHA attendu, le worktree propre et l’absence de changements suivis avant déploiement.
- Les nombreux fichiers non suivis présents dans le dépôt appartiennent à l’utilisateur : ne jamais les ajouter avec `git add .` ou `git add -A`.
- Toujours indexer les fichiers par chemins explicites.
- Ne jamais utiliser `git reset --hard`, `git checkout -f` ou une suppression globale.
- Le déploiement sécurisé utilise les scripts du worktree cible, pas une ancienne version présente dans le checkout de production.
- Effectuer une sauvegarde PostgreSQL custom validée avant toute migration ou changement risqué.
- Les dumps sont créés atomiquement avec `mktemp`, permissions `600`, validation `pg_restore -l` et checksum SHA-256 adjacent.
- Le checksum doit référencer le chemin final du dump, jamais le nom temporaire.
- Ne jamais modifier directement `_prisma_migrations` hors procédure DBA documentée avec gardes.
- Ne jamais effectuer de mutation métier directement en SQL lorsque le parcours applicatif existe.
- Pendant un échec de déploiement : conserver la maintenance active et ne pas redémarrer automatiquement sans diagnostic.
- Les commandes susceptibles d’échouer doivent être lancées dans un sous-shell lorsqu’elles contiennent `exit`, afin de ne pas fermer la session SSH interactive.

---

## 3. Nginx et maintenance

**DÉCISIONS D’ARCHITECTURE ET DE SÉCURITÉ / PROCÉDURES**

- Nginx charge `/etc/nginx/conf.d/*.conf`.
- Configuration AMAKI active : `/etc/nginx/conf.d/amaki.conf`.
- Le mode maintenance public repose sur `/sites/amakifr/maintenance.flag`.
- Nginx doit retourner HTTP `503` lorsque ce fichier existe.
- L’utilisateur Nginx dispose seulement du droit de traversée nécessaire sur `/sites/amakifr` via ACL.
- Scripts :
  - `scripts/maintenance-on.sh`
  - `scripts/maintenance-off.sh`
- Toujours vérifier le `503` public avant d’arrêter PM2.
- Smoke interne : `http://127.0.0.1:9060/`.
- Next production doit écouter uniquement `127.0.0.1:9060` (`next start -H 127.0.0.1 -p 9060`) — jamais `0.0.0.0:9060`.
- Nginx est l’unique entrée publique. `TRUST_PROXY` exige la conf **effective** (`nginx -T`), pas seulement le fichier versionné.
- `deploy/nginx/amaki.conf` est une **référence / checklist** : le déploiement ne la copie pas automatiquement vers `/etc/nginx`.
- Fermeture `9060/tcp` firewalld : étape **humaine contrôlée** après preuve loopback.
- Le smoke interne utilise des tentatives bornées car Next.js peut démarrer en plus de 20 secondes.
- Après ouverture, vérifier plusieurs réponses publiques `200/3xx` ; en cas d’échec, restaurer immédiatement le flag de maintenance.

**État runtime validé au déploiement M1/M2 (2026-10-09)**

- AMAKI Nginx : upstream `127.0.0.1:9060` ; `X-Real-IP $remote_addr` ; `X-Forwarded-For $proxy_add_x_forwarded_for`.
- Next écoute uniquement `127.0.0.1:9060`.
- firewalld : `9060/tcp` retiré en runtime **et** permanent.
- HTTP interne / public : `200` ; PM2 `amakifr` online / stable.
- Fichier invalide `mombongo.conf` déplacé de façon **récupérable** vers :
  `/etc/nginx/conf.disabled/mombongo.conf.disabled.20261009_173112`
- Dette séparée (hors AMAKI) : avertissements Nginx de `server_name` dupliqué `naxhel.fr`.

---

## 4. Module Notes de frais — livré et validé

**LIVRÉ ET VALIDÉ**

- Module activé en production.
- Variables attendues (noms et valeurs de feature flags uniquement ; jamais le reste de `.env`) :
  - `NOTES_FRAIS_ENABLED=true`
  - `NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true`
  - `NOTES_FRAIS_STORAGE_ROOT=/sites/amakifr-data/notes-frais`
- Stockage privé hors dépôt :
  - `/sites/amakifr-data/notes-frais`
  - sous-répertoires `tmp`, `notes`, `archive`
  - répertoires en `700`
  - fichiers justificatifs en `600`
  - propriétaire `hubert:hubert`
- Ne jamais stocker les justificatifs dans `public/` ou `.next/`.
- Quatre migrations 4.x Notes de frais sont appliquées.
- Une politique de conservation ACTIVE existe avec P1/P2/P3 à 10 ans et rapports sans échéance activés.
- Les quatre menus sont provisionnés par le CLI idempotent :
  `scripts/frais-avances-menus-seed.ts`.
- Rôles :
  - lecture des notes soumises : `ADMIN`, `PRESID`, `SECRET`, `TRESOR` ;
  - décision et exécution : `ADMIN`, `TRESOR` uniquement ;
  - lecture comptable : `ADMIN`, `TRESOR`, `COMCPT`.
- `SECRET` et `PRESID` peuvent consulter mais ne peuvent pas valider, rejeter ou exécuter.
- Un brouillon peut exister sans justificatif.
- La soumission exige côté serveur :
  - zéro justificatif `PENDING` ;
  - au moins un justificatif `READY`.
- L’interface affiche cette obligation et désactive Soumettre sans justificatif READY.
- Les traitements outbox et fichiers ont été validés en production.
- Les notifications de soumission et de rejet ont été validées.
- Les suppressions ou corrections de données de recette doivent passer par l’interface métier, jamais par SQL.

---

## 5. Sauvegarde et restauration

**PROCÉDURES OPÉRATIONNELLES / DÉCISIONS DE SÉCURITÉ**

- Script durci : `scripts/db-backup-restore.sh`.
- Déploiement sécurisé : `scripts/deploy-production-safe.sh`.
- Gardes : `scripts/lib/deploy-guards.sh`.
- Tests des gardes : `scripts/tests/deploy-guards.test.sh`.
- Le déploiement sécurisé de production **exige et préserve** les deux flags Notes de frais actifs (`NOTES_FRAIS_ENABLED=true` et `NEXT_PUBLIC_NOTES_FRAIS_ENABLED=true`) en shell, fichiers env applicables et PM2 — contrôles au préflight, avant build, avant restart et après restart.
- Le préflight refuse un stockage privé Notes de frais absent ou invalide (`NOTES_FRAIS_STORAGE_ROOT=/sites/amakifr-data/notes-frais`, répertoires `tmp`/`notes`/`archive`, pas de symlink, accès lecture/écriture/traversée).
- Aucun contournement de ces gardes n’est autorisé ; il est interdit de désactiver temporairement le module pour déployer.
- Une restauration en production exige une décision humaine et la double confirmation prévue par les gardes.
- Les bases de rehearsal doivent respecter le préfixe :
  `amakifr_migration_rehearsal_4x_`.
- Refuser comme cibles ordinaires : `amakifr`, `postgres`, `template0`, `template1`.
- Les opérations rehearsal/restauration sont limitées au loopback sauf autorisation explicite.

**Dumps du lot M1/M2 (2026-10-09) — chemins VPS**

- Avant réconciliation migrations / pré-déploiement :
  `/sites/amakifr/backups/amakifr-pre-m1m2-20261009_180622.dump`
- Dump principal du déploiement :
  `/sites/amakifr/backups/amakifr_custom_20261009_185741.dump`
- Dump hotfix reset (navigation `/auth/new-password`) :
  `/sites/amakifr/backups/amakifr_custom_20261009_214236.dump`
- Logs de déploiement conservés sous `/sites/amakifr/backups/`.
- `.env` production sauvegardé ; `MAINTENANCE_MODE` dédupliqué à `false`.
- Aucun rollback nécessaire.

**Dumps R1 Lot 2 / correction Actualiser (2026-10-27) — chemins VPS**

- Déploiement Lot 2 (`773a5c4`) :
  `/sites/amakifr/backups/amakifr_custom_20261027_174258.dump`
- Déploiement correction Actualiser (`aa08df9`) :
  `/sites/amakifr/backups/amakifr_custom_20261027_185237.dump`
- Chaque dump : permissions `600`, checksum SHA-256 adjacent validé, `pg_restore -l` OK.

---

## 6. Application mobile Android

### Play Store public — `1.1.0` / code `3` (livré)

- Package : `fr.amaki.app`
- Google Play : `https://play.google.com/store/apps/details?id=fr.amaki.app`
- Version publique : `1.1.0` / `versionCode` `3`
- Publiée le **27 octobre 2026 à 01:05** — statut « Disponible sur Google Play », déploiement Production **100 %**, 1 pays/région.
- API store : `https://amaki.fr` ; cleartext **false**.
- Commit embarqué dans l’AAB : `7e4e51e`.
- Build EAS : `ee1ca777-aae1-4dc0-a795-5396707ed6a1`
- SHA-256 AAB : `8288f9d4ec7c1942f4628c1d5cb5eae80d82d4b25a5751d90e234e8af1c6cf93`
- Recette depuis Google Play (2026-10-27) : connexion/session, M1, M2, dépublication web, notifications — **OK**.
- Recette historique AMAKI Dev contre prod et build Dev `36099ef3-fa3c-40d5-96db-a34166676f27` : conservées comme jalons antérieurs.
- `mobile/.env` local : LAN DEV (ne pas re-pointer vers prod sans procédure).
- Notes de frais mobile : non livré tant qu’un lot API/mobile dédié n’est pas validé.
- R1 Lots 1+2 : **aucun** changement mobile/Expo ; Play Store **inchangé**.

### Dettes Play Console (non bloquantes)

- Optimisation DEX / obscurcissement : ~**1 %** — échéance **février 2027**.
- Bord-à-bord et grand écran : à traiter ultérieurement.

---

## 7. Décisions de sécurité et produit

**DÉCISIONS D’ARCHITECTURE ET DE SÉCURITÉ**

- Ne jamais récupérer, afficher ou envoyer l’ancien mot de passe.
- Parcours « mot de passe oublié » (M1) : code 8 chiffres, usage unique, expirant — **validé en production web et sur Play Store `1.1.0`**.
- Runtime production M1 validé (sans valeurs de secrets) :
  - `PASSWORD_RESET_HMAC_SECRET` : présent, unique, longueur UTF-8 **64** ;
  - `TRUST_PROXY=true` ;
  - chaîne Nginx effective conforme (voir §3).
- Les rappels financiers ne doivent pas exposer de montant sensible sur un écran verrouillé.
- Les rappels mensuels doivent être idempotents et éviter tout doublon.
- Rappels cotisations/dettes (R1) : source de vérité = CM (y compris CM assistance **dues par des tiers**) + `DetteInitiale` ; entité `Assistance` reçue **exclue** ; hors `ObligationCotisation` (décision 2026-10-28, correctif rappel `b8c4edd` / prod `c95e611`) ; validation admin obligatoire en v1 ; automatisation hors v1 ; voir § Point de reprise R1.
- Dette bénéficiaire (compte) : pas d’entité `Assistance` dans `totalDette` / `detteBrute` ; correctif totaux **local non commité** ; totaux admin prestations **non** assimilés.
- La collecte concernant l’origine des connexions doit rester proportionnée :
  plateforme Web/Mobile, type d’appareil, système, dernière activité et éventuellement IP tronquée.
- Définir une durée de conservation avant d’ajouter de nouvelles données de connexion.
- Ne pas transformer ce besoin en journalisation intrusive de toutes les actions utilisateur.
- Lecture mobile des comptes rendus (M2-D) : pas de WebView ; HTML allowlisté → composants React Native ; liens http/https après confirmation ; borne 200 000 caractères.

---

## 8. M1 — Mot de passe oublié (production web + Play Store)

**VALIDÉ EN PRODUCTION WEB/BACKEND ET SUR PLAY STORE `1.1.0`**

- Commit applicatif production web au moment M1/M2 : `8b80809` (historique) ; baseline web courante : `aa08df9` (inclut M1/M2 + R1).
- Migration `20261007220000_password_reset_challenge_security` : **finished**, sans rollback.
- Recette web production :
  - e-mail reçu ;
  - redirection automatique vers `/auth/new-password` validée ;
  - lien « J’ai déjà un code » visible ;
  - saisie code / reset fonctionnels.
- Recette mobile : AMAKI Dev contre `https://amaki.fr` puis **Google Play `1.1.0`** — OK.

---

## 9. M2 — Réunions et comptes rendus (production web + Play Store)

**VALIDÉ EN PRODUCTION WEB/BACKEND ET SUR PLAY STORE `1.1.0`**

- Migration `20261008190000_rapport_reunion_publication_status` : **finished**, sans rollback.
- DRAFT / PUBLISHED + backfill historiques → PUBLISHED ; API Bearer lecture seule ; anti-IDOR.
- Workflow web Brouillon ↔ Publié validé ; hotfix `AlertDialog` dépublication.
- Lecteur mobile sans WebView ; badge uniquement si publié.
- Recette mobile : AMAKI Dev contre prod puis **Google Play `1.1.0`** (badge, lecture, dépublication web) — OK.

---

## 10. Réconciliation Prisma historique (pré-déploiement M1/M2)

**DIVERGENCE DÉTECTÉE PUIS RÉCONCILIÉE — NE PAS RECOMMENCER SANS ANOMALIE**

- Ancienne baseline orpheline
  `20251204181751_add_unique_adherent_assistance_periode`
  et `20250101100000_initial_schema` partageaient le même SQL / checksum
  `e352963e4d64ba9980bb25f45d60604dee386cefc95c7bfd73e15c495a7fe512`.
- Dump vérifié avant réconciliation :
  `/sites/amakifr/backups/amakifr-pre-m1m2-20261009_180622.dump`
- Ligne orpheline supprimée **transactionnellement** avec gardes strictes.
- Après correction : seules M1/M2 étaient pending ; après déploiement : Prisma production **à jour**.
- Ne pas rejouer cette réconciliation sans preuve d’anomalie nouvelle.

---

## 11. Travaux prioritaires

**ÉTAT AU 2026-10-28 (Android clôturée ; `origin/main` / prod applicatif rappel+totaux = `c95e611` ; Lot 3 préparation locale worktree)**

| Priorité | Sujet | État |
|----------|-------|------|
| P0 | Inscription web | Livré en production |
| P1 | Mot de passe oublié (M1) | **Production web + Play Store `1.1.0` OK** |
| P1 | Lecture CR mobile (M2) | **Production web + Play Store `1.1.0` OK** |
| P1 | Rappels cotisations / dettes (R1) Lots 1+2 + exclusion Assistance rappel | **Production `c95e611`** ; dry-run uniquement |
| P1 | Totaux dette compte (Assistance hors dette) | **Production `c95e611`** |
| **Suivant** | R1 Lot 3 — envoi manuel | Socle branche dédiée — **non activé** ; migration non appliquée aux bases app |

### Dettes ouvertes

1. **Rappels cotisations / dettes (R1) Lot 3** — préparation locale worktree ; validation PG jetable puis revue avant commit ; auto hors v1 ; ne pas utiliser d’anciens producteurs de relances.  
1b. Totaux admin synthèse / prestations (`getFinancialStats`, créances avec Assistance) — **non corrigés**.
2. Identification de l’origine des connexions.
3. Copilote IA comptes rendus — **seulement après** stabilisation store M1/M2 ; **non commencé**.
4. Admin reset plaintext (dette produit/sécurité).
5. Politique mot de passe minimum 6 caractères (dette).
6. Play Console : optimisation DEX / obscurcissement (~1 %, échéance fév. 2027) ; bord-à-bord / grand écran.
7. Search Console (analyse ultérieure) :
   - 2 erreurs 5xx historiques sur `/` et `/favicon.ico` — **état actuel HTTP 200**, cinq essais réussis chacun ;
   - autres catégories à analyser : robots.txt 4, redirections 3, doublons canonical 2, explorées non indexées 11.
8. Dette Nginx `naxhel.fr` (`server_name` dupliqué) — hors AMAKI.
9. Nettoyage éventuel des comptes / scripts synthétiques DEV.
10. Compilation TypeScript globale du dépôt : **non validée**.
11. PRESID / rôles refusés preview : tests OK ; **recette navigateur non faite**.

---

## 12. Méthode de travail ChatGPT/Cursor

- Lire ce fichier avant toute opération sur AMAKI.
- Ne pas réauditer ce qui est marqué livré/validé sauf :
  - anomalie nouvelle ;
  - contradiction avec le code ou la production ;
  - changement de dépendance, infrastructure ou exigence ;
  - demande explicite de l’utilisateur.
- Sur le poste de développement AMAKI, les captures de sortie, rapports de tests, diffs de revue et journaux opérationnels générés pendant le travail doivent être écrits sous `/soft/SAS_AMAKIFR`.
- Ne pas les créer dans le dépôt.
- Ne pas utiliser `/tmp` pour les nouveaux artefacts AMAKI lorsque `/soft/SAS_AMAKIFR` est disponible.
- Ne jamais y écrire de secrets ou de contenu intégral de `.env`.
- Cette règle ne change pas à elle seule la configuration des logs runtime PM2/Next.js du VPS.
- Renvoi du code de confirmation d’inscription : réponse non énumérante, cooldown serveur minimal, aucun email/code/token dans les logs applicatifs.
- Confirmation d’email d’inscription — **livrée et validée en production** (baseline historique `cfbe06fb…` puis UX `ddf4f9e…`) :
  - vérification liée à `email + code` ;
  - un seul `VerificationToken` actif par email ;
  - plafond persistant de 3 erreurs ;
  - cooldown de renvoi persistant 60 s.
- Règle permanente : **email confirmé ≠ compte actif** ; activation administrative obligatoire.
- Pour chaque nouveau chantier : diagnostiquer → preuve → changement minimal → tester → revue → commit → push → déployer avec sauvegarde → recette → mettre à jour ce document si décision permanente.
- Ne jamais inscrire dans ce document : secrets, données personnelles, identifiants de comptes, contenu de `.env`, références de notes de frais réelles, chemins temporaires, résultats éphémères sans valeur architecturale, détails d’authentification opérationnelle.

---

## 13. Journal synthétique des décisions permanentes

- **2026-09** : durcissement du déploiement, backup atomique, maintenance Nginx, smoke interne avec retry.
- **2026-09** : migrations Notes de frais 4.x, stockage privé et activation production.
- **2026-09** : rôles Notes de frais confirmés ; justificatif obligatoire à la soumission.
- **2026-10** : application Android `fr.amaki.app` version `1.0.0` / `versionCode` `2` validée en Production Google Play.
- **2026-10** : priorités : inscription web, auth mobile, rapports, rappels, origine des connexions.
- **2026-10** : déploiement sécurisé Notes de frais (gardes) — livré et validé (`f576be2…`).
- **2026-10** : confirmation email sécurisée + UX — livrées en production (`cfbe06fb…`, `ddf4f9e…`).
- **2026-10-07** : refonte UI mobile + œil MDP + splash (`2b11725`) ; Play Store `1.0.0` inchangé.
- **2026-10-09** : M1/M2 validés DEV puis **déployés en production** (`8b80809`) ; migrations password-reset + publication rapports **finished** ; runtime HMAC / `TRUST_PROXY` / loopback / firewalld 9060 ; Prisma réconcilié (orpheline baseline) ; dumps sous `/sites/amakifr/backups/`.
- **2026-10-09** : hotfix web navigation reset → `/auth/new-password` + lien « J’ai déjà un code » (inclus dans prod `8b80809`).
- **2026-10-09/10** : release Android `1.1.0` / code `3` préparée puis AAB EAS production buildé (commit embarqué `7e4e51e`).
- **2026-10-10** : pause ~2 semaines — point de reprise Play documenté.
- **2026-10-27** : Play Store Production `fr.amaki.app` `1.1.0` / `versionCode` `3` **publié** (01:05, 100 %, disponible) ; EAS `ee1ca777-aae1-4dc0-a795-5396707ed6a1` ; SHA-256 AAB `8288f9d4…c6cf93` ; recette Google Play M1/M2 OK ; release Android **clôturée** ; dettes Play DEX (~1 %, fév. 2027) et Search Console (5xx historiques résolus en 200, autres catégories à analyser).
- **2026-10-27** : **R1 Lot 1** livré dans le dépôt (`ed253fd`) — service `lib/services/cotisations/rappel-dette/` (`computeDetteRappelable`) ; sources **à l’époque** CM + DetteInitiale + Assistance (hors ObligationCotisation) ; dette nette / J+15 / … ; 69 tests OK. **Annotation 2026-10-28** : l’inclusion de l’entité `Assistance` était incorrecte ; corrigée sur `origin/main` @ `b8c4edd` (sources rappelables courantes = CM + DetteInitiale uniquement).
- **2026-10-28** : Décision métier — `Assistance` = prestation, pas dette du bénéficiaire ; CM d’assistance des tiers = dettes. Correctif rappel/preview **`b8c4edd`**.
- **2026-10-28** : Correctif totaux compte F1–F3 + ownership S1 fusionné / déployé dans la chaîne jusqu’à **`c95e611`** ; Obligations legacy **conservées** dans ces totaux ; totaux admin synthèse/prestations **non** corrigés ; aucun changement mobile/Expo.
- **2026-10-28** : **Lot 3** — socle inactif sur `fix/r1-lot3-realign-on-c95e611` (base `c95e611`) : sources rappel = CM (tiers) + DetteInitiale ; Assistance reçue exclue ; services envoi **non branchés** ; `computeDetteRappelable` / preview dépendent de `RappelDetteEnvoi` pour le cooldown → **migration obligatoire avant déploiement** ; migration **non appliquée** aux bases applicatives.
- **2026-10-27** : **R1 Lot 2** preview dry-run ADMIN\|PRESID — commit `773a5c4` (parent `f2dc638`) ; route `/admin/finances/rappels-preview` ; sans mutation / relance / envoi ; **91** tests ; tsc 11/0 ; compilation globale non validée ; **aucune** migration ; permissions globales inchangées ; écart bypass président consignable ; **Lot 3 non démarré**.
- **2026-10-27** : Déploiement sécurisé Lot 2 → prod `773a5c4` ; dump `amakifr_custom_20261027_174258.dump` validé ; 0 migration ; PM2 stable ; maintenance OFF ; HTTP 200/200 ; flags Notes de frais true/true ; bannière preview observée en production.
- **2026-10-27** : Correction Actualiser/libellés — commit/push/déploiement `aa08df9` (`aa08df96d759a0ebc22548f2af7b91f165314d0c`) ; dump `amakifr_custom_20261027_185237.dump` validé ; 0 migration ; recette utilisateur prod : toast + date/heure OK ; présentation locale EUR/homonymes/tableaux OK ; PRESID/refusés navigateur non faits ; **aucun** envoi/cron/Lot 3 ; **aucun** changement mobile/Expo.
- **2026-10-27** : Alignement Git confirmé : local = `origin/main` = prod `/sites/amakifr` = `aa08df9`. Clôture documentaire R1 Lots 1+2 (ce fichier) — le SHA du futur commit documentaire sera **distinct** du SHA applicatif déployé `aa08df9`.

---

## Faits temporaires à revérifier

- SHA `origin/main` vs checkout VPS `/sites/amakifr` (rappel+totaux attendus sur chaîne `c95e611` — **revérifier** avant mutation).
- Lot 3 : présent uniquement en worktree local ; **ne pas** confondre avec le WIP principal `1455af5`.
- Présence/absence de `maintenance.flag` ; HTTP public/interne.
- PM2 `amakifr` online ; écoute `127.0.0.1:9060` uniquement.
- Flags Notes de frais + stockage privé (sans afficher d’autres secrets).
- Prisma : migrations M1/M2 `finished` ; R1 **sans** migration nouvelle ; schéma à jour.
- Play Store public : `1.1.0` / code `3` (inchangé par R1 / totaux).
- `mobile/.env` local = LAN DEV.
- R1 : dry-run uniquement ; Lot 3 **suspendu** ; totaux compte correctif local non commité ; ne pas lancer d’anciens producteurs de relances.
