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
