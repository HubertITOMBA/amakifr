# Contrats d’architecture — fondation mobile (Phase 2A)

> Décisions validées après Phase 1.5.  
> Ne remplace pas `docs/mobile-audit/*` (référence d’audit inchangée).

## 1. Objectif

Préparer un backend partageable entre :

- Next.js Web (Server Actions + cookies)
- future API `/api/v1` (Bearer)
- futur client Expo / React Native

sans exposer PostgreSQL ni Prisma au mobile.

## 2. Prisma

| Règle | Décision |
|-------|----------|
| Client canonique pour **tout nouveau code** | `import { db } from "@/lib/db"` |
| Unification des imports historiques `@/lib/prisma` | **Reportée** (après service + validation Web + tests) |
| `lib/prisma.ts` | Ne pas modifier dans la Phase 2A |

## 3. Couches

```
HTTP / Server Action          ← adapters (Web ou futur /v1)
        │
Authentication                ← résout l’identité (hors services)
        │
Authorization                 ← progressive ; getMe = self via AuthContext
        │
Validation                    ← Zod côté serveur
        │
Business Service (lib/services)
        │
Prisma (db)
        │
PostgreSQL
```

## 4. Services métier (`lib/services/**`)

Un service :

- ne dépend pas de React, cookies, `Request`/`Response`, `revalidatePath`, toast, Expo
- peut utiliser `db`, Zod, mail/paiement/Redis **serveur**
- reçoit idéalement un `AuthContext` déjà authentifié
- n’applique **pas** de règle métier différente selon `channel` (`web` | `mobile` | `system`)

## 5. Server Actions

Rôle futur : adapters Web.

```
auth() → AuthContext → service → revalidatePath? → { success, data/error }
```

La logique métier migre progressivement hors des actions.

## 6. Future API `/api/v1`

Non créée en Phase 2A. Sera un adapter HTTP Bearer vers les **mêmes** services.

## 7. AuthContext

Type commun Web / Mobile (`lib/auth-context.ts`).  
Les services ne savent pas si l’identité vient d’un cookie ou d’un Bearer.

## 8. Permissions

Les permissions dynamiques legacy (clés = noms de Server Actions) sont **conservées** pour l’instant.  
Pas de migration `Permission.action` ni de moteur `authorize` global branché en Phase 2A.

## 9. Mobile

- Pas d’accès PostgreSQL
- Pas de Prisma embarqué
- Pas d’Expo / React Native dans cette phase

## 10. Premier service

`getMe(actor: AuthContext): Promise<MeDto>` — lecture self-service sans effet de bord.

## 11. Séparation getMe / getUserProfile (Phase 2A corrigée)

| Contrat | Rôle |
|---------|------|
| `getMe` / `MeDto` | DTO minimal futur Web+Mobile — **sans** `providerAccountId` |
| `getUserProfile` | Contrat Web **historique** — conserve `providerAccountId` réel via sa propre requête Prisma |

`getUserProfile` n’est **pas** délégué à `getMe` tant que cela imposerait d’élargir MeDto ou de fabriquer des valeurs artificielles.

## 12. AuthContext minimal pour getMe — ne pas généraliser

Lorsqu’un adapter construit un `AuthContext` uniquement pour appeler `getMe`, des champs peuvent être laissés vides :

- `adminRoles: []`
- `adherentId: null`

Ces valeurs sont **acceptables pour getMe** (self-service basé sur `actor.userId` seul).

Elles **ne doivent PAS** devenir le resolver AuthContext générique des futures opérations protégées (permissions, ownership, admin). Un resolver riche (rôles bureau, adherentId résolu) sera introduit plus tard, hors Phase 2A.

## 13. Authorization (`lib/authorize.ts`) — Phase 2C

### Rôle

`authorize()` est une **façade commune** au-dessus du système existant `hasPermission` (`lib/dynamic-permissions.ts`).

Elle ne recopie pas la logique métier des permissions : elle l’orchestre.

### Flux

```
AuthContext (déjà authentifié)
        │
        v
authorize({ actor, permissionKey, type })
        │
        ├── userId manquant → ServiceError UNAUTHENTICATED
        ├── role ADMIN → OK (bypass, sans appeler hasPermission)
        └── sinon hasPermission(userId, permissionKey, type)
                ├── true → OK
                ├── false → ServiceError FORBIDDEN
                └── throw → ServiceError INTERNAL_ERROR (fail closed)
```

