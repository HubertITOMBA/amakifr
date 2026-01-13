# Système de Menus Hiérarchiques

## 📋 Vue d'ensemble

Le système de menus de l'application AMAKI supporte maintenant une **hiérarchie parent-enfant** permettant de regrouper plusieurs options sous un menu principal avec dropdown.

## 🎯 Objectifs

- **Éviter le scroll horizontal** : Réduire le nombre de menus de premier niveau dans la navbar
- **Meilleure organisation** : Regrouper les options par thématique
- **UX améliorée** : Interface plus claire et professionnelle
- **Flexibilité** : Possibilité d'ajouter facilement de nouveaux sous-menus

## 🏗️ Architecture

### Structure de la base de données

Le modèle `Menu` dans Prisma inclut un champ `parent` :

```prisma
model Menu {
  id          String     @id @default(cuid())
  libelle     String     @db.VarChar(100)
  description String?    @db.VarChar(500)
  lien        String     @db.VarChar(255)
  niveau      MenuNiveau // NAVBAR ou SIDEBAR
  roles       String[]
  icone       String?    @db.VarChar(100)
  statut      Boolean    @default(true)
  ordre       Int        @default(0)
  parent      String?    // 👈 ID du menu parent (null = menu racine)
  electoral   Boolean    @default(false)
  // ...
}
```

### Organisation hiérarchique

```
NAVBAR
├── L'amicale
├── Scrutin (parent) 📂
│   ├── Informations (/extrat)
│   └── Résultats (/resultats)
├── Événements
├── Galerie
├── Contact
├── Messages
└── Admin
```

## 💻 Implémentation

### 1. Hook `useDynamicMenus`

Le hook charge tous les menus depuis la base de données et organise automatiquement la hiérarchie :

```typescript
const { parentMenus, submenusByParent } = useMemo(() => {
  const allFilteredMenus = menus.filter(/* filtres */);
  
  const parents = allFilteredMenus.filter(m => !m.parent);
  const submenuMap: Record<string, DynamicMenu[]> = {};
  
  allFilteredMenus.forEach(menu => {
    if (menu.parent) {
      if (!submenuMap[menu.parent]) {
        submenuMap[menu.parent] = [];
      }
      submenuMap[menu.parent].push(menu);
    }
  });

  return { parentMenus, submenusByParent };
}, [menus, electoralMenuEnabled, user]);
```

### 2. Rendu des menus (Desktop)

#### Menu avec sous-menus → Dropdown

```typescript
if (hasSubmenus) {
  return (
    <DropdownMenu key={menu.id}>
      <DropdownMenuTrigger>
        {getIcon(menu.icone)}
        {menu.libelle}
        <ChevronDown className="h-4 w-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {submenus.map(submenu => (
          <DropdownMenuItem key={submenu.id} asChild>
            <Link href={submenu.lien}>
              {getIcon(submenu.icone)}
              <div>
                <div className="font-medium">{submenu.libelle}</div>
                {submenu.description && (
                  <div className="text-xs text-muted-foreground">
                    {submenu.description}
                  </div>
                )}
              </div>
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
```

#### Menu simple → Lien direct

```typescript
return (
  <Link 
    key={menu.id} 
    href={menu.lien}
    className="font-title text-sm xl:text-base 2xl:text-lg font-semibold..."
  >
    {getIcon(menu.icone)}
    {menu.libelle}
  </Link>
);
```

### 3. Rendu des menus (Mobile)

Les sous-menus sont affichés en liste indentée sous leur parent :

```typescript
{hasSubmenus ? (
  <div className="px-3 py-2 rounded-md text-base font-medium...">
    {getIcon(menu.icone)}
    {menu.libelle}
  </div>
) : (
  <Link href={menu.lien} onClick={() => setIsMenuOpen(false)}>
    {/* ... */}
  </Link>
)}

{/* Sous-menus (indentés avec pl-12) */}
{hasSubmenus && submenus.map(submenu => (
  <Link
    key={submenu.id}
    href={submenu.lien}
    className="flex items-center gap-2 pl-12 pr-3 py-2..."
    onClick={() => setIsMenuOpen(false)}
  >
    {getIcon(submenu.icone)}
    {submenu.libelle}
  </Link>
))}
```

## 🔧 Création de menus hiérarchiques

### Via le script de seed

```typescript
// 1. Créer le menu parent
const navbarMenus = [
  {
    libelle: "Scrutin",
    description: "Élections et résultats",
    lien: "#", // Pas de lien direct pour un parent
    niveau: "NAVBAR",
    roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
    icone: "Vote",
    statut: true,
    ordre: 2,
    electoral: true,
    parent: null, // Menu racine
  },
];

// 2. Créer les sous-menus
const navbarElectoralSubmenus = [
  {
    libelle: "Informations",
    description: "Informations sur les élections",
    lien: "/extrat",
    niveau: "NAVBAR",
    roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
    icone: "Info",
    statut: true,
    ordre: 1,
    electoral: true,
    parentLibelle: "Scrutin", // Référence au parent
  },
  {
    libelle: "Résultats",
    description: "Résultats des élections",
    lien: "/resultats",
    niveau: "NAVBAR",
    roles: ["ADMIN", "MEMBRE", "INVITE", "VISITEUR"],
    icone: "Award",
    statut: true,
    ordre: 2,
    electoral: true,
    parentLibelle: "Scrutin",
  },
];

// 3. Créer les menus avec liaison parent-enfant
for (const menu of navbarMenus) {
  const created = await prisma.menu.create({ data: menu });
  createdMenus[menu.libelle] = created.id;
}

for (const submenu of navbarElectoralSubmenus) {
  const { parentLibelle, ...submenuData } = submenu;
  const parentId = createdMenus[parentLibelle];
  
  await prisma.menu.create({
    data: {
      ...submenuData,
      parent: parentId, // ✅ Liaison parent-enfant
      createdBy: null,
    },
  });
}
```

