# 🔧 Mode Maintenance - AMAKI France

Guide complet pour gérer le mode maintenance lors des mises à jour en production.

---

## 📋 Table des matières

1. [Vue d'ensemble](#vue-densemble)
2. [Installation initiale](#installation-initiale)
3. [Utilisation](#utilisation)
4. [Fonctionnement technique](#fonctionnement-technique)
5. [Personnalisation](#personnalisation)
6. [Dépannage](#dépannage)
7. [Bonnes pratiques](#bonnes-pratiques)

---

## 🎯 Vue d'ensemble

Le mode maintenance permet d'afficher une **page d'attente élégante** aux utilisateurs pendant les mises à jour de l'application. Au lieu de voir des erreurs, ils voient un message professionnel les informant que le site sera bientôt de retour.

### ✨ Fonctionnalités

- ✅ **Page HTML élégante** avec animations et design moderne
- ✅ **Activation/désactivation simple** via scripts bash
- ✅ **Rafraîchissement automatique** toutes les 30 secondes
- ✅ **Compteur de temps estimé** pour rassurer les utilisateurs
- ✅ **Responsive** (mobile, tablette, desktop)
- ✅ **Mode sombre automatique** si préféré par l'utilisateur
- ✅ **Zero downtime** lors du basculement
- ✅ **Exceptions IP** possibles pour les administrateurs

### 📁 Fichiers créés

```
amakifr/
├── public/
│   └── maintenance.html              # Page de maintenance
├── scripts/
│   ├── maintenance-on.sh             # Script d'activation
│   └── maintenance-off.sh            # Script de désactivation
└── nginx-maintenance.conf            # Configuration nginx
```

---

## 🚀 Installation initiale

### Étape 1 : Mettre à jour nginx

1. **Ouvrir la configuration nginx de votre site**

```bash
sudo nano /etc/nginx/sites-available/amaki
# ou
sudo nano /etc/nginx/conf.d/amaki.conf
```

2. **Ajouter la configuration du mode maintenance**

Copiez le contenu de `nginx-maintenance.conf` et collez-le dans votre configuration nginx **AVANT les directives `location /`**.

Exemple d'emplacement :

```nginx
server {
    listen 443 ssl http2;
    server_name votre-domaine.fr;
    
    # SSL, logs, etc...
    
    ############################################
    # MODE MAINTENANCE - À PLACER ICI
    ############################################
    
    set $maintenance 0;
    
    if (-f /sites/amakifr/maintenance.flag) {
        set $maintenance 1;
    }
    
    if ($maintenance = 1) {
        return 503;
    }
    
    error_page 503 @maintenance;
    
    location @maintenance {
        allow all;
        root /sites/amakifr/.next/server/app;
        rewrite ^(.*)$ /maintenance.html break;
        add_header Cache-Control "no-store, no-cache, must-revalidate";
        default_type text/html;
    }
    
    ############################################
    # FIN MODE MAINTENANCE
    ############################################
    
    # Vos autres locations (/, /_next, etc.)
    location / {
        proxy_pass http://localhost:3000;
        # ...
    }
}
```

3. **Adapter les chemins si nécessaire**

Par défaut, la configuration utilise :
- Fichier flag : `/sites/amakifr/maintenance.flag`
- Page HTML : `/sites/amakifr/.next/server/app/maintenance.html`

Modifiez ces chemins selon votre configuration.

4. **Tester la configuration nginx**

```bash
sudo nginx -t
```

Vous devriez voir :
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

5. **Recharger nginx**

```bash
sudo systemctl reload nginx
```

### Étape 2 : Déployer les fichiers

1. **Déployer le projet sur le serveur**

```bash
# Depuis votre machine locale
git add .
git commit -m "feat: Ajout du mode maintenance"
git push origin main

# Sur le serveur
cd /sites/amakifr
git pull origin main
```

2. **Copier la page de maintenance (sera fait automatiquement)**

Le script `maintenance-on.sh` copiera automatiquement `public/maintenance.html` vers `.next/server/app/maintenance.html`.

### Étape 3 : Tester le mode maintenance

```bash
# Sur le serveur
cd /sites/amakifr
bash scripts/maintenance-on.sh
```

Ouvrez votre navigateur et accédez à votre site. Vous devriez voir la page de maintenance.

```bash
# Désactiver le mode maintenance
bash scripts/maintenance-off.sh
```

Le site devrait être accessible normalement.

---

## 💻 Utilisation

### Activer le mode maintenance

**Depuis le serveur de production :**

```bash
cd /sites/amakifr
bash scripts/maintenance-on.sh
```

Le script va :
1. ✅ Créer le fichier flag `/sites/amakifr/maintenance.flag`
2. ✅ Copier `public/maintenance.html` vers `.next/server/app/maintenance.html`
3. ✅ Recharger nginx
4. ✅ Afficher un résumé de l'activation

**Sortie attendue :**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧  ACTIVATION DU MODE MAINTENANCE - AMAKI FRANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  Cette action va activer le mode maintenance.
   Tous les utilisateurs verront la page de maintenance.

Voulez-vous continuer ? (o/n) : o

📝 Étape 1/3: Création du fichier flag...
   ✅ Fichier flag créé: /sites/amakifr/maintenance.flag
   ✅ Horodatage ajouté au fichier flag

📄 Étape 2/3: Copie de la page de maintenance...
   ✅ Page de maintenance copiée vers: /sites/amakifr/.next/server/app/maintenance.html
   ✅ Permissions définies (644)

🔄 Étape 3/3: Rechargement de la configuration nginx...
   ✅ Configuration nginx valide
   ✅ Nginx rechargé avec succès

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  MODE MAINTENANCE ACTIVÉ !
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Statut:
   • Fichier flag: /sites/amakifr/maintenance.flag
   • Page HTML: /sites/amakifr/.next/server/app/maintenance.html
   • Date d'activation: 12/01/2026 à 15:30:00

💡 Tous les utilisateurs voient maintenant la page de maintenance.
   La page se rafraîchit automatiquement toutes les 30 secondes.

ℹ️  Pour désactiver le mode maintenance:
   bash scripts/maintenance-off.sh
```

### Désactiver le mode maintenance

**Depuis le serveur de production :**

```bash
cd /sites/amakifr
bash scripts/maintenance-off.sh
```

Le script va :
1. ✅ Supprimer le fichier flag `/sites/amakifr/maintenance.flag`
2. ✅ Recharger nginx
3. ✅ Afficher un résumé de la désactivation

**Sortie attendue :**

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  DÉSACTIVATION DU MODE MAINTENANCE - AMAKI FRANCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Informations du mode maintenance:
   Maintenance activée le mar. 12 janv. 2026 15:30:00 CET

Voulez-vous désactiver le mode maintenance ? (o/n) : o

🗑️  Suppression du fichier flag...
   ✅ Fichier flag supprimé: /sites/amakifr/maintenance.flag

🔄 Rechargement de la configuration nginx...
   ✅ Configuration nginx valide
   ✅ Nginx rechargé avec succès

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅  MODE MAINTENANCE DÉSACTIVÉ !
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📌 Statut:
   • Mode maintenance: Désactivé
   • Date de désactivation: 12/01/2026 à 15:45:00

🎉 L'application est maintenant accessible par tous les utilisateurs !

💡 Vérifications recommandées:
   1. Tester l'accès à l'application: https://votre-domaine.fr
   2. Vérifier les logs nginx: sudo tail -f /var/log/nginx/error.log
   3. Vérifier les logs de l'app: pm2 logs amaki
```

---

## 🔧 Fonctionnement technique

### Architecture

```
Utilisateur
    ↓
Navigateur
    ↓
[nginx]
    ↓
Fichier flag existe ? ──── OUI ──→ Servir maintenance.html (503)
    ↓
   NON
    ↓
Proxy vers Next.js (port 3000)
    ↓
Application AMAKI
```

### Fichier flag

Le fichier flag `/sites/amakifr/maintenance.flag` est un simple fichier texte qui sert de "switch" :

- **Fichier existe** → nginx redirige vers la page de maintenance
- **Fichier n'existe pas** → nginx sert l'application normalement

Contenu du fichier flag (exemple) :
```
Maintenance activée le mar. 12 janv. 2026 15:30:00 CET
```

### Configuration nginx

La configuration utilise plusieurs directives nginx :

1. **Vérification du fichier flag**
   ```nginx
   set $maintenance 0;
   if (-f /sites/amakifr/maintenance.flag) {
       set $maintenance 1;
   }
   ```

2. **Redirection vers le code 503**
   ```nginx
   if ($maintenance = 1) {
       return 503;
   }
   ```

3. **Gestion de l'erreur 503**
   ```nginx
   error_page 503 @maintenance;
   
   location @maintenance {
       root /sites/amakifr/.next/server/app;
       rewrite ^(.*)$ /maintenance.html break;
       # Headers anti-cache
   }
   ```

### Page HTML

La page `maintenance.html` est une page **HTML statique autonome** qui inclut :

- **CSS inline** : Pas de dépendances externes
- **JavaScript minimal** : Auto-refresh toutes les 30 secondes
- **Animations CSS** : Bulles en arrière-plan, loader animé
- **Design responsive** : Mobile-first
- **Mode sombre** : Détection automatique via `prefers-color-scheme`

---

## 🎨 Personnalisation

### Modifier le contenu de la page

Éditez le fichier `public/maintenance.html` :

```bash
nano public/maintenance.html
```

**Sections personnalisables :**

1. **Titre et sous-titre**
   ```html
   <h1>Maintenance en cours</h1>
   <p class="subtitle">Nous améliorons votre expérience AMAKI</p>
   ```

2. **Message principal**
   ```html
   <div class="message">
       <p><strong>🔧 Mise à jour en cours</strong></p>
       <p>Votre message personnalisé...</p>
   </div>
   ```

3. **Durée estimée**
   ```html
   <div class="timer" id="timer">
       Durée estimée : <span id="countdown">5-10 minutes</span>
   </div>
   ```

4. **Email de contact**
   ```html
   <a href="mailto:asso.amaki@gmail.com">asso.amaki@gmail.com</a>
   ```

### Modifier le design

**Couleurs :**

Changez les couleurs du gradient dans le CSS :

```css
body {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}

.logo {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
}
```

**Animations :**

Désactivez les bulles en supprimant :

```html
<div class="background-animation">
    <!-- Supprimez cette section -->
</div>
```

### Ajouter des exceptions IP

Pour permettre aux administrateurs d'accéder au site même en mode maintenance :

**Dans la configuration nginx :**

```nginx
set $maintenance 0;

if (-f /sites/amakifr/maintenance.flag) {
    set $maintenance 1;
}

# Exception pour les IP administrateurs
if ($remote_addr ~ "^(123.456.789.000|98.765.43.210)$") {
    set $maintenance 0;
}

if ($maintenance = 1) {
    return 503;
}
```

Remplacez `123.456.789.000` et `98.765.43.210` par vos vraies IP.

### Modifier l'intervalle de rafraîchissement

Par défaut, la page se rafraîchit toutes les 30 secondes.

**Dans `maintenance.html` :**

```javascript
// Auto-refresh toutes les 30 secondes (30000 ms)
setTimeout(function() {
    location.reload();
}, 30000);  // Changez cette valeur (en millisecondes)
```

Exemples :
- 15 secondes : `15000`
- 1 minute : `60000`
- 2 minutes : `120000`

---

## 🐛 Dépannage

### La page de maintenance ne s'affiche pas

**Vérification 1 : Le fichier flag existe-t-il ?**

```bash
ls -la /sites/amakifr/maintenance.flag
```

Si le fichier n'existe pas, exécutez :
```bash
bash scripts/maintenance-on.sh
```

**Vérification 2 : La page HTML existe-t-elle ?**

```bash
ls -la /sites/amakifr/.next/server/app/maintenance.html
```

Si le fichier n'existe pas :
```bash
sudo mkdir -p /sites/amakifr/.next/server/app
sudo cp public/maintenance.html /sites/amakifr/.next/server/app/maintenance.html
```

**Vérification 3 : Configuration nginx correcte ?**

```bash
sudo nginx -t
```

Si erreur, vérifiez votre configuration :
```bash
sudo nano /etc/nginx/sites-available/amaki
```

**Vérification 4 : Nginx rechargé ?**

```bash
sudo systemctl reload nginx
```

**Vérification 5 : Logs nginx**

```bash
sudo tail -f /var/log/nginx/error.log
```

Recherchez les erreurs liées à `/maintenance.html` ou `503`.

### La page de maintenance reste affichée après désactivation

**Solution 1 : Supprimer manuellement le fichier flag**

```bash
sudo rm -f /sites/amakifr/maintenance.flag
sudo systemctl reload nginx
```

**Solution 2 : Vider le cache du navigateur**

- Chrome/Firefox : `Ctrl + Shift + R` (Windows/Linux) ou `Cmd + Shift + R` (Mac)
- Ou mode navigation privée

**Solution 3 : Vérifier que nginx a bien été rechargé**

```bash
sudo systemctl status nginx
sudo systemctl reload nginx
```

### Erreur 502 Bad Gateway au lieu de la page de maintenance

Cela signifie que nginx ne détecte pas le fichier flag correctement.

**Vérifiez :**

1. Le chemin du fichier flag dans la configuration nginx
2. Les permissions du fichier flag :
   ```bash
   sudo chmod 644 /sites/amakifr/maintenance.flag
   ```

### La page est blanche ou ne charge pas

**Vérification 1 : Permissions du fichier HTML**

```bash
sudo chmod 644 /sites/amakifr/.next/server/app/maintenance.html
```

**Vérification 2 : Type MIME**

Vérifiez que nginx utilise `text/html` :

```nginx
location @maintenance {
    # ...
    default_type text/html;
}
```

**Vérification 3 : Logs nginx**

```bash
sudo tail -f /var/log/nginx/error.log
```

---

## ✅ Bonnes pratiques

### Avant une mise à jour

1. **Informer les utilisateurs (si possible)**
   - Poster une annonce sur le site
   - Envoyer un email aux adhérents
   - Choisir une heure creuse (tôt le matin ou tard le soir)

2. **Activer le mode maintenance**
   ```bash
   bash scripts/maintenance-on.sh
   ```

3. **Vérifier que la page s'affiche**
   - Ouvrir le site dans un navigateur
   - Tester depuis plusieurs appareils

### Pendant la mise à jour

1. **Effectuer les opérations nécessaires**
   ```bash
   # Pull du code
   git pull origin main
   
   # Installation des dépendances
   npm install
   
   # Build de l'application
   npm run build
   
   # Migrations de base de données (si nécessaire)
   npx prisma migrate deploy
   
   # Redémarrage de l'application
   pm2 restart amaki
   ```

2. **Vérifier les logs**
   ```bash
   pm2 logs amaki
   ```

### Après la mise à jour

1. **Tester l'application**
   - Se connecter en tant qu'admin
   - Tester les nouvelles fonctionnalités
   - Vérifier qu'il n'y a pas d'erreurs

2. **Désactiver le mode maintenance**
   ```bash
   bash scripts/maintenance-off.sh
   ```

3. **Vérifier que le site est accessible**
   - Tester depuis plusieurs navigateurs
   - Vérifier les logs pour détecter d'éventuelles erreurs

4. **Surveiller les logs pendant 10-15 minutes**
   ```bash
   pm2 logs amaki --lines 100
   sudo tail -f /var/log/nginx/error.log
   ```

### Script de déploiement complet (exemple)

Créez un script `deploy-with-maintenance.sh` :

```bash
#!/bin/bash

echo "🚀 Déploiement avec mode maintenance"
echo ""

# 1. Activer le mode maintenance
echo "1️⃣  Activation du mode maintenance..."
bash scripts/maintenance-on.sh
sleep 2

# 2. Pull du code
echo ""
echo "2️⃣  Pull du code depuis Git..."
git pull origin main

# 3. Installation des dépendances
echo ""
echo "3️⃣  Installation des dépendances..."
npm install

# 4. Build
echo ""
echo "4️⃣  Build de l'application..."
npm run build

# 5. Migrations
echo ""
echo "5️⃣  Migrations de base de données..."
npx prisma migrate deploy

# 6. Redémarrage
echo ""
echo "6️⃣  Redémarrage de l'application..."
pm2 restart amaki
sleep 5

# 7. Désactiver le mode maintenance
echo ""
echo "7️⃣  Désactivation du mode maintenance..."
bash scripts/maintenance-off.sh

echo ""
echo "✅ Déploiement terminé !"
```

---

## 📊 Statistiques et surveillance

### Vérifier combien de temps le mode maintenance a été actif

```bash
# Voir la date d'activation
cat /sites/amakifr/maintenance.flag
```

### Logs nginx pour le mode maintenance

```bash
# Voir toutes les requêtes redirigées vers la page de maintenance
sudo grep "503" /var/log/nginx/access.log | tail -20
```

### Monitoring

Vous pouvez ajouter des outils de monitoring pour être alerté si :
- Le mode maintenance est actif trop longtemps
- Le site renvoie des erreurs 503 alors que le mode maintenance n'est pas actif

---

## 🔒 Sécurité

### Permissions recommandées

```bash
# Fichier flag
sudo chown www-data:www-data /sites/amakifr/maintenance.flag
sudo chmod 644 /sites/amakifr/maintenance.flag

# Page HTML
sudo chown www-data:www-data /sites/amakifr/.next/server/app/maintenance.html
sudo chmod 644 /sites/amakifr/.next/server/app/maintenance.html

# Scripts
chmod +x scripts/maintenance-on.sh
chmod +x scripts/maintenance-off.sh
```

### Protection contre les abus

Les scripts demandent une confirmation avant d'activer/désactiver le mode maintenance, ce qui évite les erreurs de manipulation.

---

## 📞 Support

Si vous rencontrez des problèmes avec le mode maintenance :

1. **Consultez cette documentation**
2. **Vérifiez les logs** (nginx, PM2)
3. **Contactez l'équipe technique** : asso.amaki@gmail.com

---

## 📚 Références

- [Documentation nginx - error_page](http://nginx.org/en/docs/http/ngx_http_core_module.html#error_page)
- [Documentation nginx - if directive](http://nginx.org/en/docs/http/ngx_http_rewrite_module.html#if)
- [HTTP Status Code 503](https://developer.mozilla.org/fr/docs/Web/HTTP/Status/503)

---

**Dernière mise à jour :** 12 janvier 2026  
**Version :** 1.0.0
