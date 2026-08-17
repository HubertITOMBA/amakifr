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
