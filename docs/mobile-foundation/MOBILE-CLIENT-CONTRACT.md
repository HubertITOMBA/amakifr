# Contrat client mobile Expo — Phase 2N

## Architecture

```
mobile/          ← Expo / React Native (séparé)
app/ lib/ …      ← Next.js Web (inchangé)
```

## Stack

| Élément | Version |
|---------|---------|
| Expo SDK | ~57 |
| React Native | 0.86.x |
| React | 19.2.x |
| Expo Router | ~57 |
| SecureStore | expo-secure-store |

## Auth client

1. Login → SecureStore (access + refresh)
2. Restore → `/me` ou refresh puis `/me`
3. `authenticatedFetch` → 401 → single-flight refresh → retry 1×
4. Logout → `POST /auth/logout` best-effort + clear local

## Single-flight

Plusieurs 401 simultanés partagent **une** Promise `refreshSession()`.

Obligatoire car le backend **rotate** le refresh.

## API URL

`EXPO_PUBLIC_API_URL` — IP LAN en dev physique.

Pas de secrets backend dans `EXPO_PUBLIC_*`.

## Limites

- Pas d’OTP / registration / biométrie
- Pas d’iOS local sous Fedora
- `adminRoles` / `adherentId` non utilisés
- Notifications : pas de pagination infinie / filtres / push OS

## Notifications (Phase 2O)

Écran `(app)/notifications` :

- lecture liste + unread count
- mark one / mark all / delete
- pull-to-refresh
- ownership via Bearer uniquement (pas de `userId` query)
- anti-IDOR côté backend
- pas de cache persistant SecureStore

## Cotisations mensuelles (Phase 2P)

Écran `(app)/cotisations` — **lecture seule** :

| Méthode | Path |
|---------|------|
| GET | `/api/v1/me/cotisations-mensuelles` |

Règles client :

- auth Bearer via `authenticatedFetch` uniquement
- **pas** de `userId` / `adherentId` query (anti-IDOR backend)
- montants DTO en **string** décimale — jamais convertis en `Number` / `parseFloat`
- dates ISO string — affichage local uniquement
- ordre serveur (`periode` desc) conservé
- pull-to-refresh, loading / empty / error
- **pas** de mutation cotisation
- **pas** de paiement (Stripe / Mollie / PayPal / WebView)
- **pas** de cache persistant (SecureStore / AsyncStorage)

## Documents (lecture seule)

Écran `(app)/documents` — **lecture seule**, ouvert depuis Accueil (pas d’onglet dédié) :

| Méthode | Path |
|---------|------|
| GET | `/api/v1/me/documents` |

Règles client :

- self-service via `actor.userId` côté backend — **pas** de `userId` / `adherentId` client
- auth Bearer via `authenticatedFetch` uniquement
- pull-to-refresh, loading / empty / error
- **pas** d’upload / édition / suppression
- ouverture actuelle : URL publique `/ressources/documents/*` (helper `buildDocumentOpenUrl`)
- chemins hors `/ressources/documents/` refusés (galeries, justificatifs, traversal `..` / `%2e%2e`)

Dette sécurité connue : les fichiers Documents sont **historiquement publics par URL** (contrat Web existant). Ce MVP **n’a pas changé** ce stockage ni `/api/ressources`. Un proxy authentifié reste un durcissement futur.

## Passeport (self-service)

Écran `(app)/passeport` — ouvert depuis Accueil (pas d’onglet dédié) :

| Méthode | Path |
|---------|------|
| GET | `/api/v1/me/passeport` |
| POST | `/api/v1/me/passeport/generate` |
| GET | `/api/v1/me/passeport/pdf` |

Règles client :

- self-service via `actor.userId` côté backend — **pas** de `userId` / `adherentId` client
- compte **Actif** requis (403 si inactif sur metadata / generate / PDF)
- génération **explicite** via `POST /generate` (pas de génération silencieuse au GET PDF)
- GET PDF sans effet de bord : refuse si numéro absent (409 CONFLICT)
- PDF privé Bearer uniquement — **pas** d’URL publique, `Cache-Control: private, no-store`
- metadata JSON minimal (`numeroPasseport`, `dateGenerationPasseport`, `disponible`, `peutGenerer`)
- ouverture mobile : fetch binaire authentifié → cache Expo FileSystem → `expo-sharing`
- fichier temporaire cache uniquement (`Passeport-AMAKI-{numero}.pdf`)

## Tâches (self-service)

