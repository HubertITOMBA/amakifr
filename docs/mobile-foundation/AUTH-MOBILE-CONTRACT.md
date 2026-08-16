# Authentification mobile Bearer — contrat (Phases 2I–2J)

> Web NextAuth reste inchangé.  
> Phase 2I : STOP — besoin de persistence refresh.  
> Phase 2J : modèle `MobileRefreshSession` + migration SQL **générée, NON appliquée**.

## Audit (rappel)

| Élément | Constat |
|---------|---------|
| Password | `User.password` (bcryptjs) |
| Credentials | `auth.config.ts` |
| Session NextAuth | JWT + blacklist Redis `jti` |
| Refresh mobile | **PostgreSQL** via `MobileRefreshSession` |

## Modèle final (schema.prisma)

Table SQL : `mobile_refresh_sessions`

| Champ | Rôle |
|-------|------|
| `id` | cuid PK |
| `userId` | FK → `users.id`, **Cascade** |
| `refreshTokenHash` | hash du refresh opaque — **unique**, jamais le token brut |
| `createdAt` | création |
| `expiresAt` | expiration (durée décidée par le service auth, pas dans le schema) |
| `lastUsedAt` | dernier usage |
| `revokedAt` | `null` = active (si non expirée) ; date = révoquée |
| `rotatedFromId` | self-FK vers session précédente — **SetNull** à la suppression |

Indexes : `refreshTokenHash` unique, `userId`, `expiresAt`, `revokedAt`.

Relation User : `mobileRefreshSessions MobileRefreshSession[]`.

**Pas** de deviceName / userAgent / pushToken dans cette phase.

## Migration

Dossier : `prisma/migrations/20260816154500_add_mobile_refresh_session/`

Génération SQL (sans toucher la DB) :

```bash
npx prisma migrate diff \
  --from-schema-datamodel <schema-HEAD> \
  --to-schema-datamodel prisma/schema.prisma \
  --script
```

**Appliquée sur PostgreSQL ? NON.**

### Déploiement futur (à exécuter manuellement plus tard)

1. Backup DB
2. `npx prisma migrate deploy` (environnement approprié)
3. Vérifier table + indexes + FKs
4. Plan de rollback : drop table `mobile_refresh_sessions` uniquement si jamais utilisée en prod

## Access / refresh (rappel — non implémentés)

- Access JWT ~15 min, claims `sub/jti/iat/exp/type=access`
- Refresh opaque + hash serveur + rotation
- Redis optionnel : blacklist access `jti` au logout

## Non créé encore

login / refresh / logout API, Bearer resolver, Expo, React Native, `auth.ts` modifié.
