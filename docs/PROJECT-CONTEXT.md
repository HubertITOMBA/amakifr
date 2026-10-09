# AMAKI — Contexte permanent du projet

Dernière mise à jour : 2026-10-09

## Baselines (ne pas confondre)

| Portée | SHA / version | Statut |
|--------|---------------|--------|
| Baseline dépôt / DEV (`origin/main`) | `8b80809` | Validée ; M1/M2 inclus |
| Production web / backend déployée (documentée) | `8b80809` | M1 + M2 déployés et validés en production |
| Application Android Play Store publiée | `1.0.0` / `versionCode` `2` | Encore la version publique actuelle |
| Release Android préparée (non buildée / non publiée) | `1.1.0` / `versionCode` `3` | Prête dans le dépôt ; pas d’EAS / Play Console à ce stade |

**Règle** : M1 (mot de passe oublié) et M2 (réunions / comptes rendus) sont **validés en production web/backend**. Ils ne sont **pas** encore publiés sur le Play Store (`1.0.0` / code `2` reste la version publique).

> Ce document évite de répéter les audits déjà conclus. Il ne remplace pas les vérifications d’état courantes avant une mutation de production. En cas de contradiction entre ce document, le dépôt Git et l’état réel du VPS, arrêter l’opération, signaler l’écart et vérifier avant d’agir.

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
- Ne jamais modifier directement `_prisma_migrations`.
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
- `deploy/nginx/amaki.conf` est une **référence / checklist** : le déploiement ne la copie pas automatiquement vers `/etc/nginx` (risque d’écraser TLS/maintenance plus riches).
- Fermeture `9060/tcp` firewalld : étape **humaine contrôlée** après preuve loopback (documentée, non automatisée).
- Le smoke interne utilise des tentatives bornées car Next.js peut démarrer en plus de 20 secondes.
- Après ouverture, vérifier plusieurs réponses publiques `200/3xx` ; en cas d’échec, restaurer immédiatement le flag de maintenance.

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

---

## 6. Application mobile Android — livrée et validée (Play Store)

**LIVRÉ ET VALIDÉ (piste Production Google Play)**

- Package Android : `fr.amaki.app`
- Google Play : `https://play.google.com/store/apps/details?id=fr.amaki.app`
- Version publique **actuellement** sur le Play Store : `1.0.0`
- `versionCode` public actuel : `2`
- Version de production Play Console actuelle : `2 (1.0.0)`
- Release **préparée** dans le dépôt (non buildée / non soumise) : `1.1.0` / `versionCode` `3` (`fr.amaki.app` inchangé)
- Profil EAS production : `EXPO_PUBLIC_API_URL=https://amaki.fr` (pas d’URL LAN / cleartext en store)
- L’application `1.0.0` reste disponible sur la piste Production jusqu’à publication de `1.1.0`.
- La recette publique stricte a été réalisée après retrait du compte de la piste interne et réinstallation depuis Google Play.
- Tests validés :
  - installation publique ;
  - premier lancement ;
  - connexion ;
  - maintien de session ;
  - notification reçue application fermée ;
  - titre et texte corrects ;
  - ouverture de l’application après appui ;
  - absence de doublon.
- Aucun droit Android inattendu n’a été demandé.
- Le module Notes de frais mobile n’est pas considéré comme livré tant qu’un lot API/mobile spécifique ne l’a pas explicitement validé.

**UI mobile (Accueil, LoginPage, headers) — commitée, non publiée sur le Play Store**

État historique au 2026-10-07 (commit `2b11725`) :

- Refonte mobile Accueil, LoginPage et headers dégradés : commitée et poussée sur `origin/main`.
- UI validée sur téléphone via **AMAKI Dev** (Metro / binaire de développement).
- Afficher/masquer le mot de passe : **livré et validé** sur AMAKI Dev (plus un chantier ouvert).
- Nouveau splash validé dans un binaire AMAKI Dev :
  - fond bleu clair ;
  - logo centré et transparent ;
  - proportions correctes ;
  - transition vers la LoginPage correcte.
