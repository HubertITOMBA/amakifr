# AMAKI — Contexte permanent du projet

Dernière mise à jour : 2026-10-09

## Baselines (ne pas confondre)

| Portée | SHA / version | Statut |
|--------|---------------|--------|
| Baseline dépôt / DEV (`origin/main`) | `ea1d0de` | Validée ; contient M1 et M2 développés et validés en DEV |
| Production web actuellement déployée (documentée) | `ddf4f9e` | UX confirmation email ; **ne pas** assimiler à M1/M2 |
| Application Android Play Store publiée | `1.0.0` / `versionCode` `2` | Inchangée ; M1/M2 **non** publiés sur le Play Store |

**Règle** : M1 (mot de passe oublié) et M2 (réunions / comptes rendus) sont **développés et validés en DEV uniquement**. Ils ne sont **pas** en production web et **pas** sur le Play Store.

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
- Version publique validée : `1.0.0`
- `versionCode` : `2`
- Version de production Play Console : `2 (1.0.0)`
- L’application est disponible sur la piste Production.
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

**Build AMAKI Dev (recette M1)**

- Build Expo Dev validé : `36099ef3-fa3c-40d5-96db-a34166676f27`.
- M2-D a ensuite été validé sur téléphone via **Metro** avec ce même client de développement ; aucun nouveau build EAS n’était requis pour M2-D.

---

## 7. Décisions de sécurité et produit

**DÉCISIONS D’ARCHITECTURE ET DE SÉCURITÉ**

- Ne jamais récupérer, afficher ou envoyer l’ancien mot de passe.
- Le parcours « mot de passe oublié » (M1) utilise un code temporaire à 8 chiffres, à usage unique, expirant, permettant de définir un nouveau mot de passe — **validé en DEV** ; déploiement production encore en attente (voir §8 et §11).
- Les rappels financiers ne doivent pas exposer de montant sensible sur un écran verrouillé.
- Les rappels mensuels doivent être idempotents et éviter tout doublon.
- La collecte concernant l’origine des connexions doit rester proportionnée :
  plateforme Web/Mobile, type d’appareil, système, dernière activité et éventuellement IP tronquée.
- Définir une durée de conservation avant d’ajouter de nouvelles données de connexion.
- Ne pas transformer ce besoin en journalisation intrusive de toutes les actions utilisateur.
- Lecture mobile des comptes rendus (M2-D) : pas de WebView ; HTML allowlisté rendu en composants React Native ; liens http/https uniquement après confirmation utilisateur ; borne stricte de taille.

---

## 8. M1 — Mot de passe oublié mobile (validé DEV)

**DÉVELOPPÉ ET VALIDÉ EN DEV — NON DÉPLOYÉ EN PRODUCTION — NON PUBLIÉ SUR LE PLAY STORE**

- Backend S0/S1 poussé sur `origin/main`.
- Migration password-reset appliquée et validée **uniquement** sur la base DEV `amakifr_db` (pas sur la production `amakifr`).
- Recette DEV avec Mailpit et compte synthétique dédié ; compte encore présent dans `amakifr_db` au 2026-10-09, avec procédure de nettoyage préparée mais non exécutée.
- Parcours validé : demande → code 8 chiffres → réinitialisation → reconnexion.
- Correctif payload email / autofill appliqué.
- Conservation du zéro initial du code (pas de troncature numérique).
- Barre de navigation Android corrigée pour ce parcours.
- Build AMAKI Dev de recette : `36099ef3-fa3c-40d5-96db-a34166676f27`.
- **Production** : non déployé. Le passage en production exigera notamment :
  - `PASSWORD_RESET_HMAC_SECRET` présent et conforme ;
  - `TRUST_PROXY` aligné sur la conf Nginx **effective** (`nginx -T`) ;
  - migration password-reset appliquée sur la base de production après sauvegarde contrôlée.

---

## 9. M2 — Réunions et comptes rendus (validé DEV)

**DÉVELOPPÉ ET VALIDÉ EN DEV — NON DÉPLOYÉ EN PRODUCTION WEB — NON PUBLIÉ SUR LE PLAY STORE**

Ne pas écrire ni considérer que l’UX M2 ou la lecture mobile des rapports est déjà en production.

### M2-B — Web UX rapports / réunions

- Expérience web des rapports de réunion améliorée (commit `0371eb7` et suivants sur `origin/main`).
- Présent dans la baseline dépôt `ea1d0de` ; **pas** assimilé au SHA de production web `ddf4f9e`.

### M2-C — Publication DRAFT / PUBLISHED + API Bearer

- Statuts `DRAFT` / `PUBLISHED` ; rapports existants backfillés en `PUBLISHED` lors de la migration.
- API Bearer lecture seule pour le détail d’un rapport publié ; protections anti-IDOR.
- Migration appliquée **uniquement** sur `amakifr_db` (pas sur la production).
- Workflow web validé en DEV : Brouillon → Publié → Brouillon (dépublication).
- Hotfix dépublication : remplacement de `window.confirm` / confirm natif par `AlertDialog` — validé (commit `6284411`).

### M2-D — Lecteur mobile Expo

