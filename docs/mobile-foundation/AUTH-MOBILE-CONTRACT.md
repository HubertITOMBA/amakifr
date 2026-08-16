# Authentification mobile Bearer — contrat (Phases 2I–2K)

> Web NextAuth reste inchangé (`auth.ts`, `auth.config.ts`, `middleware.ts`).  
> Phase 2J : table `MobileRefreshSession` appliquée.  
> Phase 2K : login / refresh / logout / resolver Bearer / composite.

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

Réponses : contrat `/api/v1` (`success` / `error.code`).

## Access token

- JWT via **`jose` 6.1.1** (dépendance directe)
- TTL : **15 minutes** (`MOBILE_ACCESS_TOKEN_TTL_SECONDS`)
- Claims : `sub`, `jti`, `iat`, `exp`, `type=access`
- Pas de password, emailVerified, adminRoles, adherentId, refresh

## Refresh token

- Opaque (`crypto.randomBytes(48)` → base64url)
- Hash **SHA-256** stocké dans `MobileRefreshSession.refreshTokenHash`
- TTL : **30 jours** (`MOBILE_REFRESH_TOKEN_TTL_MS`) — côté service uniquement
- Jamais stocké en clair

## Rotation (consommation unique)

Transaction Prisma avec **consommation atomique** :

```ts
updateMany({ where: { id, revokedAt: null }, data: { revokedAt, lastUsedAt } })
```

| `count` | Comportement |
|---------|----------------|
| `1` | créer le nouveau `MobileRefreshSession` (`rotatedFromId`) |
| `0` | reuse / concurrence — **aucun** second descendant ; révoquer toutes les sessions actives du user **dans la même transaction** (commit), puis `UNAUTHENTICATED` hors transaction |

Un refresh ne peut être consommé **qu'une seule fois**, même sous concurrence.

### Révocation reuse dans la transaction

La révocation globale concurrente est faite **dans** `$transaction` puis le throw a lieu **après** le commit.  
Sinon un throw interne rollbackerait aussi les révocations → état incohérent.

## Reuse detection

1. Lookup : refresh déjà `revokedAt != null` → `updateMany` toutes sessions actives du user (hors tx) → `UNAUTHENTICATED`
2. Course : `updateMany` conditionnel `count === 0` → même politique, **dans** la transaction

## Logout

- révoque le refresh en **PostgreSQL** (source de vérité) — effectif même sans Redis
- blacklist Redis de l'access `jti` avec TTL = temps restant avant `exp` — **best-effort**

### Redis indisponible (fail-open access)

- logout refresh reste effectif (DB)
- un access déjà émis peut rester valide jusqu'à son `exp` (max ~15 min)
- `blacklistAccessTokenJti() === false` ≠ révocation access garantie

Clé Redis : `blacklist:token:${jti}` (compatible `isTokenBlacklisted`).

Redis n'est **jamais** la source de vérité du refresh.

## Resolver Bearer

`resolveApiActorFromBearer(request)` :

1. Authorization / Bearer
2. verify JWT + type access
3. blacklist jti
4. reload User DB (role / status / emailVerified)
5. `AuthContext` avec `channel: "mobile"`, `sessionId = jti`
6. `adminRoles: []`, `adherentId: null` = non résolus

User Inactif ou email non vérifié → refus même si JWT valide.

## Resolver composite — no downgrade

`resolveApiActor(request)` :

- **Authorization présent** → Bearer uniquement. Invalide → 401. **Jamais** de fallback cookie Web.
- **Authorization absent** → `resolveApiActorFromWebSession()`

## Credentials (alignement Web)

| Règle | Comportement |
|-------|----------------|
| Email | `normalizeEmail` |
| Password | bcryptjs |
| Inconnu / mauvais mdp | même message `Identifiants invalides` |
| Inactif | `FORBIDDEN` (message bureau) |
| Email non vérifié | `FORBIDDEN` (Web = OTP ; mobile refuse sans OTP dans 2K) |

Non implémenté en 2K (effets Web `events.signIn`) : lastLogin, loginCount, badges, activity logs.

## Logout — Authorization

| Header | Comportement |
|--------|----------------|
| Absent | OK — logout via `refreshToken` seul |
| `Bearer <token>` valide (syntaxe) | token transmis à `logoutMobileSession` |
| Scheme invalide / Bearer vide / malformé | **401** fail closed — service **non** appelé |

Idempotence conservée : refresh inconnu / déjà révoqué ; access JWT invalide **après** extraction syntaxiquement correcte (géré dans le service).

## Rate limit login

`checkRateLimit("mobile-login:${ip}:${email}")` — 10 req / 15 min.

## Rate limit refresh (risque connu)

`POST /api/v1/auth/refresh` **n'a pas** encore de rate-limit dédié.  
Durcissement recommandé avant production. Non bloquant pour 2K : refresh opaque 48 bytes (haute entropie).
