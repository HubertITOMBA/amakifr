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

## Cotisations (Phase A — consultation financière enrichie)

Écran `(app)/cotisations` — **lecture seule** :

| Méthode | Path | Rôle |
|---------|------|------|
| GET | `/api/v1/me/cotisations/year?annee=YYYY` | Synthèse + cotisations + dettes + assistances + historique paiements (année) |
| GET | `/api/v1/me/cotisations-mensuelles` | Liste plate historique (conservée, non utilisée par l’écran Phase A) |

Règles client :

- auth Bearer via `authenticatedFetch` uniquement
- **pas** de `userId` / `adherentId` / `memberId` / `ownerId` query (anti-IDOR backend)
- année civile `YYYY` (défaut = année courante côté client)
- montants DTO en **string** décimale — jamais convertis en `Number` / `parseFloat`
- dates ISO string — affichage local uniquement
- synthèse : `detteBrute` / `avoirDisponible` / `resteNet` / `totalPayeAnnee` (miroir métier Web `getCumulDette`, ownership self-only)
- filtre mois local (Tous / 1–12) — ne recharge pas l’API
- pull-to-refresh sur **toutes** les sections ; en échec réseau après succès, données conservées + erreur non bloquante
- **pas** de mutation cotisation / paiement / upload justificatif
- **pas** de Stripe / Mollie / déclaration virement
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

Écran `(app)/reunions` — titre **« Les réunions »**, ouvert depuis Accueil (tuile « Réunions », pas d'onglet dédié).

Écran secondaire `(app)/reunions-host` — **« Accueillir une réunion »** (proposition d'hôte, `href: null`).

| Méthode | Path |
|---------|------|
| GET | `/api/v1/me/reunions` |
| PATCH | `/api/v1/me/reunions/[id]/participation` |
| GET | `/api/v1/me/reunions/year?annee=YYYY` |
| POST | `/api/v1/me/reunions/host-proposals` |
| DELETE | `/api/v1/me/reunions/[id]/host-proposal` |

Règles client :

- self-service via `actor.userId` côté backend — **pas** de `userId` / `adherentId` / `participantId` / `hostId` / `adherentHoteId` / `force` / `override` client
- auth Bearer via `authenticatedFetch` uniquement ; body = objet JS (pas `JSON.stringify`)
- calendrier **collectif** des réunions mensuelles (identique Web `/reunions-mensuelles`)
- DTO liste : titre, statut, date (uniquement si `DateConfirmee`), lieu compact, adresse lieu (actives/futures), hôte, téléphones hôte (actives/futures), `isHost`, `participationStatus`, `canUpdateParticipation`
- historique : nom hôte + participation read-only ; adresse/téléphone masqués
- participation : `Present` | `Absent` | `Excuse` si `DateConfirmee` future
- **proposition hôte** (phase 2) : calendrier annuel 12 mois (date / hôte / statut) ; body `{ annee, mois }` ; crée `ReunionMensuelle` `EnAttente` si mois libre, ou reclaim si `EnAttente` sans hôte (après désistement)
- **désistement hôte** : `DELETE .../host-proposal` — seul l'hôte courant ; règle Web 28 jours (ou pas de date) ; remet `EnAttente` + `adherentHoteId=null` + `dateReunion=null` ; si `typeLieu=Domicile` → `adresse=null` (PII) ; Restaurant/Autre conservés
- **1 hôte / adhérent / année** en self-service ; recalculé après désistement ; exception multi-hôte = admin uniquement
- mois passé, mois déjà pris, déjà hôte année, date < 28 j → refus serveur (403/409)
- concurrence : contrainte unique `annee+mois` (+ P2002 → 409)
- UI : À venir / Historique + CTA « Proposer d'accueillir une réunion » ; vue annuelle « Se désister » si `canWithdrawAsHost`
- pull-to-refresh ; offline : banner, pas de mutation offline
- bottom tabs inchangés : Accueil / Cotisations / Notifications / Profil

Anti-IDOR :

- identités / override refusés en query et body (400)
- hôte = adhérent résolu via `actor.userId` uniquement

Hors scope :

- changement d'hôte / override 1×/an / actions admin mobile
- géolocalisation / calendrier natif

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
