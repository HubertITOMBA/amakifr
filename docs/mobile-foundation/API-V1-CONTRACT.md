# Contrat API `/api/v1` — fondation mobile (Phase 2H)

> Authentification **temporaire** : session Web NextAuth via cookies.  
> Le futur mobile utilisera **Bearer** (non implémenté ici).  
> Ne pas transporter les cookies NextAuth vers React Native / Expo.

## 1. Format succès

```json
{ "success": true, "data": { } }
```

Sans payload :

```json
{ "success": true }
```

## 2. Format erreur

```json
{
  "success": false,
  "error": {
    "code": "NOT_FOUND",
    "message": "..."
  }
}
```

Jamais : stack, SQL, objet Prisma, secrets.

## 3. Mapping ServiceError → HTTP

| Code | HTTP |
|------|------|
| VALIDATION_ERROR | 400 |
| UNAUTHENTICATED | 401 |
| FORBIDDEN | 403 |
| NOT_FOUND | 404 |
| CONFLICT | 409 |
| RATE_LIMITED | 429 |
| INTERNAL_ERROR | 500 |

Erreur inconnue → 500 `INTERNAL_ERROR` générique (fail closed).

## 4. Routes créées (lecture)

| Méthode | Path | Service |
|---------|------|---------|
| GET | `/api/v1/me` | `getMe` |
| GET | `/api/v1/me/notifications` | `getMyNotifications` |
| GET | `/api/v1/me/notifications/unread-count` | `getMyUnreadNotificationCount` |
| GET | `/api/v1/me/cotisations-mensuelles` | `getMyCotisationsMensuelles` |

## 5. Authentification temporaire

`resolveApiActorFromWebSession()` (`lib/api/auth-web.ts`) :

- lit `auth()` NextAuth
- sources réelles : `userId` (token.sub), `role` (User.role), `status` (User.status), `sessionId` (token.jti), email/name
- **fail closed** si id / role / status absents — **aucun** fallback `"MEMBRE"` / `"Actif"`
- `adminRoles: []` et `adherentId: null` = **non résolus** (pas des faits métier) ; cotisations résolvent Adherent dans le service

## 6. Future auth Bearer

Hors Phase 2H. Même `AuthContext` ; autre resolver transport.

## 7. Pas de Prisma dans les routes

Les `route.ts` appellent uniquement services + helpers API.

## 8. AuthContext

Services inchangés. Routes = adapters HTTP minces.

## 9–11. DTO JSON-safe

- Notifications / Me : dates ISO déjà dans services
- Cotisations : montants **string**, dates **ISO** — **pas** reconvertis en Number côté API

## 12. Cache

`Cache-Control: private, no-store` sur les réponses `/api/v1` helpers.

## 13. Anti-IDOR

- Pas de `userId` / `adherentId` query acceptés
- Self via `actor.userId` uniquement

## 14. Routes non implémentées

- `POST/PATCH/DELETE` notifications
- auth login / refresh / logout / revoke
- paiements, admin, batch cotisations
- Bearer

## 15. Query notifications

- `lue` : `true` \| `false`
- `type` : enum `TypeNotification`
- `limit` : 1–100 (défaut service 50)
- `offset` : ≥ 0

## 16. CORS / rate limit

- Pas de CORS `*` global ajouté
- Rate limit critique prévu sur futurs `/auth/login` et `/auth/refresh`
- CORS navigateur surtout pertinent pour Expo Web futur

## 17. 401

JSON uniquement — pas de redirection HTML `/auth/sign-in`.

