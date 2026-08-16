# Authentification mobile Bearer — contrat (Phases 2I–2M)

> Web NextAuth reste inchangé (`auth.ts`, `auth.config.ts`, `middleware.ts`).  
> Phase 2K : login / refresh / logout / resolver Bearer / composite.  
> Phase 2M : hardening (rate-limit refresh, Redis dégradé documenté, invariants).

## Variables d'environnement

| Variable | Rôle |
|----------|------|
| `MOBILE_ACCESS_TOKEN_SECRET` | Secret HS256. **Obligatoire**, ≥ **32 octets UTF-8**. Fail closed si absent / vide / trop court (pas de fallback). |

Ne pas committer de secret. Documenter uniquement — ne pas modifier `.env` automatiquement.

## Endpoints

| Méthode | Path | Body |
|---------|------|------|
| POST | `/api/v1/auth/login` | `{ email, password }` strict |
| POST | `/api/v1/auth/refresh` | `{ refreshToken }` strict |
| POST | `/api/v1/auth/logout` | `{ refreshToken? }` + `Authorization: Bearer` optionnel |

Réponses : contrat `/api/v1` (`success` / `error.code`). Cache : `private, no-store`.

## Access token

- JWT via **`jose` 6.1.1** (dépendance directe), alg **HS256** imposé
- TTL : **15 minutes**
- `clockTolerance` : **10 s** (skew mobile léger)
- Claims : `sub`, `jti`, `iat`, `exp`, `type=access`
- Pas d'`iss`/`aud` (non nécessaires en 2M)

## Refresh token

- Opaque (`crypto.randomBytes(48)` → base64url)
- Hash **SHA-256** en DB uniquement
- TTL : **30 jours**
- Multi-device : plusieurs `MobileRefreshSession` actives par user **autorisées**

## Rotation (consommation unique)

`updateMany({ where: { id, revokedAt: null } })` dans transaction :

| `count` | Effet |
|---------|--------|
| `1` | nouveau refresh (`rotatedFromId`) |
| `0` | reuse/concurrence → révocation **toutes** sessions actives du **même** user → `UNAUTHENTICATED` |

Isolation : `where.userId` = propriétaire uniquement — User B jamais touché.

## Reuse detection

Politique de sécurité **globale par user** : un refresh révoqué représenté révoque toutes les sessions actives de ce user (tous appareils).  
Sessions d'un autre user : intactes.

## Logout

| Cas | Comportement |
|-----|----------------|
| refresh valide | révoqué en PostgreSQL |
| refresh inconnu / déjà révoqué | succès idempotent |
| Bearer syntaxe OK | tentative blacklist jti (best-effort) |
| Authorization malformé | **401** |
| Bearer seul (sans refresh) | blacklist access seulement — **aucune** session refresh révoquée (pas de lien jti→refresh dans le modèle) |

## Redis / blacklist (best-effort)

| Composant | Rôle |
|-----------|------|
| PostgreSQL refresh | **source de vérité** |
| Redis `blacklist:token:${jti}` | complément access, TTL = restant avant `exp` |

Redis down / erreur :

- rate-limit : fallback **mémoire** (`checkRateLimit` fail-open vers Map locale)
- blacklist : `isTokenBlacklisted` → `false` → access peut rester valide jusqu'à `exp` (~15 min max)
- API Bearer reste disponible (JWT + User DB)
- **ne pas** présenter logout access comme immédiat garanti sans Redis

## Rate limits

| Route | Clé | Seuil |
|-------|-----|-------|
| login | `mobile-login:${ip}:${emailNorm}` | **10 / 15 min** |
| refresh | `mobile-refresh:${ip}:${sha256(refresh).slice(0,16)}` | **30 / 15 min** |

Jamais password ni refresh brut dans la clé.  
`x-forwarded-for` : fiable seulement derrière reverse proxy contrôlé.

## Resolver / no-downgrade

- Authorization présent → Bearer uniquement ; invalide → 401 ; **jamais** cookie
- Authorization absent → Web NextAuth
- `adminRoles` / `adherentId` : **non résolus** (self-service actuel)

## Credentials

| Règle | Code public |
|-------|-------------|
| Inconnu / mauvais mdp | 401 `Identifiants invalides` |
| Inactif / email non vérifié | 403 |
| Rate limit | 429 |
| Body invalide | 400 |

Refresh : messages génériques `Session invalide` / `Session expirée` — pas d'id/hash.

## Hardening Phase 2M

- Rate-limit refresh (IP + digest)
- Fail mode Redis documenté (best-effort)
- clockTolerance 10 s
- Isolation reuse User A / User B testée
- Multi-device + reuse global documentés
- Logs : pas de password / tokens / Authorization / secret
- Cleanup sessions expirées/révoquées : **futur** (pas de cron en 2M)

## Checklist avant Expo / React Native

- [ ] `MOBILE_ACCESS_TOKEN_SECRET` configuré en production (≥ 32 octets)
- [ ] HTTPS obligatoire
- [ ] reverse proxy `x-forwarded-for` contrôlé
- [ ] rate-limit login actif
- [ ] rate-limit refresh actif
- [ ] backups PostgreSQL
- [ ] monitoring Redis (blacklist best-effort)
- [ ] plan cleanup refresh sessions
- [ ] tests auth verts
- [ ] build vert

**Ne pas démarrer Expo tant que cette checklist n'est pas validée en environnement cible.**
