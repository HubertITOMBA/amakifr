/**
 * Configuration des Server Actions disponibles pour le système de permissions
 * 
 * Cette liste prédéfinie permet à l'administrateur de sélectionner facilement
 * les actions sans avoir à connaître leurs noms exacts.
 */

export interface ServerActionConfig {
  action: string; // Nom de la Server Action
  label: string; // Libellé affiché à l'utilisateur
  description: string; // Description de ce que fait l'action
  resource: string; // Ressource concernée
  defaultType: "READ" | "WRITE" | "DELETE" | "MANAGE"; // Type de permission par défaut
  route?: string; // Route associée (optionnel)
  category: string; // Catégorie pour regrouper les actions
}

export const SERVER_ACTIONS_CONFIG: ServerActionConfig[] = [
  // ========== FINANCES ==========
  {
    action: "getAllDettesInitiales",
    label: "Lister les dettes initiales",
    description: "Afficher la liste de toutes les dettes initiales des adhérents",
    resource: "finances",
    defaultType: "READ",
    route: "/admin/finances/dettes",
    category: "Finances",
  },
  {
    action: "getDetteInitialeById",
    label: "Consulter une dette initiale",
    description: "Voir les détails d'une dette initiale spécifique",
    resource: "finances",
    defaultType: "READ",
    route: "/admin/finances/dettes",
    category: "Finances",
  },
  {
    action: "createDetteInitiale",
    label: "Créer une dette initiale",
    description: "Créer une nouvelle dette initiale pour un adhérent",
    resource: "finances",
    defaultType: "WRITE",
    route: "/admin/finances/dettes",
    category: "Finances",
  },
  {
    action: "updateDetteInitiale",
    label: "Modifier une dette initiale",
    description: "Modifier une dette initiale existante",
    resource: "finances",
    defaultType: "WRITE",
    route: "/admin/finances/dettes",
    category: "Finances",
  },
  {
    action: "getAllPaiements",
    label: "Lister les paiements",
    description: "Afficher la liste de tous les paiements effectués",
    resource: "finances",
    defaultType: "READ",
    route: "/admin/finances/paiements",
    category: "Finances",
  },
  {
    action: "createPaiementGeneral",
    label: "Enregistrer un paiement",
    description: "Enregistrer un nouveau paiement pour un adhérent",
    resource: "finances",
    defaultType: "WRITE",
    route: "/admin/finances/paiements",
    category: "Finances",
  },
  {
    action: "getAllAssistances",
    label: "Lister les assistances",
    description: "Afficher la liste de toutes les assistances",
    resource: "finances",
    defaultType: "READ",
    route: "/admin/finances/assistances",
    category: "Finances",
  },
  {
    action: "updateAssistance",
    label: "Modifier une assistance",
    description: "Modifier une assistance existante",
    resource: "finances",
    defaultType: "WRITE",
    route: "/admin/finances/assistances",
    category: "Finances",
  },
  {
    action: "getFinancialStats",
    label: "Voir les statistiques financières",
    description: "Consulter les statistiques et indicateurs financiers",
    resource: "finances",
    defaultType: "READ",
    route: "/admin/finances",
    category: "Finances",
  },
  {
    action: "getAdherentFinancialItems",
    label: "Voir les éléments financiers d'un adhérent",
    description: "Consulter les dettes, cotisations et assistances d'un adhérent",
    resource: "finances",
    defaultType: "READ",
    route: "/admin/finances",
    category: "Finances",
  },

  // ========== COTISATIONS ==========
  {
    action: "getAdherentsWithCotisations",
    label: "Lister les adhérents avec cotisations",
    description: "Afficher la liste des adhérents et leurs cotisations",
    resource: "cotisations",
    defaultType: "READ",
    route: "/admin/cotisations/gestion",
    category: "Cotisations",
  },
  {
    action: "createManualCotisation",
    label: "Créer une cotisation manuelle",
    description: "Créer une cotisation manuelle pour un adhérent",
    resource: "cotisations",
    defaultType: "WRITE",
    route: "/admin/cotisations/gestion",
    category: "Cotisations",
  },
  {
    action: "updateCotisation",
    label: "Modifier une cotisation",
    description: "Modifier une cotisation existante",
    resource: "cotisations",
    defaultType: "WRITE",
    route: "/admin/cotisations/gestion",
    category: "Cotisations",
  },

  // ========== DÉPENSES ==========
  {
    action: "getAllDepenses",
    label: "Lister les dépenses",
    description: "Afficher la liste de toutes les dépenses",
    resource: "depenses",
    defaultType: "READ",
    route: "/admin/depenses",
    category: "Dépenses",
  },
  {
    action: "getDepenseStats",
    label: "Voir les statistiques des dépenses",
    description: "Consulter les statistiques et indicateurs des dépenses",
    resource: "depenses",
    defaultType: "READ",
    route: "/admin/depenses",
    category: "Dépenses",
  },
  {
    action: "getDepenseById",
    label: "Consulter une dépense",
    description: "Voir les détails d'une dépense spécifique",
    resource: "depenses",
    defaultType: "READ",
    route: "/admin/depenses",
    category: "Dépenses",
  },
  {
    action: "createDepense",
    label: "Créer une dépense",
    description: "Créer une nouvelle dépense",
    resource: "depenses",
    defaultType: "WRITE",
    route: "/admin/depenses",
    category: "Dépenses",
  },
  {
    action: "updateDepense",
    label: "Modifier une dépense",
    description: "Modifier une dépense existante",
    resource: "depenses",
    defaultType: "WRITE",
    route: "/admin/depenses",
    category: "Dépenses",
  },
  {
    action: "deleteDepense",
    label: "Supprimer une dépense",
    description: "Supprimer une dépense",
    resource: "depenses",
    defaultType: "DELETE",
    route: "/admin/depenses",
    category: "Dépenses",
  },
  {
    action: "validateDepense",
    label: "Valider une dépense",
    description: "Valider une dépense en attente",
    resource: "depenses",
    defaultType: "WRITE",
    route: "/admin/depenses",
    category: "Dépenses",
  },
  {
    action: "rejectDepense",
    label: "Rejeter une dépense",
    description: "Rejeter une dépense en attente",
    resource: "depenses",
    defaultType: "WRITE",
    route: "/admin/depenses",
    category: "Dépenses",
  },
  {
    action: "uploadJustificatif",
    label: "Ajouter un justificatif",
    description: "Uploader un justificatif (fichier) pour une dépense",
    resource: "depenses",
    defaultType: "WRITE",
    route: "/admin/depenses",
    category: "Dépenses",
  },
  {
    action: "deleteJustificatif",
    label: "Supprimer un justificatif",
    description: "Supprimer un justificatif d'une dépense",
    resource: "depenses",
    defaultType: "DELETE",
    route: "/admin/depenses",
    category: "Dépenses",
  },
  {
    action: "updateJustificatif",
    label: "Modifier un justificatif",
    description: "Modifier les métadonnées d'un justificatif (ex. nom du fichier)",
    resource: "depenses",
    defaultType: "WRITE",
    route: "/admin/depenses",
    category: "Dépenses",
  },

  // ========== EMAILS ==========
  {
    action: "sendEmails",
    label: "Envoi de mails",
    description: "Envoyer des emails aux adhérents (admin)",
    resource: "emails",
    defaultType: "WRITE",
    route: "/admin/emails",
    category: "Emails",
  },

  // ========== UTILISATEURS ==========
  {
    action: "getAllUsersForAdmin",
    label: "Lister les utilisateurs",
    description: "Afficher la liste de tous les utilisateurs",
    resource: "users",
    defaultType: "READ",
    route: "/admin/users",
    category: "Utilisateurs",
  },
  {
    action: "adminUpdateUserRole",
    label: "Modifier le rôle d'un utilisateur",
    description: "Changer le rôle d'un utilisateur",
    resource: "users",
    defaultType: "WRITE",
    route: "/admin/users",
    category: "Utilisateurs",
  },

  // ========== RAPPORTS DE RÉUNION ==========
  {
    action: "getAllRapportsReunion",
    label: "Lister les rapports de réunion",
    description: "Afficher la liste de tous les rapports de réunion",
    resource: "rapports",
    defaultType: "READ",
    route: "/admin/rapports-reunion",
    category: "Rapports",
  },
  {
    action: "createRapportReunion",
    label: "Créer un rapport de réunion",
    description: "Créer un nouveau rapport de réunion",
    resource: "rapports",
    defaultType: "WRITE",
    route: "/admin/rapports-reunion",
    category: "Rapports",
  },
  {
    action: "updateRapportReunion",
    label: "Modifier un rapport de réunion",
    description: "Modifier un rapport de réunion existant",
    resource: "rapports",
    defaultType: "WRITE",
    route: "/admin/rapports-reunion",
    category: "Rapports",
  },
  {
    action: "deleteRapportReunion",
    label: "Supprimer un rapport de réunion",
    description: "Supprimer un rapport de réunion",
    resource: "rapports",
    defaultType: "DELETE",
    route: "/admin/rapports-reunion",
    category: "Rapports",
  },

  // ========== RGPD ==========
  {
    action: "getAllDataDeletionRequests",
    label: "Lister les demandes RGPD",
    description: "Afficher la liste des demandes de suppression de données",
    resource: "rgpd",
    defaultType: "READ",
    route: "/admin/rgpd/demandes",
    category: "RGPD",
  },

  // ========== MENUS ==========
  {
    action: "getAllMenus",
    label: "Lister les menus",
    description: "Afficher la liste de tous les menus",
    resource: "menus",
    defaultType: "READ",
    route: "/admin/menus",
    category: "Menus",
  },
  {
    action: "createMenu",
    label: "Créer un menu",
    description: "Créer un nouveau menu",
    resource: "menus",
    defaultType: "WRITE",
    route: "/admin/menus",
    category: "Menus",
  },
  {
    action: "updateMenu",
    label: "Modifier un menu",
    description: "Modifier un menu existant",
    resource: "menus",
    defaultType: "WRITE",
    route: "/admin/menus",
    category: "Menus",
  },
  {
    action: "deleteMenu",
    label: "Supprimer un menu",
    description: "Supprimer un menu",
    resource: "menus",
    defaultType: "DELETE",
    route: "/admin/menus",
    category: "Menus",
  },

  // ========== DOCUMENTS ==========
  {
    action: "getAllDocuments",
    label: "Lister les documents (admin)",
    description: "Afficher la liste de tous les documents (vue admin)",
    resource: "documents",
    defaultType: "READ",
    route: "/admin/documents",
    category: "Documents",
  },
  {
    action: "adminUpdateDocument",
    label: "Modifier un document (admin)",
    description: "Mettre à jour les métadonnées d'un document (vue admin)",
    resource: "documents",
    defaultType: "WRITE",
    route: "/admin/documents",
    category: "Documents",
  },
  {
    action: "adminDeleteDocument",
    label: "Supprimer un document (admin)",
    description: "Supprimer un document (vue admin)",
    resource: "documents",
    defaultType: "DELETE",
    route: "/admin/documents",
    category: "Documents",
  },

  // ========== BOÎTE À IDÉES ==========
  {
    action: "getAllIdeesForAdmin",
    label: "Lister les idées (admin)",
    description: "Afficher la liste de toutes les idées (vue admin)",
    resource: "idees",
    defaultType: "READ",
    route: "/admin/idees",
    category: "Boîte à idées",
  },
  {
    action: "validerIdee",
    label: "Valider une idée",
    description: "Valider une idée soumise par un adhérent",
    resource: "idees",
    defaultType: "WRITE",
    route: "/admin/idees",
    category: "Boîte à idées",
  },
  {
    action: "rejeterIdee",
    label: "Rejeter une idée",
    description: "Rejeter une idée avec une raison",
    resource: "idees",
    defaultType: "WRITE",
    route: "/admin/idees",
    category: "Boîte à idées",
  },
  {
    action: "bloquerIdee",
    label: "Bloquer une idée",
    description: "Bloquer une idée avec une raison",
    resource: "idees",
    defaultType: "WRITE",
    route: "/admin/idees",
    category: "Boîte à idées",
  },
  {
    action: "supprimerCommentaire",
    label: "Supprimer un commentaire (admin)",
    description: "Supprimer (masquer) un commentaire d'idée avec une raison",
    resource: "idees",
    defaultType: "DELETE",
    route: "/admin/idees",
    category: "Boîte à idées",
  },

  // ========== PROJETS ==========
  {
    action: "getAllProjets",
    label: "Lister les projets",
    description: "Afficher la liste de tous les projets (admin)",
    resource: "projets",
    defaultType: "READ",
    route: "/admin/projets",
    category: "Projets",
  },
  {
    action: "getProjetById",
    label: "Consulter un projet",
    description: "Voir le détail d'un projet (admin)",
    resource: "projets",
    defaultType: "READ",
    route: "/admin/projets",
    category: "Projets",
  },
  {
    action: "createProjet",
    label: "Créer un projet",
    description: "Créer un nouveau projet",
    resource: "projets",
    defaultType: "WRITE",
    route: "/admin/projets",
    category: "Projets",
  },
  {
    action: "updateProjet",
    label: "Modifier un projet",
    description: "Modifier un projet existant",
    resource: "projets",
    defaultType: "WRITE",
    route: "/admin/projets",
    category: "Projets",
  },
  {
    action: "deleteProjet",
    label: "Supprimer un projet",
    description: "Supprimer un projet",
    resource: "projets",
    defaultType: "DELETE",
    route: "/admin/projets",
    category: "Projets",
  },
  {
    action: "createSousProjet",
    label: "Créer une tâche",
    description: "Créer une tâche (sous-projet) dans un projet",
    resource: "projets",
    defaultType: "WRITE",
    route: "/admin/projets",
    category: "Projets",
  },
  {
    action: "updateSousProjet",
    label: "Modifier une tâche",
    description: "Modifier une tâche (sous-projet) existante",
    resource: "projets",
    defaultType: "WRITE",
    route: "/admin/projets",
    category: "Projets",
  },
  {
    action: "deleteSousProjet",
    label: "Supprimer une tâche",
    description: "Supprimer une tâche (sous-projet) d'un projet",
    resource: "projets",
    defaultType: "DELETE",
    route: "/admin/projets",
    category: "Projets",
  },
  {
    action: "affecterSousProjet",
    label: "Affecter des adhérents à une tâche",
    description: "Affecter/retirer des adhérents sur une tâche (admin)",
    resource: "projets",
    defaultType: "MANAGE",
    route: "/admin/projets",
    category: "Projets",
  },
  {
    action: "retirerAffectation",
    label: "Retirer une affectation",
    description: "Retirer un adhérent d'une tâche (admin)",
    resource: "projets",
    defaultType: "MANAGE",
    route: "/admin/projets",
    category: "Projets",
  },
];

/**
 * Récupère les actions par catégorie
 */
export function getActionsByCategory(): Record<string, ServerActionConfig[]> {
  const grouped: Record<string, ServerActionConfig[]> = {};
  
  SERVER_ACTIONS_CONFIG.forEach((action) => {
    if (!grouped[action.category]) {
      grouped[action.category] = [];
    }
    grouped[action.category].push(action);
  });
  
  return grouped;
}

/**
 * Récupère une action par son nom
 */
export function getActionByName(actionName: string): ServerActionConfig | undefined {
  return SERVER_ACTIONS_CONFIG.find((action) => action.action === actionName);
}

/**
 * Récupère toutes les catégories uniques
 */
export function getCategories(): string[] {
  const categories = new Set(SERVER_ACTIONS_CONFIG.map((action) => action.category));
  return Array.from(categories).sort();
}