- Build Expo Dev de recette UI : `798d66ff-1f90-4b18-8505-e8c2603e2258`.
- Application publique Play Store `fr.amaki.app` : toujours en version `1.0.0` / `versionCode` `2`, inchangée.
- Aucune nouvelle version Android de production n’a été publiée pour M1/M2.
- Le nouveau design et les lots M1/M2 **ne sont pas** publiés sur le Play Store.

**Build AMAKI Dev (recette M1 / M2 contre API production)**

- Build Expo Dev validé : `36099ef3-fa3c-40d5-96db-a34166676f27`.
- M2-D a d’abord été validé sur téléphone via **Metro** avec ce client ; puis recette AMAKI Dev contre l’API production `https://amaki.fr` : **OK** (M1 + M2).
- `mobile/.env` local a été restauré vers l’URL LAN DEV après cette recette (backup sous `/soft/SAS_AMAKIFR/`).
- Aucun build / submit Play Store `1.1.0` n’a encore été lancé.

---

## 7. Décisions de sécurité et produit

**DÉCISIONS D’ARCHITECTURE ET DE SÉCURITÉ**

- Ne jamais récupérer, afficher ou envoyer l’ancien mot de passe.
- Le parcours « mot de passe oublié » (M1) utilise un code temporaire à 8 chiffres, à usage unique, expirant, permettant de définir un nouveau mot de passe — **validé en production web** ; publication Play Store encore en attente (release `1.1.0` préparée).
- Les rappels financiers ne doivent pas exposer de montant sensible sur un écran verrouillé.
- Les rappels mensuels doivent être idempotents et éviter tout doublon.
- La collecte concernant l’origine des connexions doit rester proportionnée :
  plateforme Web/Mobile, type d’appareil, système, dernière activité et éventuellement IP tronquée.
- Définir une durée de conservation avant d’ajouter de nouvelles données de connexion.
- Ne pas transformer ce besoin en journalisation intrusive de toutes les actions utilisateur.
- Lecture mobile des comptes rendus (M2-D) : pas de WebView ; HTML allowlisté rendu en composants React Native ; liens http/https uniquement après confirmation utilisateur ; borne stricte de taille.

---

## 8. M1 — Mot de passe oublié (validé production web)

**VALIDÉ EN PRODUCTION WEB/BACKEND — NON PUBLIÉ SUR LE PLAY STORE**

- Backend S0/S1 + migration password-reset déployés (baseline prod `8b80809`).
- Recette production web OK ; recette mobile AMAKI Dev contre `https://amaki.fr` OK.
- Parcours : demande → code 8 chiffres → réinitialisation → reconnexion.
- Correctifs : payload email/autofill, zéro initial, barre navigation Android, navigation web vers `/auth/new-password`.
- Build AMAKI Dev de référence : `36099ef3-fa3c-40d5-96db-a34166676f27`.
- Play Store : toujours `1.0.0` / code `2` ; release `1.1.0` / code `3` préparée, non buildée.

---

## 9. M2 — Réunions et comptes rendus (validé production web)

**VALIDÉ EN PRODUCTION WEB/BACKEND — NON PUBLIÉ SUR LE PLAY STORE**

Lecture mobile des rapports : validée via AMAKI Dev contre l’API production ; publication store encore en attente (`1.1.0`).

### M2-B — Web UX rapports / réunions

- Expérience web des rapports de réunion améliorée (commit `0371eb7` et suivants).
- Déployée en production avec la baseline `8b80809`.

### M2-C — Publication DRAFT / PUBLISHED + API Bearer

- Statuts `DRAFT` / `PUBLISHED` ; rapports existants backfillés en `PUBLISHED` lors de la migration.
- API Bearer lecture seule pour le détail d’un rapport publié ; protections anti-IDOR.
- Migration DRAFT/PUBLISHED appliquée en production (avec backfill historiques → PUBLISHED).
- Workflow web validé : Brouillon → Publié → Brouillon (dépublication).
- Hotfix dépublication : `AlertDialog` — validé (commit `6284411`).

### M2-D — Lecteur mobile Expo

