# AMAKI — Contexte permanent du projet

Dernière mise à jour : 2026-10-07
Baseline validée : commit `cfbe06fb9e0c9984c8a1d059249bacf871db4911`

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

## 6. Application mobile Android — livrée et validée

**LIVRÉ ET VALIDÉ**

- Package Android : `fr.amaki.app`
- Google Play : `https://play.google.com/store/apps/details?id=fr.amaki.app`
- Version publique validée : `1.0.0`
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

---

## 7. Décisions de sécurité et produit

**DÉCISIONS D’ARCHITECTURE ET DE SÉCURITÉ**

- Ne jamais récupérer, afficher ou envoyer l’ancien mot de passe.
- Le futur parcours « mot de passe oublié » doit utiliser un code ou lien temporaire, à usage unique, expirant, permettant de définir un nouveau mot de passe.
- Les rappels financiers ne doivent pas exposer de montant sensible sur un écran verrouillé.
- Les rappels mensuels doivent être idempotents et éviter tout doublon.
- La collecte concernant l’origine des connexions doit rester proportionnée :
  plateforme Web/Mobile, type d’appareil, système, dernière activité et éventuellement IP tronquée.
- Définir une durée de conservation avant d’ajouter de nouvelles données de connexion.
- Ne pas transformer ce besoin en journalisation intrusive de toutes les actions utilisateur.

---

## 8. Travaux prioritaires ouverts

**TRAVAUX OUVERTS ET PRIORITÉS**

Ordre de priorité validé :

### P0 — Inscription web bloquée

- Auditer le parcours d’adhésion en ligne.
- Le bouton « Créer mon compte » reste grisé lors d’un test utilisateur.
- Identifier si le blocage provient :
  - d’un champ obligatoire ;
  - du consentement ;
  - d’une validation client ;
  - d’une configuration ;
  - d’une règle serveur.
- Commencer par un diagnostic ; ne pas corriger sans preuve.

### P1 — Authentification mobile

- Ajouter afficher/masquer le mot de passe sur l’écran de connexion.
- Ajouter un parcours sécurisé « mot de passe oublié ».
- Réutiliser autant que possible le mécanisme web existant s’il est correct.
- Ne jamais envoyer un mot de passe existant.

### P1 — Réunions sur mobile

- Lorsqu’un compte rendu ou rapport est disponible, afficher un bouton ou badge permettant à l’adhérent de le consulter.
- Respecter les droits d’accès et utiliser un téléchargement/affichage authentifié.

### P1 — Rappels mensuels cotisations/dettes

- Fournir à l’administrateur un envoi manuel, prévisualisable et éventuellement automatisable.
- Informer l’adhérent d’un retard de cotisation ou d’une dette et l’inviter à régulariser.
- Définir la source de calcul, les destinataires, la date mensuelle, l’idempotence, l’historique et le contenu discret des notifications.

### P2 — Origine et sessions de connexion

- Identifier si une connexion vient du Web ou du Mobile.
- Préférer une vue de sessions/dernière activité à un stockage illimité de toutes les actions.
- Définir les données collectées, la rétention et les droits de consultation.
- Auditer l’existant avant toute migration ou suppression de journaux.

---

## 9. Méthode de travail ChatGPT/Cursor

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
- Confirmation d’email d’inscription — **livrée et validée en production** (baseline `cfbe06fb…`) :
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

## 10. Journal synthétique des décisions permanentes

- **2026-09** : durcissement du déploiement, backup atomique, maintenance Nginx, smoke interne avec retry.
- **2026-09** : migrations Notes de frais 4.x, stockage privé et activation production.
- **2026-09** : rôles Notes de frais confirmés ; justificatif obligatoire à la soumission.
- **2026-10** : application Android `fr.amaki.app` version `1.0.0` validée en Production Google Play.
- **2026-10** : priorités suivantes enregistrées : inscription web, authentification mobile, rapports de réunions, rappels financiers et origine des connexions.
- **2026-10** : déploiement sécurisé aligné sur Notes de frais actifs (gardes `assert_notes_frais_flags_on` + `assert_notes_frais_storage_ready`) — code dépôt à déployer ; baseline production inchangée tant que non livré.
- **2026-10** : sécurisation persistante du code de confirmation email (unique email, plafond 3 erreurs, cooldown 60 s, vérification email+code) — livrée et validée en production (`cfbe06fb…`).
- **2026-10** : email confirmé ≠ compte actif ; activation administrative obligatoire ; utilisateur averti de l’attente et notifié après activation.
- **2026-10** : UX confirmation email (champ unique et attente administrative) : correctif préparé et testé, non encore livré en production ; baseline production `cfbe06fb…`.

---

## Faits temporaires à revérifier

Ces éléments sont documentés comme baseline au moment de la rédaction ; les revérifier avant toute mutation de production :

- SHA de `origin/main` et alignement avec le checkout VPS `/sites/amakifr`.
- Présence/absence de `maintenance.flag` et réponse HTTP publique réelle.
- État PM2 `amakifr` (online/stopped) et cwd réel.
- Valeurs des flags Notes de frais en shell / fichiers env / PM2 (sans afficher d’autres secrets).
- Existence et permissions de `/sites/amakifr-data/notes-frais`.
- Nombre de migrations finished en production vs dossiers présents dans le dépôt (anomalie orpheline historique possible — voir `docs/frais-avances/DEPLOY-PRODUCTION.md`).
