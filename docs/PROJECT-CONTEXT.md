# AMAKI — Contexte permanent du projet

Dernière mise à jour : 2026-10-10
Pause prévue : environ deux semaines — reprendre à la section **« Point de reprise »**.

## Baselines (ne pas confondre)

| Portée | SHA / version | Statut |
|--------|---------------|--------|
| Baseline dépôt / DEV (`origin/main`) | `7e4e51e` | `chore(mobile): exclude local assets from EAS builds` |
| Production web / backend déployée | `8b80809` | `fix(auth): navigate to password reset confirmation` — M1 + M2 en production |
| Application Android Play Store **publiée** | `1.0.0` / `versionCode` `2` | Toujours la version publique |
| Release Android **buildée**, non soumise | `1.1.0` / `versionCode` `3` | AAB EAS prêt ; **pas** de submit Play Console |

**Règle** : M1 et M2 sont **en production web/backend** et validés (web + AMAKI Dev contre `https://amaki.fr`). Ils ne sont **pas** encore sur le Play Store public.

> Ce document évite de répéter les audits déjà conclus. Il ne remplace pas les vérifications d’état courantes avant une mutation de production. En cas de contradiction entre ce document, le dépôt Git et l’état réel du VPS, arrêter l’opération, signaler l’écart et vérifier avant d’agir.

---

## Point de reprise (après pause ~2 semaines)

**Ordre strict — ne pas inverser :**

1. Récupérer / contrôler les métadonnées EAS et le checksum de l’AAB `1.1.0` / code `3`.
2. Charger l’AAB sur la **piste Play Console interne** (pas la production store d’emblée).
3. Installer depuis Google Play (piste interne) sur téléphone.
4. Recette obligatoire :
   - connexion API production (`https://amaki.fr`) ;
   - M1 : forgot → code → nouveau MDP → reconnexion ;
   - M2 : badge rapport publié + lecture ;
   - dépublication web → disparition badge / accès ;
   - notifications / session ;
   - aucun appel LAN / cleartext.
5. **Seulement après** validation : décider la promotion en production Play Store.
6. Mettre à jour ce document **après** publication effective.

Artefact AAB (non soumis) :

`https://expo.dev/artifacts/eas/1q7ALXCMdJljhzNsUNn22sOnWTj3QjGLBqri3i_4SGs.aab`

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

---

## 6. Application mobile Android

### Play Store public (toujours actuel)

- Package : `fr.amaki.app`
- Google Play : `https://play.google.com/store/apps/details?id=fr.amaki.app`
- Version publique : `1.0.0` / `versionCode` `2`
- Recette publique stricte historique validée (install, login, session, notifications).

### Release `1.1.0` / code `3` — buildée, non publiée

- Dépôt : `7e4e51e` (`chore(mobile): exclude local assets from EAS builds`).
- Package inchangé : `fr.amaki.app`.
- API store : `https://amaki.fr` ; cleartext **false**.
- Build EAS **production** terminé avec succès.
- Artefact AAB :
  `https://expo.dev/artifacts/eas/1q7ALXCMdJljhzNsUNn22sOnWTj3QjGLBqri3i_4SGs.aab`
- **NON** soumis à Play Console ; **aucune** publication.
- `mobile/.env` local restauré vers LAN DEV après recette production.
- Recette AMAKI Dev contre `https://amaki.fr` (M1 + M2) : **OK**.
- Build Expo Dev de référence historique : `36099ef3-fa3c-40d5-96db-a34166676f27`.
- Notes de frais mobile : non livré tant qu’un lot API/mobile dédié n’est pas validé.

---

## 7. Décisions de sécurité et produit

**DÉCISIONS D’ARCHITECTURE ET DE SÉCURITÉ**

- Ne jamais récupérer, afficher ou envoyer l’ancien mot de passe.
- Parcours « mot de passe oublié » (M1) : code 8 chiffres, usage unique, expirant — **validé en production web** ; store Android en attente de publication `1.1.0`.
- Runtime production M1 validé (sans valeurs de secrets) :
  - `PASSWORD_RESET_HMAC_SECRET` : présent, unique, longueur UTF-8 **64** ;
  - `TRUST_PROXY=true` ;
  - chaîne Nginx effective conforme (voir §3).