### Règles

1. Reçoit `AuthContext` — **ne réalise pas** l’authentification  
2. Indépendante de cookies / Request / Response / NextAuth / `auth()`  
3. Bypass **ADMIN** via `actor.role` normalisé (aligné historique `User.role === ADMIN`)  
4. `permissionKey` = clés **legacy** `Permission.action` (noms de Server Actions)  
5. Types : `READ` | `WRITE` | `DELETE` | `MANAGE` → `PermissionType` Prisma  
6. **Fail closed** : incertitude = refus  
7. Erreur technique du moteur → `INTERNAL_ERROR` (accès toujours refusé ; distinct de `FORBIDDEN` métier)  
8. Ownership / règles métier complexes → **services**, pas `authorize()`  
9. Migration future `resource:action` → **reportée** (TODO dans le code)  
10. Utilisable plus tard par Server Actions Web **et** API `/v1` mobile  

### Non branché

Phase 2C ne remplace pas les `canRead` / `assertAdmin` existants dans les actions.  
Le branchement se fera domaine par domaine lors de l’extraction des services.

### getMe

`getMe` reste une lecture self-service sur `actor.userId` et **n’appelle pas** `authorize()` dans cette phase.

## 14. Notification service extraction (Phase 2D)

### Fonctions extraites

| Service | Server Action (adapter Web) |
|---------|------------------------------|
| `getMyNotifications(actor, options?)` | `getNotifications(options?)` |
| `getMyUnreadNotificationCount(actor)` | `getUnreadNotificationCount()` |

Fichiers : `lib/services/notifications/{types,get-my-notifications,get-my-unread-count}.ts`

### AuthContext

Adapter Web : `auth()` → `AuthContext` minimal (`userId` + `role` session).  
Les champs `adminRoles` / `adherentId` sont laissés vides **uniquement** car ces lectures self-service ne les utilisent pas (pas d’`authorize()`).

### Autorisation

**Pas** d’`authorize()` : comportement historique = session cookie uniquement, filtre Prisma `userId: actor.userId`.  
Self-service : jamais d’`userId` client arbitraire dans le service.

### DTO

`NotificationDto` : `id`, `userId`, `type`, `titre`, `message`, `lien`, `lue`, `createdAt` (ISO).  
Pas de secrets / tokens / password.

### Contrat Web `createdAt` (non-régression)

| Couche | `createdAt` |
|--------|-------------|
| Service `NotificationDto` | **string ISO** (partage Web/mobile) |
| Server Action `getNotifications()` | **`Date`** (contrat historique Prisma) via `mapNotificationDtoForWebAction` |

Preuve consommateurs directs de `getNotifications()` uniquement :

- `components/notifications/NotificationCenter.tsx` — client, `new Date(notification.createdAt)`
- `app/notifications/page.tsx` — client, idem

(`app/admin/notifications` utilise `getAllNotifications`, hors périmètre.)

Les clients tolèrent Date ou string via `new Date(...)`, mais le **contrat de la Server Action** avant 2D était un `Date` Prisma côté serveur → l’adapter Web le restitue.

### Next.js

Les services n’appellent pas `auth()`, cookies, headers, `revalidatePath` / `revalidateTag`.  
Email / PDF / rappel restent hors extraction (non touchés en 2D/2E).

### Contrat Web préservé

Retours `{ success, notifications }` / `{ success, count }` / `{ success: false, error }` inchangés pour les consommateurs (`NotificationCenter`, `/notifications`).

## 15. Notifications mutations self-service (Phase 2E)

### Services extraits

| Service | Server Action (adapter Web) |
|---------|------------------------------|
| `markMyNotificationAsRead(actor, notificationId)` | `markNotificationAsRead(notificationId)` |
| `markAllMyNotificationsAsRead(actor)` | `markAllNotificationsAsRead()` |
| `deleteMyNotification(actor, notificationId)` | `deleteNotification(notificationId)` |

Fichiers : `lib/services/notifications/{mark-my-notification-as-read,mark-all-my-notifications-as-read,delete-my-notification,require-actor-user-id}.ts`