- Badge « compte rendu » visible uniquement si un rapport **publié** est lié (`hasPublishedReport` + `publishedReportId`).
- Lecteur Expo sécurisé **sans WebView**.
- HTML TipTap : allowlist stricte → composants React Native (pas d’injection HTML brute).
- Liens : uniquement `http:` / `https:` absolus, après action et confirmation utilisateur.
- Borne de taille : `MAX_MEETING_REPORT_HTML_LENGTH = 200_000` caractères ; dépassement → état contrôlé « Compte rendu trop volumineux » (pas de troncature silencieuse, pas de log du contenu).
- Dépublication : le badge disparaît et l’accès lecteur renvoie une indisponibilité générique.
- Validé sur téléphone (Metro puis AMAKI Dev contre `https://amaki.fr`).
- **Non** publié sur le Play Store (`1.0.0` / `versionCode` `2` encore public ; `1.1.0` / code `3` préparé).

---

## 10. Travaux prioritaires

**ÉTAT DES PRIORITÉS (2026-10-09)**

| Priorité | Sujet | État |
|----------|-------|------|
| P0 | Inscription web | **Livré en production** |
| P1 | Mot de passe oublié (M1) | **Validé production web** ; Play Store en attente (`1.1.0`) |
| P1 | Lecture comptes rendus mobile (M2) | **Validé production web + recette Dev** ; Play Store en attente (`1.1.0`) |

### Prochaines priorités restantes

1. Publication Android Play Store `1.1.0` / `versionCode` `3` (build EAS production puis submit).
2. Rappels mensuels cotisations / dettes.
3. Identification de l’origine des connexions.
4. Futur copilote IA pour les comptes rendus — **uniquement après** stabilisation store de M1/M2. **Non livré, non commencé.**

### Détail des chantiers encore ouverts

#### Rappels mensuels cotisations/dettes

- Fournir à l’administrateur un envoi manuel, prévisualisable et éventuellement automatisable.
- Informer l’adhérent d’un retard de cotisation ou d’une dette et l’inviter à régulariser.
- Définir la source de calcul, les destinataires, la date mensuelle, l’idempotence, l’historique et le contenu discret des notifications.

#### Origine et sessions de connexion

- Identifier si une connexion vient du Web ou du Mobile.
- Préférer une vue de sessions/dernière activité à un stockage illimité de toutes les actions.
- Définir les données collectées, la rétention et les droits de consultation.
- Auditer l’existant avant toute migration ou suppression de journaux.

#### Copilote IA comptes rendus (futur)

- Hors scope actuel.
- Ne pas démarrer avant stabilisation production de M1 et M2.
- Ne pas le déclarer livré ni commencé.

---

## 11. Déploiement Android à venir (Play Store)

**BACKEND/WEB M1/M2 : FAIT (`8b80809`). STORE ANDROID : EN ATTENTE.**

1. Confirmer `mobile/.env` local = LAN DEV (ne pas builder le store avec une URL LAN).
2. Build EAS profil `production` (`EXPO_PUBLIC_API_URL=https://amaki.fr`, cleartext off, `fr.amaki.app`).
3. Recette AAB / piste interne si besoin, puis submit Play Console `1.1.0` / `versionCode` `3`.
4. Ne pas republier tant que la recette post-build M1/M2 sur binaire store n’est pas OK.

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
- Renvoi du code de confirmation d’inscription : réponse non énumérante (même message que le compte existe ou non), cooldown serveur minimal, et aucun email/code/token dans les logs applicatifs.
- Confirmation d’email d’inscription — **livrée et validée en production** (baseline historique `cfbe06fb…` puis UX `ddf4f9e…`) :
  - vérification liée à `email + code` (plus de lookup par code seul) ;
  - un seul `VerificationToken` actif par email (contrainte UNIQUE) ;
  - plafond persistant de 3 erreurs (`failedAttempts` / `lockedAt`) côté DB ;
  - cooldown de renvoi persistant 60 s basé sur `createdAt`.
- Règle permanente : **email confirmé ≠ compte actif**.
  - `emailVerified` confirme l’adresse ; `status` Inactif reste distinct et n’est pas modifié par la vérification.
  - L’activation administrative est obligatoire avant l’accès membre complet.
  - L’utilisateur est averti de l’attente et notifié par e-mail après activation.
