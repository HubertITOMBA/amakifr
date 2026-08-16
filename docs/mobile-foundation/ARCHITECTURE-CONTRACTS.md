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


