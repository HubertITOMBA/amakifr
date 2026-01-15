# Système de Détection de Build ID avec Refresh Automatique

## 📋 Problème résolu

Après chaque build en production, les utilisateurs peuvent recevoir l'erreur :
```
[Error: Failed to find Server Action "x". This request might be from an older or newer deployment.
```

Ce problème survient lorsqu'un utilisateur a une page ouverte avec un ancien build et qu'un nouveau déploiement a eu lieu. Les Server Actions sont liées à un build spécifique, et si le build change, les anciennes actions ne sont plus valides.

## ✅ Solution implémentée

Un système de détection de build ID qui :
1. Génère un build ID unique à chaque build
2. Vérifie périodiquement (toutes les 30 secondes) si le build ID a changé
3. Force automatiquement un refresh de la page si un nouveau build est détecté

## 🏗️ Architecture

### 1. Génération du Build ID

**Fichier :** `scripts/generate-build-id.js`

Ce script est exécuté automatiquement lors de chaque build (`npm run build`). Il :
- Génère un build ID unique basé sur le timestamp et un hash aléatoire
- Sauvegarde le build ID dans `public/build-id.json`
- Le fichier contient : `buildId`, `timestamp`, et `version`

### 2. API Route

**Fichier :** `app/api/build-id/route.ts`

Expose le build ID actuel via l'endpoint `/api/build-id`. Les headers de cache sont configurés pour éviter la mise en cache et toujours retourner la version la plus récente.

### 3. Hook React

**Fichier :** `hooks/use-build-id.ts`

Hook personnalisé qui :
- Récupère le build ID initial au chargement de la page
- Vérifie périodiquement (par défaut toutes les 30 secondes) si le build ID a changé
- Retourne `true` si un nouveau build est détecté
- Force un `window.location.reload()` si le build ID change

### 4. Composant de Vérification

**Fichier :** `components/BuildIdChecker.tsx`

Composant invisible intégré dans le layout principal qui utilise le hook `useBuildId` pour vérifier automatiquement les nouveaux builds.

## 🔧 Configuration

### Intervalle de vérification

Par défaut, la vérification se fait toutes les 30 secondes. Pour modifier cet intervalle :

```tsx
// Dans components/BuildIdChecker.tsx
const { buildInfo, isChecking } = useBuildId(60000); // 60 secondes
```

### Désactiver la vérification

Pour désactiver temporairement la vérification, commentez le composant dans `app/layout.tsx` :

```tsx
// <BuildIdChecker />
```

## 📦 Déploiement

### Build automatique

Le build ID est généré automatiquement lors de `npm run build`. Aucune action supplémentaire n'est nécessaire.

### Vérification manuelle

Pour vérifier que le système fonctionne :

1. **Vérifier le build ID actuel :**
   ```bash
   cat public/build-id.json
   ```

2. **Tester l'API :**
   ```bash
   curl http://localhost:9060/api/build-id
   ```

3. **Simuler un nouveau build :**
   - Modifier `scripts/generate-build-id.js` pour forcer un nouveau build ID
   - Ou simplement relancer `npm run build`

## 🧪 Tests

### Test en développement

1. Démarrer l'application : `npm run dev`
2. Ouvrir la console du navigateur
3. Attendre 30 secondes - vous devriez voir le build ID dans les logs
4. Modifier manuellement `public/build-id.json` avec un nouveau build ID
5. Attendre 30 secondes - la page devrait se rafraîchir automatiquement

### Test en production

1. Déployer l'application avec un build ID initial
2. Ouvrir une page dans le navigateur
3. Effectuer un nouveau déploiement (nouveau build ID généré)
4. Attendre maximum 30 secondes - la page devrait se rafraîchir automatiquement

## 📊 Monitoring

### Logs en développement

En mode développement, le hook log le build ID actuel dans la console :
```
📦 Build ID actuel: 1768476426528-f22033a40ac0d937
```

### Logs lors d'un changement

Lorsqu'un nouveau build est détecté :
```
🔄 Nouveau build détecté: {
  ancien: "1768476426528-f22033a40ac0d937",
  nouveau: "1768476426529-abc123def456"
}
```

## ⚙️ Personnalisation

### Modifier l'intervalle de vérification

```tsx
// Dans components/BuildIdChecker.tsx
export function BuildIdChecker() {
  const { buildInfo, isChecking } = useBuildId(60000); // 60 secondes au lieu de 30
  // ...
}
```

### Ajouter des informations supplémentaires

Modifier `scripts/generate-build-id.js` pour ajouter des métadonnées :

```javascript
const buildInfo = {
  buildId,
  timestamp: buildTimestamp,
  version: process.env.npm_package_version || '0.1.0',
  gitCommit: process.env.GIT_COMMIT || 'unknown', // Si disponible
  environment: process.env.NODE_ENV || 'development',
};
```

## 🔍 Dépannage

### Le refresh ne se déclenche pas

1. Vérifier que le composant `BuildIdChecker` est bien dans le layout
2. Vérifier la console du navigateur pour les erreurs
3. Vérifier que l'API `/api/build-id` répond correctement
4. Vérifier que le fichier `public/build-id.json` existe et est valide

### Erreur "Failed to fetch build ID"

1. Vérifier que l'API route est accessible
2. Vérifier les logs serveur pour les erreurs
3. Vérifier que le fichier `public/build-id.json` existe

### Build ID non généré

1. Vérifier que le script `scripts/generate-build-id.js` est exécutable
2. Vérifier que le script est appelé dans `package.json` avant `next build`
3. Vérifier les permissions d'écriture dans le répertoire `public/`

## 📝 Notes importantes

- Le fichier `public/build-id.json` est généré automatiquement et ne doit **pas** être versionné (déjà dans `.gitignore`)
- Le système fonctionne uniquement côté client (navigateur)
- Le refresh est automatique et ne peut pas être annulé par l'utilisateur
- En développement, le système fonctionne mais peut être moins visible (logs console)

## 🚀 Avantages

1. **Résout automatiquement** le problème "Failed to find Server Action"
2. **Transparent pour l'utilisateur** - refresh automatique sans intervention
3. **Léger** - vérification toutes les 30 secondes, impact minimal sur les performances
4. **Fiable** - détection basée sur un identifiant unique par build
5. **Facile à maintenir** - génération automatique, aucune configuration manuelle requise