- Les rappels financiers ne doivent pas exposer de montant sensible sur un écran verrouillé.
- Les rappels mensuels doivent être idempotents et éviter tout doublon.
- La collecte concernant l’origine des connexions doit rester proportionnée :
  plateforme Web/Mobile, type d’appareil, système, dernière activité et éventuellement IP tronquée.
- Définir une durée de conservation avant d’ajouter de nouvelles données de connexion.
- Ne pas transformer ce besoin en journalisation intrusive de toutes les actions utilisateur.
- Lecture mobile des comptes rendus (M2-D) : pas de WebView ; HTML allowlisté → composants React Native ; liens http/https après confirmation ; borne 200 000 caractères.

---

## 8. M1 — Mot de passe oublié (production web)

**VALIDÉ EN PRODUCTION WEB/BACKEND — NON PUBLIÉ SUR LE PLAY STORE**

- Commit applicatif production : `8b80809`.
- Migration `20261007220000_password_reset_challenge_security` : **finished**, sans rollback.
- Recette web production :
  - e-mail reçu ;
  - redirection automatique vers `/auth/new-password` validée ;
  - lien « J’ai déjà un code » visible ;
  - saisie code / reset fonctionnels.
- Recette mobile AMAKI Dev contre `https://amaki.fr` : OK.
- Play Store public : toujours `1.0.0` / code `2`.

---

## 9. M2 — Réunions et comptes rendus (production web)

**VALIDÉ EN PRODUCTION WEB/BACKEND — NON PUBLIÉ SUR LE PLAY STORE**

- Migration `20261008190000_rapport_reunion_publication_status` : **finished**, sans rollback.
- DRAFT / PUBLISHED + backfill historiques → PUBLISHED ; API Bearer lecture seule ; anti-IDOR.
- Workflow web Brouillon ↔ Publié validé ; hotfix `AlertDialog` dépublication.
- Lecteur mobile sans WebView ; badge uniquement si publié ; recette AMAKI Dev contre prod OK.
- Play Store : en attente de publication `1.1.0` / code `3`.

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

**ÉTAT AU 2026-10-10 (avant pause)**

| Priorité | Sujet | État |
|----------|-------|------|
| P0 | Inscription web | Livré en production |
| P1 | Mot de passe oublié (M1) | **Production web OK** ; store en attente (AAB prêt) |
| P1 | Lecture CR mobile (M2) | **Production web + Dev OK** ; store en attente (AAB prêt) |
| Immédiat reprise | Play interne → recette → éventuelle promo prod | Voir **Point de reprise** |

### Dettes ouvertes (après reprise store)

1. Rappels mensuels cotisations / dettes.
2. Identification de l’origine des connexions.
3. Copilote IA comptes rendus — **seulement après** stabilisation store M1/M2 ; **non commencé**.
4. Admin reset plaintext (dette produit/sécurité).
5. Politique mot de passe minimum 6 caractères (dette).
6. Dette Nginx `naxhel.fr` (`server_name` dupliqué) — hors AMAKI.
7. Nettoyage éventuel des comptes / scripts synthétiques DEV.

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
- Ne jamais inscrire dans ce document : secrets, données personnelles, identifiants de comptes, contenu de `.env`, références de notes de frais réelles, chemins temporaires, résultats éphémères sans valeur architecturale.

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
- **2026-10-09/10** : release Android `1.1.0` / code `3` préparée puis **AAB EAS production buildé** ; dépôt `7e4e51e` ; **non soumis** Play Console ; Play public reste `1.0.0` / code `2`.
- **2026-10-10** : pause ~2 semaines — point de reprise = contrôle AAB → piste interne → recette → éventuelle promo prod → MAJ de ce document.

---

## Faits temporaires à revérifier (reprise)

- SHA `origin/main` (attendu documenté : `7e4e51e`) vs checkout VPS `/sites/amakifr` (applicatif documenté : `8b80809`).
- Présence/absence de `maintenance.flag` ; HTTP public/interne.
- PM2 `amakifr` online ; écoute `127.0.0.1:9060` uniquement.
- Flags Notes de frais + stockage privé (sans afficher d’autres secrets).
- Prisma : migrations M1/M2 toujours `finished` ; pas de nouvelle orpheline.
- Métadonnées EAS + checksum AAB `1.1.0` / code `3` avant upload Play interne.
- `mobile/.env` local = LAN DEV (ne pas re-pointer vers prod sans procédure).
- Ne pas promouvoir en production Play Store sans recette piste interne OK.