### Ownership / anti-IDOR

- Source de vérité : `actor.userId` uniquement (pas d’`userId` client).
- Mark one / delete : `updateMany` / `deleteMany` avec `where: { id, userId: actor.userId }`.
- Mark all : `updateMany` avec `where: { userId: actor.userId, lue: false }`.
- `count === 0` → `NOT_FOUND` « Notification non trouvée » (inexistant **ou** autre propriétaire — **pas de fuite**).

### Durcissement documenté vs historique

Historique mark/delete one : autre propriétaire → `"Non autorisé"` ; absent → `"Notification non trouvée"`.  
Phase 2E : les deux cas → `"Notification non trouvée"` (même code métier `NOT_FOUND`).  
Pas de bypass ADMIN sur ces trois actions (l’historique n’en avait déjà pas).

### Autorisation

**Pas** d’`authorize()` (self-service identité + ownership, comme avant).

### revalidatePath

Uniquement dans les Server Actions adapters : `/notifications` et `/` après succès.  
Les services n’appellent pas Next.js cache.

### Contrat Web (hors durcissement ci-dessus)

| Aspect | Préservé |
|--------|----------|
| Signatures | oui |
| Messages succès | oui |
| `count === 0` sur mark-all | succès (pas d’erreur) |
| Idempotence mark-one déjà lue | succès |
| Erreurs génériques Prisma | messages historiques |

Consommateurs : `NotificationCenter`, `app/notifications/page.tsx` ; admin liste utilise aussi `deleteNotification` (même ownership self — pas de delete cross-user admin via cette action).

## 16. Cotisations — mes cotisations mensuelles (Phase 2G)

### Service

`getMyCotisationsMensuelles(actor: AuthContext): Promise<CotisationMensuelleDto[]>`

Fichiers : `lib/services/cotisations/{types,get-my-cotisations-mensuelles,decimal-to-money-string}.ts`

### Résolution User → Adherent (anti-IDOR)

1. Vérifie `actor.userId`
2. `db.adherent.findUnique({ where: { userId: actor.userId } })`
3. Charge `CotisationMensuelle` avec `where: { adherentId }` résolu serveur

**Jamais** d’`adherentId` / `userId` client.

### Autorisation

- **Pas** d’`authorize()` / `canRead`
- Ownership implicite via résolution Adherent
- **Pas** de bypass ADMIN cross-user dans ce service (self uniquement)

### Server Action Web historique

`getCotisationsMensuellesAdherent(adherentId)` dans `actions/cotisations-mensuelles/index.ts` :

- **non modifiée** en Phase 2G
- conserve owner **OU** `UserRole.ADMIN` (ADMIN strict, pas bureau)
- aucun consommateur UI actuel ; contrat public préservé intact

Le mapper Web sera créé uniquement lorsqu'une délégation réelle de `getCotisationsMensuellesAdherent` vers le service sera décidée, afin de reproduire exactement son contrat historique.

### DTO `CotisationMensuelleDto`

Montants : **string** via `Prisma.Decimal.toString()` (API publique `@prisma/client` ; ex. `"25"`, `"25.5"`, `"0"`).  
Dates : **ISO string**.

Champs : id, periode, annee, mois, typeCotisationId, adherentId, adherentBeneficiaireId, montants, dateEcheance, statut, description, cotisationDuMoisId, createdAt, updatedAt, typeCotisation (sous-ensemble).

**Exclus** : User, Adherent complet, Paiements, Stripe/Mollie/PayPal, receiptUrl, justificatifs, createdBy, password.

### Hors scope (risques financiers restants)

Batch affectation, paiements, avoirs, dettes, CdM CRUD, types, `getUserData` / profil — non touchés.

## 17. API `/api/v1` fondation (Phase 2H)

Voir `docs/mobile-foundation/API-V1-CONTRACT.md`.

- Helpers : `lib/api/{types,response,errors,auth-web}.ts`
- Auth temporaire Web : `resolveApiActorFromWebSession` (pas Bearer) — fail closed, sans fallback rôle/status inventés
- Routes lecture : `/api/v1/me`, `/me/notifications`, `/me/notifications/unread-count`, `/me/cotisations-mensuelles`
- Mapping HTTP centralisé ; aucun Prisma dans les routes