- Pour chaque nouveau chantier :
  1. diagnostiquer ;
  2. produire la preuve ;
  3. proposer le changement minimal ;
  4. tester ;
  5. faire relire le diff ;
  6. commiter explicitement ;
  7. pousser ;
  8. déployer avec sauvegarde et maintenance adaptées ;
  9. effectuer une recette ;
  10. mettre à jour ce document si une décision permanente a changé.
- Ne jamais inscrire dans ce document :
  - secrets ;
  - données personnelles ;
  - identifiants de comptes ;
  - contenu de `.env` ;
  - références de notes de frais réelles ;
  - chemins temporaires ;
  - résultats éphémères sans valeur architecturale.

---

## 13. Journal synthétique des décisions permanentes

- **2026-09** : durcissement du déploiement, backup atomique, maintenance Nginx, smoke interne avec retry.
- **2026-09** : migrations Notes de frais 4.x, stockage privé et activation production.
- **2026-09** : rôles Notes de frais confirmés ; justificatif obligatoire à la soumission.
- **2026-10** : application Android `fr.amaki.app` version `1.0.0` / `versionCode` `2` validée en Production Google Play.
- **2026-10** : priorités suivantes enregistrées : inscription web, authentification mobile, rapports de réunions, rappels financiers et origine des connexions.
- **2026-10** : déploiement sécurisé aligné sur Notes de frais actifs (gardes `assert_notes_frais_flags_on` + `assert_notes_frais_storage_ready`) — livré et validé en production (`f576be2…`).
- **2026-10** : sécurisation persistante du code de confirmation email (unique email, plafond 3 erreurs, cooldown 60 s, vérification email+code) — livrée et validée en production (`cfbe06fb…`).
- **2026-10** : email confirmé ≠ compte actif ; activation administrative obligatoire ; utilisateur averti de l’attente et notifié après activation.
- **2026-10** : UX confirmation email (champ unique, collage filtré, renvoi explicite et attente administrative) — livrée et validée en production (`ddf4f9e…`).
- **2026-10-07** : refonte UI mobile Accueil / LoginPage / headers dégradés + œil MDP + splash — commitée/poussée (`2b11725`), validée sur téléphone via AMAKI Dev (build Expo Dev `798d66ff-1f90-4b18-8505-e8c2603e2258`) ; Play Store `fr.amaki.app` `1.0.0` inchangé.
- **2026-10-07** *(historique)* : parcours « mot de passe oublié » S0/S1 — alors **préparé / non livré**.
- **2026-10-08** *(historique)* : lot mobile M1 — alors **préparé / non livré**.
- **2026-10-09** *(historique)* : M1/M2 validés d’abord en DEV (`amakifr_db`, Metro / AMAKI Dev).
- **2026-10-09** : M1/M2 **déployés et validés en production web/backend** (baseline `8b80809`) ; recette AMAKI Dev contre `https://amaki.fr` OK ; Play Store toujours `1.0.0` / code `2`.
- **2026-10-09** : préparation release Android `1.1.0` / `versionCode` `3` (`fr.amaki.app`) + `eas.json` production avec `EXPO_PUBLIC_API_URL=https://amaki.fr` ; **non** buildée / **non** publiée.

---

## Faits temporaires à revérifier

Ces éléments sont documentés comme baseline au moment de la rédaction ; les revérifier avant toute mutation de production :

- SHA de `origin/main` et checkout VPS `/sites/amakifr` (attendu documenté : `8b80809`).
- Présence/absence de `maintenance.flag` et réponse HTTP publique réelle.
- État PM2 `amakifr` (online/stopped) et cwd réel.
- Valeurs des flags Notes de frais en shell / fichiers env / PM2 (sans afficher d’autres secrets).
- Existence et permissions de `/sites/amakifr-data/notes-frais`.
- Nombre de migrations finished en production vs dossiers présents dans le dépôt (anomalie orpheline historique possible — voir `docs/frais-avances/DEPLOY-PRODUCTION.md`).
- Avant build EAS store : `mobile/.env` local = LAN DEV ; profil production EAS force `https://amaki.fr`.
- Play Console : ne pas soumettre tant que l’AAB `1.1.0` / code `3` n’a pas passé la recette post-build.
