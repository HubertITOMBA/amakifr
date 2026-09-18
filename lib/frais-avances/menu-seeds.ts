/**
 * Définition seed des 3 menus frais avancés (provisionnement explicite uniquement).
 * Aucune écriture runtime depuis les pages.
 */
export type FraisAvancesMenuSeed = {
  libelle: string;
  description: string;
  lien: string;
  niveau: "SIDEBAR";
  roles: string[];
  icone: string;
  statut: boolean;
  ordre: number;
  electoral: boolean;
  parent: null;
};

/**
 * Trois entrées attendues pour la future activation (seed uniquement).
 */
export const FRAIS_AVANCES_MENU_SEEDS: FraisAvancesMenuSeed[] = [
  {
    libelle: "Mes frais avancés",
    description: "Notes de frais de l'adhérent",
    lien: "/user/frais-avances",
    niveau: "SIDEBAR",
    roles: ["MEMBRE", "ADMIN"],
    icone: "Receipt",
    statut: true,
    ordre: 80,
    electoral: false,
    parent: null,
  },
  {
    libelle: "Frais avancés",
    description: "Notes de frais soumises et décision / exécution",
    lien: "/admin/frais-avances",
    niveau: "SIDEBAR",
    roles: ["ADMIN", "PRESID", "SECRET", "TRESOR"],
    icone: "Receipt",
    statut: true,
    ordre: 81,
    electoral: false,
    parent: null,
  },
  {
    libelle: "Comptabilité des frais",
    description: "Vue financière des notes validées (sans justificatifs)",
    lien: "/admin/frais-avances/comptabilite",
    niveau: "SIDEBAR",
    roles: ["ADMIN", "TRESOR", "COMCPT"],
    icone: "Calculator",
    statut: true,
    ordre: 82,
    electoral: false,
    parent: null,
  },
  {
    libelle: "Conservation frais",
    description: "Politiques de conservation et legal hold (notes de frais)",
    lien: "/admin/frais-avances/parametres/conservation",
    niveau: "SIDEBAR",
    roles: ["ADMIN", "TRESOR", "COMCPT"],
    icone: "Shield",
    statut: true,
    ordre: 83,
    electoral: false,
    parent: null,
  },
];