- Badge « compte rendu » visible uniquement si un rapport **publié** est lié (`hasPublishedReport` + `publishedReportId`).
- Lecteur Expo sécurisé **sans WebView**.
- HTML TipTap : allowlist stricte → composants React Native (pas d’injection HTML brute).
- Liens : uniquement `http:` / `https:` absolus, après action et confirmation utilisateur.
- Borne de taille : `MAX_MEETING_REPORT_HTML_LENGTH = 200_000` caractères ; dépassement → état contrôlé « Compte rendu trop volumineux » (pas de troncature silencieuse, pas de log du contenu).
- Dépublication : le badge disparaît et l’accès lecteur renvoie une indisponibilité générique.
- Validé sur téléphone via **Metro** avec le client AMAKI Dev `36099ef3-fa3c-40d5-96db-a34166676f27` ; aucun nouveau build EAS requis pour cette validation.
- **Non** publié sur le Play Store (`1.0.0` / `versionCode` `2` inchangé).

---

## 10. Travaux prioritaires

**ÉTAT DES PRIORITÉS (2026-10-09)**

| Priorité | Sujet | État |
|----------|-------|------|
| P0 | Inscription web | **Livré en production** (confirmation email / activation admin — voir journal) |
| P1 | Mot de passe oublié (M1) | **Développé et validé DEV** ; production et Play Store en attente |
| P1 | Lecture comptes rendus mobile (M2) | **Développé et validé DEV** ; production web / Play Store en attente |

### Prochaines priorités restantes

1. Rappels mensuels cotisations / dettes.
2. Identification de l’origine des connexions.
3. Futur copilote IA pour les comptes rendus — **uniquement après** stabilisation production de M1/M2. **Non livré, non commencé.**

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

## 11. Déploiement à venir (M1 / M2)

**PROCÉDURE ATTENDUE — NON EXÉCUTÉE À CE STADE**

1. Backend / web et migrations d’abord (password-reset, DRAFT/PUBLISHED, API Bearer), avec sauvegarde PostgreSQL validée.
2. Tests de production contrôlés (smoke, parcours métier, `TRUST_PROXY` / secrets).
3. Android ensuite (nouvelle version Play Store seulement après disponibilité des endpoints M1/M2 côté serveur).
4. **Ne pas** publier l’application mobile avant que les endpoints M1/M2 soient disponibles en production.
5. À la date de rédaction : **migrations production non appliquées** (password-reset et rapports DRAFT/PUBLISHED uniquement sur `amakifr_db`).

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
- **2026-10** : UX confirmation email (champ unique, collage filtré, renvoi explicite et attente administrative) — livrée et validée en production (`ddf4f9e…`). **Dernière production web documentée.**
- **2026-10-07** : refonte UI mobile Accueil / LoginPage / headers dégradés + œil MDP + splash — commitée/poussée (`2b11725`), validée sur téléphone via AMAKI Dev (build Expo Dev `798d66ff-1f90-4b18-8505-e8c2603e2258`) ; Play Store `fr.amaki.app` `1.0.0` inchangé, aucune publication production Android.
- **2026-10-07** *(historique)* : parcours « mot de passe oublié » S0/S1 — alors **préparé / non livré** (baseline dépôt encore `2b11725`).
- **2026-10-08** *(historique)* : lot mobile M1 — alors **préparé / non livré** ; Play Store `1.0.0` inchangé ; recette intégrée encore bloquée sans migration DEV + secret + `TRUST_PROXY`.
- **2026-10-09** : M1 validé en DEV — backend S0/S1 poussé ; migration password-reset sur `amakifr_db` uniquement ; Mailpit + compte synthétique ; demande / code 8 chiffres / reset / reconnexion ; correctifs email-autofill, zéro initial, barre navigation Android ; build AMAKI Dev `36099ef3-fa3c-40d5-96db-a34166676f27` ; **non** déployé en production ; **non** publié sur Play Store ; production future : `PASSWORD_RESET_HMAC_SECRET` + `TRUST_PROXY` conforme.
- **2026-10-09** : M2 validé en DEV — M2-B UX web ; M2-C DRAFT/PUBLISHED + backfill + API Bearer lecture seule + anti-IDOR + migration `amakifr_db` uniquement + workflow Brouillon↔Publié + hotfix AlertDialog dépublication (`6284411`) ; M2-D badge publié + lecteur Expo sans WebView (allowlist → RN, liens http/https confirmés, limite 200 000 car.) + dépublication retire badge/accès ; validation téléphone via Metro ; baseline dépôt `ea1d0de` ; **non** en production web ; **non** sur Play Store.
- **2026-10-09** : priorités mises à jour — P0 inscription web livré en production ; P1 M1 et P1 lecture CR mobile validés DEV (prod/Play en attente) ; suite : rappels cotisations/dettes, origine des connexions, puis copilote IA CR seulement après stabilisation prod M1/M2 (IA non commencée).

---

## Faits temporaires à revérifier

Ces éléments sont documentés comme baseline au moment de la rédaction ; les revérifier avant toute mutation de production :

- SHA de `origin/main` (attendu documenté : `ea1d0de`) et écart avec le checkout VPS `/sites/amakifr` (production web documentée : `ddf4f9e`).
- Présence/absence de `maintenance.flag` et réponse HTTP publique réelle.
- État PM2 `amakifr` (online/stopped) et cwd réel.
- Valeurs des flags Notes de frais en shell / fichiers env / PM2 (sans afficher d’autres secrets).
- Existence et permissions de `/sites/amakifr-data/notes-frais`.
- Nombre de migrations finished en production vs dossiers présents dans le dépôt (anomalie orpheline historique possible — voir `docs/frais-avances/DEPLOY-PRODUCTION.md`).
- Migrations M1/M2 **non** appliquées en production à ce stade (uniquement `amakifr_db`).
- Secrets production pour M1 (`PASSWORD_RESET_HMAC_SECRET`) et conformité `TRUST_PROXY` / Nginx effective avant tout déploiement M1.