### Via l'interface admin (`/admin/menus`)

1. Créer d'abord le menu parent avec `lien: "#"`
2. Créer les sous-menus en sélectionnant le parent dans le champ "Menu parent"

## 📊 Résumé des menus actuels

Après exécution du seed :

```
📊 Résumé:
- Menus NAVBAR: 9 (dont 7 parents + 2 enfants)
- Menus SIDEBAR: 26
- Menus électoraux: 7
- Sous-menus: 2
```

### Menus NAVBAR

| Libellé | Type | Sous-menus | Rôles | Électoral |
|---------|------|------------|-------|-----------|
| L'amicale | Parent | - | Tous | Non |
| **Scrutin** | **Parent** | **2** | Tous | **Oui** |
| → Informations | Enfant | - | Tous | Oui |
| → Résultats | Enfant | - | Tous | Oui |
| Événements | Parent | - | Tous | Non |
| Galerie | Parent | - | Tous | Non |
| Contact | Parent | - | Tous | Non |
| Messages | Parent | - | Membres+ | Non |
| Admin | Parent | - | Admin | Non |

## 🎨 Styles et UX

### Desktop
- **Menu parent avec sous-menus** : Dropdown Radix UI avec chevron down
- **Hover** : Fond bleu clair, texte bleu foncé
- **Descriptions** : Affichées en gris sous chaque option
- **Icônes** : Lucide React (h-5 w-5)

### Mobile
- **Menu parent** : Texte gris sans lien
- **Sous-menus** : Indentés (`pl-12`), taille de texte réduite (`text-sm`)
- **Clic** : Ferme automatiquement le menu burger

## 🔐 Gestion des permissions

Les sous-menus héritent des mêmes règles de filtrage que les menus parents :

1. **Rôles** : Vérification `menu.roles.includes(userRole)`
2. **Électoral** : Si `menu.electoral === true`, soumis au paramètre `electoral_menu_enabled`
3. **Authentification** : Certains menus réservés aux utilisateurs connectés

```typescript
const allFilteredMenus = menus.filter(menu => {
  // Filtre électoral
  if (menu.electoral && !electoralMenuEnabled) {
    return false;
  }
  
  // Filtre connexion
  if (!user && (menu.lien === "/chat" || menu.lien === "/notifications")) {
    return false;
  }
  
  return true;
});
```

## 🚀 Avantages

### Avant (menus plats)
```
[L'amicale] [Election] [Événements] [Galerie] [Contact] [Résultats] [Messages] [Admin]
                                                         ↑
                                                  Scroll horizontal
```

### Après (menus hiérarchiques)
```
[L'amicale] [Scrutin ▼] [Événements] [Galerie] [Contact] [Messages] [Admin]
              │
              ├── Informations
              └── Résultats
              
✅ Plus de scroll !
```

## 📚 Fichiers modifiés

1. **`/scripts/seed-menus.ts`**
   - Ajout du menu parent "Scrutin"
   - Création des sous-menus électoraux
   - Liaison parent-enfant automatique

2. **`/components/home/DynamicNavbar.tsx`**
   - Import de `DropdownMenu` (Radix UI)
   - Fonction `renderMenu()` pour gérer parent/enfant
   - Organisation `parentMenus` et `submenusByParent`
   - Rendu adaptatif desktop/mobile

3. **`/hooks/use-dynamic-menus.ts`**
   - Export de l'interface `DynamicMenu`
   - Pas de changement fonctionnel

4. **`/actions/menus/index.ts`**
   - Déjà prêt pour la hiérarchie (champ `parent`)

## 🧪 Tests effectués

- ✅ Affichage du dropdown desktop (hover + click)
- ✅ Navigation vers les sous-menus
- ✅ Affichage mobile avec indentation
- ✅ Filtrage électoral (activé/désactivé)
- ✅ Permissions par rôle
- ✅ Pas de scroll horizontal

## 🔮 Évolutions futures

1. **Niveaux multiples** : Support de sous-sous-menus (niveau 3)
2. **Drag & drop** : Réorganisation visuelle dans `/admin/menus`
3. **Templates** : Modèles de hiérarchies pré-définis
4. **Sidebar** : Appliquer aussi aux menus admin (accordion)

## 📞 Support

Pour toute question ou problème :
1. Consulter les logs : `/admin/settings`
2. Vérifier la base de données : `SELECT * FROM menus WHERE parent IS NOT NULL`
3. Re-seeder les menus : `npx tsx scripts/seed-menus.ts`

---

**Dernière mise à jour** : 2026-01-13  
**Version** : 1.0.0  
**Auteur** : Équipe AMAKI