Écran `(app)/taches` — ouvert depuis Accueil (pas d'onglet dédié) :

| Méthode | Path |
|---------|------|
| GET | `/api/v1/me/taches` |
| POST | `/api/v1/me/taches/[id]/commentaires` |

Règles client :

- self-service via `actor.userId` côté backend — **pas** de `userId` / `adherentId` client
- auth Bearer via `authenticatedFetch` uniquement
- tâches = affectations actives (`dateFinAffectation IS NULL`) de l'adhérent connecté
- commentaire : `contenu` (requis) + `pourcentageAvancement` (optionnel, 0–100 entier)
- auteur commentaire déterminé côté serveur — aucun champ identité client
- statut tâche **read-only** (pas de PATCH/PUT)
- pull-to-refresh, loading / empty / error
- groupement par projet dans l'UI
- **pas** de cache offline / AsyncStorage
- **pas** de deep linking notifications (futur incrément)
- route secondaire mobile (`href: null` dans bottom tabs)
- bottom tabs inchangés : Accueil / Cotisations / Notifications / Profil

Anti-IDOR :
- GET ne retourne que les tâches de l'adhérent authentifié
- POST commentaire vérifie que l'adhérent est affecté à la tâche
- `userId`, `adherentId`, `auteurId`, `authorId` refusés en query et body (400)

## Réunions (self-service)

Écran `(app)/reunions` — titre **« Les réunions »**, ouvert depuis Accueil (tuile « Réunions », pas d'onglet dédié) :

| Méthode | Path |
|---------|------|
| GET | `/api/v1/me/reunions` |
| PATCH | `/api/v1/me/reunions/[id]/participation` |

Règles client :

- self-service via `actor.userId` côté backend — **pas** de `userId` / `adherentId` / `participantId` client
- auth Bearer via `authenticatedFetch` uniquement
- calendrier **collectif** des réunions mensuelles (identique Web `/reunions-mensuelles`)
- DTO minimal : titre, statut, date (uniquement si `DateConfirmee`), lieu compact, adresse lieu (actives/futures), hôte, téléphones hôte (actives/futures), `isHost`, `participationStatus` propre, `canUpdateParticipation`
- **exclut** : emails, listes nominatives, `Adherent` complet, `Adresse[]`, téléphones autres participants
- lieu Domicile compact = `Chez Prénom Nom` ; adresse dépliée = adresse effective du lieu (domicile hôte ou `reunion.adresse`)
- historique : nom hôte + participation en lecture seule ; **pas** d'adresse ni téléphone hôte (minimisation)
- participation : `Present` | `Absent` | `Excuse` via PATCH ; body objet JS (pas `JSON.stringify`)
- modifiable uniquement si `canUpdateParticipation` (`DateConfirmee` + future) — aligné `confirmerParticipationReunion` Web
- réunions passées, `EnAttente`, `MoisValide`, `Annulee` : participation refusée côté serveur
- UI : sections « À venir » / « Historique », cartes expandables, boutons participation avec anti double-submit
- pull-to-refresh ; en cas d'échec refresh, conservation des données + banner
- **pas** de cache offline / AsyncStorage
- route secondaire mobile (`href: null` dans bottom tabs)
- bottom tabs inchangés : Accueil / Cotisations / Notifications / Profil

Anti-IDOR :

- `userId` / `adherentId` / `participantId` query ou body refusés (400)
- participation upsertée uniquement pour l'adhérent authentifié (`actor.userId`)
- aucune PII des autres participants dans le DTO

Hors scope :

- création / désistement / admin
- calendrier natif / cartes / géolocalisation

## Validation Android réelle — Phase 2Q

### Environnement préflight (Fedora)

| Élément | Valeur |
|---------|--------|
| IP LAN | `192.168.x.x` (dev local) |
| Port API | `9052` (`next dev -H 0.0.0.0`) |
| Firewall | `9052/tcp` déjà ouvert |
| `EXPO_PUBLIC_API_URL` | `http://<IP_LAN>:9052` |
| Expo doctor / tsc / tests mobile | verts (45 tests) |

### Bug bloquant observé (STOP backend)

Sans cookie NextAuth, les routes `/api/v1/**` (y compris `/api/v1/auth/login`) reçoivent un **302** vers `/auth/sign-in?callbackUrl=...` via `middleware.ts`.

Contrat attendu (API-V1-CONTRACT §17) : **401 JSON**, pas de redirection HTML.

Conséquence mobile : login / Bearer / refresh **injoignables** tant que le middleware n’exclut pas `/api/v1` (ou n’autorise pas Bearer avant redirect).

**Correction backend requise** (hors scope 2Q auto) — ne pas contourner côté client.

### Parcours téléphone

Non complétés dans cette phase agent (blocage middleware avant Expo Go).

Checklist humaine après correction middleware :

- Boot / sign-in / login réel / `/me`
- Notifications (liste, mark, delete) + Cotisations
- Kill/relaunch SecureStore + refresh 401
- Logout online / offline
- Aucun token dans logs

### Limites restantes

- Validation physique Expo Go en attente du fix middleware
- HTTPS production obligatoire
- Pas iOS local sous Fedora
