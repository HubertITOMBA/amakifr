This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
# AMAKI France - Application Web

Application web pour la gestion de l'association AMAKI France.

## Documentation

- **[Documentation des fonctionnalités](DOCUMENTATION_FEATURES.md)** - Documentation complète des fonctionnalités implémentées

## Fonctionnalités principales

### Gestion des événements
- Affichage des événements publics
- Inscription aux événements (membres et visiteurs)
- Gestion administrative des événements
- Notifications par email

### Système électoral
- Création et gestion des élections
- Candidatures
- Vote électronique
- Résultats et statistiques
- **Historisation des postes électoraux** (voir documentation)

### Gestion des membres
- Profils adhérents
- Cotisations
- Dépenses

## Technologies utilisées

- **Framework** : Next.js 14+ (App Router)
- **Base de données** : PostgreSQL avec Prisma ORM
- **Authentification** : NextAuth.js
- **UI** : React, Tailwind CSS, shadcn/ui
- **Langage** : TypeScript

## Installation

```bash
# Installer les dépendances
npm install

# Note : Le projet utilise nodemailer@7 qui peut créer des conflits de peer dependencies
# avec next-auth. Un fichier .npmrc est configuré avec legacy-peer-deps=true pour
# résoudre automatiquement ces conflits.

# Configurer les variables d'environnement
cp .env.example .env
# Éditer .env avec vos configurations

# Initialiser la base de données
npx prisma migrate dev

# Générer le client Prisma
npx prisma generate

# Lancer le serveur de développement
npm run dev
```

## Structure du projet

```
amakifr/
├── app/                    # Pages Next.js (App Router)
│   ├── admin/             # Pages d'administration
│   ├── evenements/        # Pages des événements
│   ├── elections/         # Pages des élections
│   └── vote/              # Pages de vote
├── actions/               # Server Actions
│   ├── evenements/        # Actions pour les événements
│   ├── elections/         # Actions pour les élections
│   └── postes/            # Actions pour les postes électoraux
├── components/            # Composants React réutilisables
├── lib/                   # Bibliothèques et utilitaires
├── prisma/                # Schéma Prisma et migrations
└── scripts/               # Scripts de migration et seeding
```

## Commandes utiles

```bash
# Développement
npm run dev

# Production
npm run build
npm start

# Base de données
npx prisma studio          # Interface graphique Prisma
npx prisma migrate dev     # Créer une migration
npx prisma db push         # Synchroniser le schéma

# Scripts
npx tsx scripts/seed-postes-templates.ts  # Migrer les postes électoraux
```

## Licence

Propriété de l'association AMAKI France
