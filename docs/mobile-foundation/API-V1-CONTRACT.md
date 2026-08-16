# Contrat API `/api/v1` — fondation mobile (Phases 2H–2L)

> Auth composite : session Web NextAuth **ou** Bearer mobile (`resolveApiActor`).  
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

## 4. Routes lecture

| Méthode | Path | Service |
|---------|------|---------|
| GET | `/api/v1/me` | `getMe` |
| GET | `/api/v1/me/notifications` | `getMyNotifications` |
| GET | `/api/v1/me/notifications/unread-count` | `getMyUnreadNotificationCount` |
| GET | `/api/v1/me/cotisations-mensuelles` | `getMyCotisationsMensuelles` |

## 4bis. Mutations Notifications (Phase 2L)

| Méthode | Path | Service | Réponse `data` |
|---------|------|---------|----------------|
| PATCH | `/api/v1/me/notifications/:id/read` | `markMyNotificationAsRead` | `{ updated: true }` |
| POST | `/api/v1/me/notifications/read-all` | `markAllMyNotificationsAsRead` | `{ count: n }` |
| DELETE | `/api/v1/me/notifications/:id` | `deleteMyNotification` | `{ deleted: true }` |

Règles :

- Auth : `resolveApiActor` (Bearer / Web, no-downgrade)
- Ownership : `actor.userId` dans le service uniquement — **pas** de `userId` client
- Inexistante / autre user → `NOT_FOUND` 404 (même message)
- Mark one déjà lue → succès idempotent
- Mark all `count === 0` → succès
- **Pas** de `revalidatePath` (réservé aux Server Actions Web)
- **Pas** de Prisma dans les routes
- HTTP succès : **200** + JSON standard
- Rate-limit dédié mutations : non (auth requise) ; durcissement futur si abuse

## 5. Authentification (Phase 2K)

Resolver composite : `resolveApiActor(request)` (`lib/api/auth-resolve.ts`).

- **Authorization présent** → Bearer mobile (`resolveApiActorFromBearer`) — **no downgrade** vers cookie
- **Authorization absent** → Web NextAuth (`resolveApiActorFromWebSession`)

Web resolver (`lib/api/auth-web.ts`) :

- lit `auth()` NextAuth
- sources réelles : `userId` (token.sub), `role`, `status`, `sessionId` (token.jti), email/name
- **fail closed** si id / role / status absents — **aucun** fallback `"MEMBRE"` / `"Actif"`
- `adminRoles: []` et `adherentId: null` = **non résolus**

Bearer : voir `AUTH-MOBILE-CONTRACT.md` (JWT 15 min, refresh 30 j, role/status relus DB).

## 6. Auth mobile endpoints

| Méthode | Path |
|---------|------|
| POST | `/api/v1/auth/login` |
| POST | `/api/v1/auth/refresh` |
| POST | `/api/v1/auth/logout` |

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

- createNotification / admin Notifications API
- paiements, admin, batch cotisations
- OAuth mobile / OTP mobile

## 15. Query notifications

- `lue` : `true` \| `false`
- `type` : enum `TypeNotification`
- `limit` : 1–100 (défaut service 50)
- `offset` : ≥ 0

## 16. CORS / rate limit

- Pas de CORS `*` global ajouté
- Rate limit login mobile : 10 / 15 min (`IP + email`)
- Rate limit refresh mobile : 30 / 15 min (`IP + digest SHA-256`) — Phase 2M
- CORS navigateur surtout pertinent pour Expo Web futur

## 17. 401

JSON uniquement — pas de redirection HTML `/auth/sign-in`.

