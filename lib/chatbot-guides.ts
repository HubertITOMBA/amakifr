/**
 * Guides d'aide pour le chatbot
 * Contient toutes les réponses et instructions pour guider les adhérents
 */

export interface ChatMessage {
  id: string;
  type: 'user' | 'bot';
  content: string;
  timestamp: Date;
  actions?: ChatAction[];
}

export interface ChatAction {
  label: string;
  action: string;
  href?: string;
  onClick?: () => void;
}

export interface Guide {
  keywords: string[];
  title: string;
  steps: string[];
  actions?: ChatAction[];
}

/**
 * Guides disponibles pour le chatbot
 */
export const chatbotGuides: Guide[] = [
  {
    keywords: ['mot de passe', 'password', 'changer mot de passe', 'modifier mot de passe', 'oublié mot de passe', 'reset password', 'mdp', 'changer mdp', 'modifier mdp', 'mot passe'],
    title: 'Comment modifier mon mot de passe',
    steps: [
      'Cliquez sur votre nom ou photo en haut à droite de l\'écran',
      'Sélectionnez "Paramètres" ou "Mon Profil"',
      'Dans la section "Sécurité", cliquez sur "Modifier le mot de passe"',
      'Entrez votre mot de passe actuel',
      'Entrez votre nouveau mot de passe (minimum 8 caractères)',
      'Confirmez votre nouveau mot de passe',
      'Cliquez sur "Enregistrer"',
      'Si vous avez oublié votre mot de passe, utilisez le lien "Mot de passe oublié" sur la page de connexion'
    ],
    actions: [
      { label: 'Ouvrir mon profil', action: 'open_profile', href: '/user/profile?section=settings' },
      { label: 'Page de connexion', action: 'open_login', href: '/auth/sign-in' }
    ]
  },
  {
    keywords: ['cotisation', 'payer cotisation', 'paiement cotisation', 'cotisation mensuelle', 'payer', 'paiement', 'cotiser', 'verser', 'régler', 'payer ma cotisation', 'comment payer'],
    title: 'Comment payer ma cotisation',
    steps: [
      'Allez dans "Mon Profil" > "Mes Cotisations"',
      'Vous verrez vos cotisations en attente et vos dettes',
      'Cliquez sur le bouton "Payer" à côté de la cotisation ou de la dette',
      'Choisissez le montant à payer (vous pouvez payer partiellement)',
      'Sélectionnez votre moyen de paiement (Carte bancaire, Virement, Chèque)',
      'Suivez les instructions à l\'écran pour finaliser le paiement',
      'Vous recevrez une confirmation par email après le paiement',
      'Pour payer en plusieurs fois : vous pouvez effectuer plusieurs paiements partiels jusqu\'à régulariser votre situation'
    ],
    actions: [
      { label: 'Voir mes cotisations', action: 'open_cotisations', href: '/user/profile?section=cotisations' }
    ]
  },
  {
    keywords: ['photo', 'avatar', 'image profil', 'changer photo', 'modifier photo', 'photo profil', 'image', 'photo de profil', 'changer ma photo', 'modifier ma photo'],
    title: 'Comment modifier ma photo de profil',
    steps: [
      'Allez dans "Mon Profil"',
      'Cliquez sur votre photo de profil en haut de la page',
      'Sélectionnez "Modifier la photo" ou l\'icône de caméra',
      'Choisissez une nouvelle photo depuis votre appareil',
      'Recadrez la photo si nécessaire',
      'Cliquez sur "Enregistrer"',
      'Votre nouvelle photo sera visible immédiatement'
    ],
    actions: [
      { label: 'Ouvrir mon profil', action: 'open_profile', href: '/user/profile' }
    ]
  },
  {
    keywords: ['payer plusieurs fois', 'paiement partiel', 'paiement échelonné', 'plusieurs paiements'],
    title: 'Comment payer ma cotisation en plusieurs fois',
    steps: [
      'Allez dans "Mon Profil" > "Mes Cotisations"',
      'Vous verrez le montant total à payer',
      'Cliquez sur "Payer"',
      'Entrez le montant que vous souhaitez payer maintenant (il peut être inférieur au montant total)',
      'Choisissez votre moyen de paiement et finalisez',
      'Le montant restant sera toujours visible dans "Mes Cotisations"',
      'Vous pouvez répéter cette opération autant de fois que nécessaire jusqu\'à régulariser votre situation',
      'Chaque paiement sera enregistré et visible dans votre historique'
    ],
    actions: [
      { label: 'Voir mes cotisations', action: 'open_cotisations', href: '/user/profile?section=cotisations' }
    ]
  },
  {
    keywords: ['profil', 'modifier profil', 'éditer profil', 'mettre à jour profil', 'informations personnelles', 'changer profil', 'modifier mon profil', 'éditer mon profil', 'mes informations'],
    title: 'Comment modifier mon profil',
    steps: [
      'Allez dans "Mon Profil"',
      'Cliquez sur le bouton "Modifier" ou "Éditer" en haut de la page',
      'Vous serez redirigé vers la page de modification',
      'Modifiez les informations que vous souhaitez changer (nom, prénom, adresse, téléphone, etc.)',
      'Cliquez sur "Enregistrer" pour sauvegarder vos modifications',
      'Vos modifications seront immédiatement visibles dans votre profil'
    ],
    actions: [
      { label: 'Ouvrir mon profil', action: 'open_profile', href: '/user/profile' },
      { label: 'Modifier mon profil', action: 'open_edit', href: '/user/update' }
    ]
  },
  {
    keywords: ['passeport', 'imprimer passeport', 'télécharger passeport', 'pdf passeport', 'mon passeport', 'imprimer mon passeport', 'télécharger mon passeport'],
    title: 'Comment imprimer mon passeport',
    steps: [
      'Allez dans "Mon Profil" > "Mon Passeport"',
      'Vous verrez toutes les informations de votre passeport adhérent',
      'Cliquez sur le bouton "Télécharger le PDF" ou "Imprimer"',
      'Le fichier PDF sera généré et téléchargé automatiquement',
      'Ouvrez le PDF et imprimez-le depuis votre imprimante',
      'Le passeport contient vos droits et obligations en tant qu\'adhérent',
      '',
      '📋 Le passeport contient :',
      '  • Vos informations personnelles',
      '  • Votre numéro de passeport unique',
      '  • Vos droits en tant qu\'adhérent',
      '  • Vos obligations',
      '  • Le règlement d\'ordre intérieur',
      '',
      '💡 Conseil : Gardez une copie de votre passeport pour référence'
    ],
    actions: [
      { label: 'Ouvrir mon passeport', action: 'open_passeport', href: '/user/profile?section=passeport' }
    ]
  },
  {
    keywords: ['obligations', 'mes obligations', 'voir obligations', 'obligation cotisation', 'mes obligations cotisation', 'voir mes obligations', 'liste obligations'],
    title: 'Comment voir mes obligations',
    steps: [
      'Allez dans "Mon Profil" > "Mes Cotisations"',
      'Dans la section "Obligations de cotisation", vous verrez toutes vos obligations',
      '',
      '📊 Informations affichées pour chaque obligation :',
      '  • Type d\'obligation : Forfait mensuel, Assistance, Anniversaire, Adhésion',
      '  • Montant attendu : Montant total à payer',
      '  • Montant payé : Ce que vous avez déjà payé',
      '  • Montant restant : Ce qu\'il reste à payer',
      '  • Date d\'échéance : Date limite de paiement',
      '  • Statut : En attente, Partiellement payé, Payé, En retard',
      '  • Période : Mois/année concernée',
      '',
      '💳 Pour payer une obligation :',
      'Cliquez sur le bouton "Payer" à côté de l\'obligation',
      'Vous pouvez payer partiellement ou en totalité',
      'Choisissez votre moyen de paiement',
      '',
      '📄 Export PDF :',
      'Vous pouvez exporter la liste de vos obligations en PDF',
      'Cliquez sur "Exporter en PDF" pour télécharger le document',
      '',
      '💡 Conseil : Payez vos obligations avant la date d\'échéance pour éviter les retards',
      '💡 Conseil : Un retard de 3 mois ou plus peut entraîner la suspension du droit de vote'
    ],
    actions: [
      { label: 'Voir mes cotisations', action: 'open_cotisations', href: '/user/profile?section=cotisations' }
    ]
  },
  {
    keywords: ['droits', 'mes droits', 'voir droits', 'droits adhérent', 'droits membre', 'voir mes droits', 'quels sont mes droits'],
    title: 'Comment voir mes droits en tant qu\'adhérent',
    steps: [
      'Allez dans "Mon Profil" > "Mon Passeport"',
      'Dans la section "Droits de l\'Adhérent", vous verrez tous vos droits',
      '',
      '✅ Vos droits en tant qu\'adhérent :',
      '',
      '🗳️ Droit de vote :',
      '  • Participer aux élections et votes de l\'association',
      '  • Voter lors des assemblées générales et consultations',
      '  • ⚠️ Suspension possible en cas de retard de cotisation de 3 mois ou plus',
      '',
      '📝 Droit de candidature :',
      '  • Se porter candidat aux différents postes électifs',
      '  • Postuler selon les conditions établies par l\'association',
      '',
      '🎉 Droit de participation :',
      '  • Participer à toutes les activités organisées',
      '  • Assister aux événements et réunions',
      '  • S\'inscrire aux sorties et manifestations',
      '',
      '💬 Droit d\'expression :',
      '  • Proposer des idées dans la boîte à idées',
      '  • Faire des suggestions et exprimer son opinion',
      '  • Participer aux discussions lors des assemblées',
      '',
      '📢 Droit à l\'information :',
      '  • Recevoir les informations sur les activités',
      '  • Être informé des décisions et projets',
      '  • Consulter les rapports de réunion',
      '',
      '🤝 Droit aux assistances :',
      '  • Bénéficier des assistances prévues',
      '  • Assistance pour naissance, mariage, décès',
      '  • Assistance pour anniversaire de salle',
      '  • ⚠️ Réservé aux membres à jour de leurs cotisations',
      '',
      '📚 Droit de consultation :',
      '  • Consulter les documents de l\'association',
      '  • Accéder aux comptes selon les modalités prévues',
      '  • Consulter les statuts et le règlement intérieur',
      '',
      '💡 Conseil : Respectez vos obligations pour conserver tous vos droits',
      '💡 Conseil : Restez à jour de vos cotisations pour bénéficier des assistances'
    ],
    actions: [
      { label: 'Voir mon passeport', action: 'open_passeport', href: '/user/profile?section=passeport' }
    ]
  },
  {
    keywords: ['règlement', 'règlement intérieur', 'reglement interieur', 'règlement ordre intérieur', 'reglement ordre interieur', 'voir règlement', 'consulter règlement', 'règlement association'],
    title: 'Comment consulter le règlement d\'ordre intérieur',
    steps: [
      'Allez dans "Mon Profil" > "Mon Passeport"',
      'Faites défiler jusqu\'à la section "Règlement d\'Ordre Intérieur"',
      'Vous verrez tous les articles du règlement',
      '',
      '📋 Le règlement d\'ordre intérieur comprend :',
      '',
      '📝 Article 1 – Objet du règlement intérieur :',
      '  • Précise les règles de fonctionnement de l\'association',
      '  • S\'impose à tous les membres',
      '',
      '💰 Article 2 – Cotisation :',
      '  • Montant : 15 € par mois (180 € par an)',
      '  • Due par tous les membres actifs',
      '  • Retard de 3 mois ou plus entraîne :',
      '    - Perte du droit d\'assistance financière',
      '    - Suspension du droit de vote jusqu\'à régularisation',
      '',
      '⚠️ Article 3 – Perte de la qualité de membre :',
      '  • Retard de cotisation de 3 mois ou plus non régularisé',
      '  • Absence prolongée et injustifiée aux activités',
      '  • Indiscipline grave ou faute portant préjudice',
      '',
      '🤝 Article 4 – Assistance financière et solidarité :',
      '  • Réservée aux membres à jour de leurs cotisations',
      '  • Nécessite une participation active et régulière',
      '  • Respect du règlement intérieur obligatoire',
      '  • ⚠️ Aucun membre en retard de 3 mois ou plus ne peut bénéficier d\'assistance',
      '',
      '⚖️ Article 5 – Discipline et sanctions :',
      '  • Attitude respectueuse obligatoire',
      '  • Comportement indiscipliné, violent ou diffamatoire interdit',
      '  • Sanctions : Avertissement, Suspension temporaire, Exclusion définitive',
      '',
      '📜 Article 6 – Application et modification :',
      '  • Entrée en vigueur dès adoption par l\'Assemblée Générale',
      '  • Modification possible par décision de l\'Assemblée Générale',
      '',
      '💡 Conseil : Respectez le règlement pour éviter les sanctions',
      '💡 Conseil : Restez à jour de vos cotisations pour conserver tous vos droits',
      '💡 Conseil : Consultez régulièrement le règlement pour connaître vos droits et obligations'
    ],
    actions: [
      { label: 'Voir mon passeport', action: 'open_passeport', href: '/user/profile?section=passeport' }
    ]
  },
  {
    keywords: ['document', 'télécharger document', 'voir document', 'mes documents'],
    title: 'Comment accéder à mes documents',
    steps: [
      'Allez dans "Mon Profil" > "Mes Documents"',
      'Vous verrez la liste de tous vos documents disponibles',
      'Cliquez sur un document pour le télécharger',
      'Vous pouvez également filtrer par type de document si nécessaire'
    ],
    actions: [
      { label: 'Voir mes documents', action: 'open_documents', href: '/user/documents' }
    ]
  },
  {
    keywords: ['téléverser document', 'upload document', 'ajouter document', 'envoyer document', 'charger document', 'télécharger document', 'importer document', 'nouveau document', 'créer document', 'ajouter un document', 'téléverser un document', 'comment téléverser', 'comment ajouter document'],
    title: 'Comment téléverser un document',
    steps: [
      '📋 Accéder à la page des documents :',
      'Allez dans "Mon Profil" > "Mes Documents" ou directement sur /user/documents',
      'Cliquez sur le bouton "Nouveau document" en haut à droite',
      '',
      '📁 Sélectionner votre fichier :',
      'Vous pouvez soit :',
      '  • Glisser-déposer votre fichier dans la zone prévue',
      '  • Cliquer sur "Sélectionner un fichier" pour parcourir vos fichiers',
      '',
      '✅ Types de fichiers acceptés :',
      '  • Images : JPG, JPEG, PNG, GIF, WEBP, BMP, TIFF',
      '  • Vidéos : MP4, MOV, AVI',
      '  • PDF : Documents PDF',
      '  • Word : DOC, DOCX',
      '  • Excel : XLS, XLSX',
      '  • CSV : Fichiers CSV',
      '  • TXT : Fichiers texte',
      '',
      '💾 Taille maximale :',
      '  • Maximum 50 Mo par fichier',
      '',
      '📝 Renseigner les informations (optionnel) :',
      'Une fois le fichier sélectionné, vous pouvez renseigner :',
      '  • Catégorie : Sélectionnez une catégorie dans la liste déroulante',
      '    Les catégories proposées dépendent du type de fichier :',
      '    - Images : Photos, Affiches, Logos, Illustrations, Documents scannés, etc.',
      '    - Vidéos : Événements, Tutoriels, Présentations, Interviews, etc.',
      '    - PDF : Factures, Contrats, Rapports, Formulaires, Procès-verbaux, etc.',
      '    - Word : Lettres, Rapports, Procès-verbaux, Correspondances, etc.',
      '    - Excel : Tableaux, Statistiques, Budgets, Listes, etc.',
      '    - CSV : Données, Exports, Statistiques, Listes, etc.',
      '    - TXT : Notes, Configurations, Documentation, etc.',
      '  • Description : Ajoutez une description pour mieux identifier votre document',
      '  • Visibilité : Cochez "Rendre ce document public" si vous souhaitez qu\'il soit visible par les administrateurs',
      '',
      '✅ Finaliser le téléversement :',
      'Vérifiez que toutes les informations sont correctes',
      'Cliquez sur "Téléverser le document"',
      'Une barre de progression s\'affiche pendant le téléversement',
      'Vous recevrez une notification de succès une fois le téléversement terminé',
      '',
      '📊 Après le téléversement :',
      '  • Votre document apparaît immédiatement dans la liste de vos documents',
      '  • Vous pouvez le voir, le télécharger, le modifier ou le supprimer à tout moment',
      '  • Si le document est public, les administrateurs pourront le voir',
      '',
      '💡 Conseils :',
      '  • Utilisez des descriptions claires pour faciliter la recherche',
      '  • Choisissez une catégorie appropriée pour mieux organiser vos documents',
      '  • Vérifiez la taille de votre fichier avant le téléversement',
      '  • Les types de fichiers non supportés afficheront un message d\'erreur clair',
      '',
      '⚠️ Important :',
      '  • Seuls les types de fichiers listés ci-dessus sont acceptés',
      '  • Si vous essayez de téléverser un type non supporté, vous recevrez un message d\'erreur avec la liste des types acceptés',
      '  • Vous pouvez modifier les informations (catégorie, description, visibilité) d\'un document après l\'avoir téléversé'
    ],
    actions: [
      { label: 'Téléverser un document', action: 'upload_document', href: '/user/documents' }
    ]
  },
  {
    keywords: ['badge', 'badges', 'récompenses', 'mes badges'],
    title: 'Comment voir mes badges',
    steps: [
      'Allez dans "Mon Profil" > "Mes Badges"',
      'Vous verrez tous les badges que vous avez obtenus',
      'Chaque badge affiche sa description et la date d\'obtention'
    ],
    actions: [
      { label: 'Voir mes badges', action: 'open_badges', href: '/user/profile?section=badges' }
    ]
  },
  {
    keywords: ['candidature', 'candidatures', 'postuler', 'candidater'],
    title: 'Comment postuler à une élection',
    steps: [
      'Allez dans "Mon Profil" > "Mes Candidatures"',
      'Cliquez sur "Nouvelle candidature"',
      'Sélectionnez l\'élection pour laquelle vous souhaitez postuler',
      'Choisissez le poste',
      'Remplissez le formulaire de candidature',
      'Soumettez votre candidature',
      'Vous pourrez suivre le statut de votre candidature dans "Mes Candidatures"'
    ],
    actions: [
      { label: 'Voir mes candidatures', action: 'open_candidatures', href: '/user/profile?section=candidatures' },
      { label: 'Voir les élections', action: 'open_elections', href: '/candidatures' }
    ]
  },
  {
    keywords: ['vote', 'voter', 'élection', 'élections'],
    title: 'Comment voter',
    steps: [
      'Allez dans la section "Vote" du menu principal',
      'Sélectionnez l\'élection pour laquelle vous souhaitez voter',
      'Consultez les candidatures et leurs programmes',
      'Cliquez sur "Voter" pour le candidat de votre choix',
      'Confirmez votre vote',
      'Vous pouvez voir vos votes dans "Mon Profil" > "Mes Votes"'
    ],
    actions: [
      { label: 'Voir les élections', action: 'open_elections', href: '/vote' },
      { label: 'Mes votes', action: 'open_votes', href: '/user/profile?section=votes' }
    ]
  },
  {
    keywords: ['événement', 'événements', 'evenement', 'evenements', 'participer événement', 'inscription événement', 'voir événements', 'liste événements', 'calendrier'],
    title: 'Comment participer à un événement',
    steps: [
      'Allez dans la section "Événements" du menu principal',
      'Parcourez la liste des événements à venir',
      'Cliquez sur l\'événement qui vous intéresse pour voir les détails',
      'Si l\'inscription est ouverte, cliquez sur "S\'inscrire" ou "Participer"',
      'Remplissez le formulaire d\'inscription si nécessaire',
      'Confirmez votre participation',
      'Vous recevrez une confirmation par email',
      'Vous pouvez voir tous vos événements dans "Mon Profil" > "Mes Événements"'
    ],
    actions: [
      { label: 'Voir les événements', action: 'open_events', href: '/evenements' }
    ]
  },
  {
    keywords: ['rapport', 'rapports', 'réunion', 'reunion', 'compte rendu', 'rapport réunion', 'rapports réunion', 'compte rendu réunion'],
    title: 'Comment consulter les rapports de réunion',
    steps: [
      'Allez dans "Mon Profil" > "Rapports de Réunion"',
      'Vous verrez la liste de tous les rapports de réunion mensuels',
      'Cliquez sur "Lire" pour voir le contenu complet d\'un rapport',
      'Vous pouvez également cliquer sur "Imprimer" pour télécharger le rapport en PDF',
      'Les rapports sont classés par date, du plus récent au plus ancien'
    ],
    actions: [
      { label: 'Voir les rapports', action: 'open_rapports', href: '/user/profile?section=rapports' }
    ]
  },
  {
    keywords: ['notification', 'notifications', 'alerte', 'alertes', 'préférences notification', 'gérer notifications', 'voir notifications', 'mes notifications', 'cloche notification'],
    title: 'Comment gérer mes notifications',
    steps: [
      '🔔 Les notifications vous permettent de rester informé des activités de l\'association',
      '',
      '📱 Pour voir vos notifications :',
      'Cliquez sur l\'icône de cloche (🔔) en haut à droite de la page',
      'ou',
      'Allez dans "Mon Profil" > "Notifications"',
      '',
      'Vous verrez toutes vos notifications non lues et lues',
      'Les notifications peuvent concerner :',
      '  • De nouveaux messages dans le chat',
      '  • Des événements à venir',
      '  • Des cotisations à payer',
      '  • Des mises à jour sur vos idées',
      '  • Des informations importantes de l\'association',
      '',
      '⚙️ Pour gérer vos préférences :',
      'Allez dans "Mon Profil" > "Notifications"',
      'Activez ou désactivez les types de notifications que vous souhaitez recevoir',
      'Vous pouvez choisir de recevoir des notifications par email, SMS, ou dans l\'application',
      'Sauvegardez vos préférences',
      '',
      '💡 Conseil : Gardez les notifications importantes activées pour ne rien manquer'
    ],
    actions: [
      { label: 'Voir mes notifications', action: 'open_notifications', href: '/notifications' },
      { label: 'Gérer mes préférences', action: 'open_notifications_prefs', href: '/user/profile?section=notifications' }
    ]
  },
  {
    keywords: ['tâche', 'taches', 'mes tâches', 'mes taches', 'commenter tâche', 'documenter tâche', 'avancement tâche', 'suivre tâche', 'progression tâche', 'commenter ma tâche', 'documenter ma tâche', 'avancement ma tâche'],
    title: 'Comment commenter ou documenter l\'avancement de ma tâche',
    steps: [
      '📋 Accéder à vos tâches :',
      'Allez dans "Mon Profil" > "Mes Tâches"',
      'ou',
      'Allez directement sur /user/taches',
      '',
      'Vous verrez toutes les tâches qui vous ont été affectées, groupées par projet',
      '',
      '💬 Pour commenter une tâche :',
      'Cliquez sur la tâche pour voir ses détails',
      'Dans la section "Commentaires", vous verrez tous les commentaires existants',
      '',
      '📝 Ajouter un commentaire :',
      'Tapez votre commentaire dans le champ "Ajouter un commentaire"',
      'Vous pouvez décrire :',
      '  • Ce que vous avez fait',
      '  • Les difficultés rencontrées',
      '  • Les prochaines étapes',
      '  • Toute information utile pour le suivi',
      '',
      '📊 Indiquer l\'avancement (optionnel) :',
      'Vous pouvez indiquer un pourcentage d\'avancement (0 à 100%)',
      'Cela permet de suivre visuellement la progression de la tâche',
      'Exemples :',
      '  • 0% : Tâche pas encore commencée',
      '  • 25% : Tâche en cours, début des travaux',
      '  • 50% : Tâche à mi-parcours',
      '  • 75% : Tâche presque terminée',
      '  • 100% : Tâche terminée',
      '',
      '✅ Envoyer le commentaire :',
      'Cliquez sur "Envoyer" ou "Ajouter le commentaire"',
      'Votre commentaire sera visible par les administrateurs et les autres adhérents affectés',
      '',
      '📋 Suivi de vos tâches :',
      'Vous pouvez voir :',
      '  • Le statut de chaque tâche (À planifier, En cours, Terminée, etc.)',
      '  • Les dates de début et de fin',
      '  • Les autres adhérents affectés à la même tâche',
      '  • Tous les commentaires et l\'historique d\'avancement',
      '',
      '🔔 Notifications :',
      'Vous recevrez une notification quand :',
      '  • Une nouvelle tâche vous est affectée',
      '  • Vous êtes retiré d\'une tâche',
      '  • Vous êtes désigné comme responsable d\'une tâche',
      '',
      '💡 Conseil : Commentez régulièrement pour tenir les administrateurs informés de l\'avancement',
      '💡 Conseil : Indiquez le pourcentage d\'avancement pour un suivi visuel plus clair',
      '💡 Conseil : Documentez les difficultés rencontrées pour faciliter l\'aide si nécessaire'
    ],
    actions: [
      { label: 'Voir mes tâches', action: 'open_taches', href: '/user/taches' }
    ]
  },
  {
    keywords: ['chat', 'messagerie', 'message', 'messages', 'conversation', 'conversations', 'discuter', 'discussion', 'envoyer message', 'nouveau message', 'chat interne', 'messagerie interne'],
    title: 'Comment utiliser la messagerie interne',
    steps: [
      '💬 La messagerie interne permet d\'échanger avec les autres adhérents de l\'association',
      '',
      '📋 Pour accéder à la messagerie :',
      'Cliquez sur "Messages" dans le menu principal (icône 💬)',
      'ou',
      'Allez directement sur /chat',
      '',
      '📝 Pour créer une nouvelle conversation :',
      'Cliquez sur le bouton "Nouvelle conversation" (icône +)',
      'Choisissez le type de conversation :',
      '  • Conversation privée : Discussion entre 2 personnes',
      '  • Groupe : Discussion avec plusieurs participants',
      '  • Événement : Discussion liée à un événement spécifique',
      '',
      '👥 Pour une conversation de groupe :',
      'Recherchez et sélectionnez les participants',
      'Si vous sélectionnez un seul participant, le titre sera généré automatiquement',
      'Si plusieurs participants, entrez un titre pour la conversation',
      'Cliquez sur "Créer la conversation"',
      '',
      '💬 Pour envoyer un message :',
      'Sélectionnez une conversation dans la liste de gauche',
      'Tapez votre message dans la zone de saisie en bas',
      'Vous pouvez :',
      '  • Répondre à un message spécifique (cliquez sur "Répondre")',
      '  • Ajouter une réaction (emoji)',
      '  • Modifier ou supprimer vos propres messages',
      'Appuyez sur Entrée pour envoyer',
      '',
      '🔍 Pour rechercher dans vos conversations :',
      'Utilisez la barre de recherche en haut de la liste des conversations',
      'Vous pouvez rechercher par nom de conversation ou nom de participant',
      '',
      '🔔 Notifications :',
      'Vous recevrez une notification (cloche) quand vous recevez un nouveau message',
      'Le nombre de messages non lus s\'affiche à côté de "Messages" dans le menu',
      '',
      '💡 Conseil : Utilisez les conversations de groupe pour organiser des discussions avec plusieurs personnes',
      '💡 Conseil : Les conversations liées à un événement permettent de communiquer avec les participants'
    ],
    actions: [
      { label: 'Ouvrir la messagerie', action: 'open_chat', href: '/chat' }
    ]
  },
  {
    keywords: ['nouvelle conversation', 'créer conversation', 'créer une conversation', 'démarrer conversation', 'demarrer conversation', 'discussion privée', 'discussion privee', 'conversation privée', 'conversation privee', 'groupe', 'conversation de groupe', 'conversation événement', 'conversation evenement'],
    title: 'Comment démarrer une nouvelle conversation (privée, groupe, événement)',
    steps: [
      'Allez sur /chat',
      'Cliquez sur "Nouvelle conversation" (icône +)',
      '',
      '✅ Choisissez le type :',
      '  • Privée : 1 seul participant (vous + 1 personne)',
      '  • Groupe : plusieurs participants',
      '  • Événement : discussion liée à un événement',
      '',
      '👥 Sélectionnez les participants :',
      '  • Utilisez la recherche pour trouver rapidement un nom ou un email',
      '  • Vous pouvez aussi sélectionner plusieurs personnes d\'un coup en groupe',
      '',
      '🏷️ Titre (si nécessaire) :',
      '  • Si plusieurs participants, donnez un titre clair (ex : "Organisation réunion janvier")',
      '',
      'Cliquez sur "Créer la conversation"',
      '',
      '💡 Conseil : Utilisez "Groupe" pour les sujets collectifs (organisation, infos), et "Privée" pour un échange 1–1'
    ],
    actions: [
      { label: 'Ouvrir la messagerie', action: 'open_chat', href: '/chat' }
    ]
  },
  {
    keywords: ['inviter', 'ajouter participant', 'ajouter participants', 'participants', 'sélectionner participants', 'selectionner participants', 'sélectionner tout', 'selectionner tout', 'choisir participants', 'limite conversation privée', 'limite conversation privee'],
    title: 'Comment bien choisir les participants (et éviter les erreurs)',
    steps: [
      'Allez sur /chat puis "Nouvelle conversation"',
      '',
      '👤 Conversation privée :',
      '  • Vous ne pouvez choisir qu\'1 participant',
      '  • Si vous voulez discuter à plusieurs, choisissez "Conversation de groupe"',
      '',
      '👥 Conversation de groupe :',
      '  • Utilisez la recherche (nom/email/rôle) pour filtrer',
      '  • Vous pouvez sélectionner/désélectionner tous les utilisateurs filtrés',
      '',
      '📌 Bonnes pratiques :',
      '  • Invitez uniquement les personnes concernées',
      '  • Donnez un titre explicite si le groupe est > 2 personnes',
      '  • Si le sujet concerne un événement, privilégiez "Événement" pour centraliser les échanges'
    ],
    actions: [
      { label: 'Créer une conversation', action: 'open_chat_new', href: '/chat' }
    ]
  },
  {
    keywords: ['répondre', 'repondre', 'citation', 'réponse', 'reponse', 'réagir', 'reagir', 'réaction', 'reaction', 'emoji', 'éditer message', 'editer message', 'modifier message', 'supprimer message'],
    title: 'Comment répondre et réagir dans le chat',
    steps: [
      'Allez sur /chat et ouvrez une conversation',
      '',
      '↩️ Répondre à un message :',
      'Cliquez sur "Répondre" sur le message concerné puis envoyez votre réponse',
      '',
      '😊 Réagir avec un emoji :',
      'Cliquez sur l\'icône de réaction (emoji) puis choisissez votre réaction',
      '',
      '✏️ Modifier / 🗑️ Supprimer :',
      'Selon vos droits, vous pouvez modifier ou supprimer vos propres messages',
      '',
      '💡 Conseil : Utilisez la réponse à un message pour garder le contexte clair dans les conversations actives'
    ],
    actions: [
      { label: 'Ouvrir la messagerie', action: 'open_chat', href: '/chat' }
    ]
  },
  {
    keywords: ['recherche conversation', 'rechercher conversation', 'retrouver conversation', 'trouver conversation', 'filtrer conversations', 'messages non lus', 'non lus', 'unread'],
    title: 'Comment retrouver une conversation et vos messages non lus',
    steps: [
      'Allez sur /chat',
      '',
      '🔎 Rechercher une conversation :',
      'Utilisez la barre de recherche en haut de la liste des conversations',
      'Vous pouvez rechercher par :',
      '  • Titre de conversation',
      '  • Nom d\'un participant',
      '  • Email d\'un participant',
      '',
      '📩 Messages non lus :',
      'Un indicateur de non-lus peut apparaître sur la conversation',
      '',
      '💡 Conseil : Donnez des titres clairs aux groupes pour les retrouver facilement (ex : "Bureau", "Préparation événement", etc.)'
    ],
    actions: [
      { label: 'Ouvrir la messagerie', action: 'open_chat', href: '/chat' }
    ]
  },
  {
    keywords: ['notification', 'envoyer notification', 'contacter', 'prévenir', 'prevenir', 'annonce', 'message important', 'info importante', 'diffuser', 'broadcast', 'quel canal', 'chat ou notification', 'notification ou chat'],
    title: 'Chat ou notification : quel canal choisir ?',
    steps: [
      '✅ Utilisez le chat si :',
      '  • Vous attendez une discussion (questions/réponses)',
      '  • Le sujet concerne un petit groupe',
      '  • Vous voulez échanger de façon informelle',
      '',
      '✅ Utilisez les notifications si :',
      '  • C\'est une information importante à ne pas rater (rappel, annonce)',
      '  • Vous voulez cibler plusieurs adhérents rapidement',
      '  • Vous voulez inclure un lien direct vers une page (paiement, événement, tâches, etc.)',
      '',
      '💡 Conseil : Pour une annonce importante, envoyez une notification + mettez les détails dans une conversation dédiée si besoin'
    ],
    actions: [
      { label: 'Voir mes notifications', action: 'open_notifications', href: '/notifications' },
      { label: 'Ouvrir la messagerie', action: 'open_chat', href: '/chat' }
    ]
  },
  {
    keywords: ['admin notification', 'créer notification admin', 'envoyer notification admin', 'diffuser notification', 'notification à plusieurs', 'notification à tous', 'notification tous', 'annoncer', 'rappel', 'message admin'],
    title: '[ADMIN] Comment envoyer une notification efficace aux adhérents',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez sur /admin/notifications',
      'Cliquez sur "Créer une notification"',
      '',
      '👥 Ciblage :',
      '  • Sélectionnez un ou plusieurs adhérents',
      '',
      '📝 Contenu :',
      '  • Titre : court et explicite (ex : "Rappel cotisation", "Réunion samedi 15h")',
      '  • Message : détaillez en 1–3 phrases',
      '  • Lien (optionnel) : mettez une URL interne utile (ex : /evenements, /user/taches, /paiement, etc.)',
      '',
      '🔖 Type :',
      'Choisissez le type le plus adapté (Système, Action, Événement, Cotisation, …)',
      '',
      'Cliquez sur "Créer" / "Envoyer"',
      '',
      '💡 Conseil : Ajoutez un lien quand l\'adhérent doit faire une action (payer, s\'inscrire, ouvrir une page)',
      '💡 Conseil : Évitez de spammer : préférez 1 notification claire plutôt que plusieurs petites'
    ],
    actions: [
      { label: 'Admin - Notifications', action: 'open_admin_notifications', href: '/admin/notifications' }
    ]
  },
  {
    keywords: [
      'admin canal',
      'choisir canal',
      'chat notification email',
      'notification ou email',
      'chat ou email',
      'notification vs email',
      'diffuser info',
      'communiquer adhérents',
      'communiquer adherents',
      'annonce admin',
      'rappel admin'
    ],
    title: '[ADMIN] Chat vs notification vs email : quoi utiliser et quand ?',
    steps: [
      '📋 Cette guidance est destinée aux administrateurs',
      '',
      '💬 Utilisez le chat (/chat) si :',
      '  • Vous voulez une discussion interactive (questions/réponses)',
      '  • Le sujet concerne un petit groupe (bureau, équipe projet, participants)',
      '  • Vous voulez centraliser l\'échange en temps réel',
      '',
      '🔔 Utilisez une notification (/admin/notifications) si :',
      '  • C\'est un rappel/une annonce à voir dans l\'application',
      '  • Vous voulez mettre un lien d\'action (ex : /evenements, /paiement, /user/taches)',
      '  • Vous ciblez rapidement 1 ou plusieurs adhérents',
      '',
      '📧 Utilisez un email (/admin/emails) si :',
      '  • Le message est long ou formel (compte rendu, information structurée)',
      '  • Vous voulez toucher les adhérents même s\'ils ne se connectent pas',
      '  • Vous avez besoin d\'un historique d\'envoi (succès/échec)',
      '',
      '✅ Bonnes pratiques :',
      '  • Une annonce importante : notification + (optionnel) email si contenu long',
      '  • Un sujet organisationnel : chat de groupe dédié',
      '  • Évitez le spam : regroupez les informations et soyez concis'
    ],
    actions: [
      { label: 'Ouvrir le chat', action: 'open_chat', href: '/chat' },
      { label: 'Admin - Notifications', action: 'open_admin_notifications', href: '/admin/notifications' },
      { label: 'Admin - Emails', action: 'open_admin_emails', href: '/admin/emails' }
    ]
  },
  {
    keywords: ['idée', 'idées', 'idee', 'idees', 'proposer idée', 'soumettre idée', 'boîte à idées'],
    title: 'Comment proposer une idée',
    steps: [
      'Allez dans "Mon Profil" > "Mes Idées"',
      'Cliquez sur "Nouvelle idée" ou "Proposer une idée"',
      'Remplissez le formulaire avec votre idée',
      'Ajoutez une description détaillée',
      'Soumettez votre idée',
      'Votre idée sera examinée par les administrateurs',
      'Vous pouvez suivre le statut de votre idée dans "Mes Idées"'
    ],
    actions: [
      { label: 'Voir mes idées', action: 'open_idees', href: '/user/profile?section=idees' }
    ]
  },
  {
    keywords: ['galerie', 'photos', 'images', 'vidéos', 'videos', 'voir galerie', 'consulter galerie'],
    title: 'Comment consulter la galerie',
    steps: [
      'Allez dans la section "Galerie" du menu principal',
      'Vous verrez toutes les photos et vidéos de l\'association',
      'Vous pouvez filtrer par type (photos, vidéos)',
      'Cliquez sur une image pour l\'agrandir',
      'Les médias sont organisés par événements ou catégories'
    ],
    actions: [
      { label: 'Voir la galerie', action: 'open_galerie', href: '/galerie' }
    ]
  },
  {
    keywords: ['contact', 'contacter', 'support', 'aide', 'assistance', 'écrire', 'message'],
    title: 'Comment contacter l\'association',
    steps: [
      'Allez dans la section "Contact" du menu principal',
      'Remplissez le formulaire de contact',
      'Indiquez votre nom, email et votre message',
      'Sélectionnez le sujet de votre demande',
      'Envoyez votre message',
      'Vous recevrez une réponse par email dans les plus brefs délais'
    ],
    actions: [
      { label: 'Page de contact', action: 'open_contact', href: '/contact' }
    ]
  },
  {
    keywords: ['inscription', 's\'inscrire', 'sinscrire', 'adhérer', 'adherer', 'devenir membre', 'nouveau membre'],
    title: 'Comment s\'inscrire à l\'association',
    steps: [
      'Allez dans la section "Inscription" du menu principal',
      'Remplissez le formulaire d\'inscription avec vos informations',
      'Vérifiez que toutes les informations sont correctes',
      'Acceptez les conditions d\'utilisation',
      'Soumettez votre demande d\'inscription',
      'Vous recevrez un email de confirmation',
      'Votre demande sera examinée par les administrateurs',
      'Une fois approuvée, vous recevrez vos identifiants de connexion'
    ],
    actions: [
      { label: 'Page d\'inscription', action: 'open_inscription', href: '/inscription' }
    ]
  },
  {
    keywords: ['enfant', 'enfants', 'ajouter enfant', 'modifier enfant', 'gérer enfants', 'mes enfants'],
    title: 'Comment gérer mes enfants',
    steps: [
      'Allez dans "Mon Profil" > "Mes Enfants"',
      'Cliquez sur "Ajouter un enfant" pour enregistrer un nouvel enfant',
      'Remplissez les informations de l\'enfant (nom, prénom, date de naissance)',
      'Vous pouvez modifier les informations d\'un enfant existant',
      'Les informations sur vos enfants sont utilisées pour les événements familiaux et les assistances'
    ],
    actions: [
      { label: 'Gérer mes enfants', action: 'open_enfants', href: '/user/profile?section=enfants' }
    ]
  },
  {
    keywords: ['statistique', 'statistiques', 'stats', 'mes stats', 'mon activité', 'mon historique'],
    title: 'Comment voir mes statistiques',
    steps: [
      'Allez dans "Mon Profil" > "Statistiques"',
      'Vous verrez vos statistiques personnelles :',
      '• Nombre de cotisations payées',
      '• Nombre d\'événements auxquels vous avez participé',
      '• Nombre de votes effectués',
      '• Nombre de badges obtenus',
      '• Votre ancienneté dans l\'association',
      'Ces statistiques sont mises à jour automatiquement'
    ],
    actions: [
      { label: 'Voir mes statistiques', action: 'open_statistiques', href: '/user/profile?section=statistiques' }
    ]
  },
  {
    keywords: ['dette', 'dettes', 'devoir', 'devoirs', 'mes dettes', 'dettes initiales', 'voir mes dettes'],
    title: 'Comment voir mes dettes',
    steps: [
      'Allez dans "Mon Profil" > "Mes Cotisations"',
      'Vous verrez la section "Dettes initiales"',
      'Toutes vos dettes sont listées par année',
      'Pour chaque dette, vous verrez le montant total et le montant restant à payer',
      'Cliquez sur "Payer" pour régler une dette',
      'Vous pouvez payer une dette en plusieurs fois'
    ],
    actions: [
      { label: 'Voir mes cotisations', action: 'open_cotisations', href: '/user/profile?section=cotisations' }
    ]
  },
  {
    keywords: ['historique', 'historique paiement', 'historique cotisation', 'mes paiements', 'voir paiements'],
    title: 'Comment voir mon historique de paiements',
    steps: [
      'Allez dans "Mon Profil" > "Mes Cotisations"',
      'Vous verrez la section "Historique des cotisations"',
      'Tous vos paiements sont listés avec la date, le montant et le moyen de paiement',
      'Vous pouvez filtrer par période ou par type de cotisation',
      'Chaque paiement affiche un reçu téléchargeable'
    ],
    actions: [
      { label: 'Voir mes cotisations', action: 'open_cotisations', href: '/user/profile?section=cotisations' }
    ]
  },
  {
    keywords: ['statut', 'statuts', 'juridique', 'loi 1901', 'consulter statut', 'voir statut', 'règlement'],
    title: 'Comment consulter les statuts de l\'association',
    steps: [
      'Allez dans la section "L\'amicale" du menu principal',
      'Dans la section "Informations Légales", cliquez sur "Notre Statut"',
      'Le dialog des statuts s\'ouvrira avec tous les articles',
      'Vous pouvez lire les statuts complets dans le dialog',
      'Cliquez sur "Télécharger le PDF" pour obtenir une copie officielle des statuts signés',
      'Les statuts ont été validés et signés par les autorités le 29 novembre 2025'
    ],
    actions: [
      { label: 'Voir la page Amicale', action: 'open_amicale', href: '/amicale' }
    ]
  },
  {
    keywords: ['aide', 'help', 'assistance', 'support', 'comment faire', 'amaki', 'qui es-tu', 'présente-toi'],
    title: 'Besoin d\'aide ?',
    steps: [
      'Bonjour ! Je suis Amaki, votre assistant virtuel sur la plateforme AMAKI France.',
      'Je suis là pour vous aider à naviguer et utiliser toutes les fonctionnalités de la plateforme.',
      'Vous pouvez me poser des questions sur :',
      '• Comment modifier votre mot de passe',
      '• Comment payer vos cotisations',
      '• Comment modifier votre photo de profil',
      '• Comment modifier votre profil',
      '• Comment imprimer votre passeport',
      '• Comment voir vos obligations',
      '• Comment voir vos droits',
      '• Comment consulter le règlement d\'ordre intérieur',
      '• Comment accéder à vos documents',
      '• Comment téléverser un document',
      '• Comment voir vos badges',
      '• Comment postuler à une élection',
      '• Comment voter',
      '• Comment participer à un événement',
      '• Comment consulter les rapports de réunion',
      '• Comment gérer vos notifications',
      '• Comment utiliser la messagerie interne',
      '• Comment commenter ou documenter l\'avancement de vos tâches',
      '• Comment proposer une idée dans la boîte à idées',
      '• [ADMIN] Comment encaisser une cotisation manuelle',
      '• [ADMIN] Comment créer une cotisation mensuelle',
      '• [ADMIN] Comment ajouter une assistance',
      '• [ADMIN] Comment créer un événement',
      '• [ADMIN] Comment créer un projet',
      '• [ADMIN] Comment ajouter une tâche à un projet',
      '• [ADMIN] Comment affecter une tâche à un adhérent',
      '• [ADMIN] Comment créer et ajouter une photo ou vidéo dans la galerie',
      '• [ADMIN] Comment envoyer une notification',
      '• [ADMIN] Comment envoyer un email aux adhérents',
      '• [ADMIN] Comment créer et gérer une dépense',
      '• [ADMIN] Comment gérer les types de dépenses',
      'Tapez simplement votre question et je vous guiderai étape par étape !'
    ]
  },
  // ============================================================
  // GUIDES POUR LES ADMINISTRATEURS
  // ============================================================
  {
    keywords: ['encaisser', 'encaissement', 'cotisation manuelle', 'paiement manuel', 'enregistrer paiement', 'saisir paiement', 'enregistrer cotisation', 'admin encaisser', 'encaisser cotisation'],
    title: '[ADMIN] Comment encaisser une cotisation manuelle',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Gestion des Cotisations"',
      'Recherchez l\'adhérent concerné dans la liste',
      'Cliquez sur le bouton "Actions" (trois points) à côté de l\'adhérent',
      'Sélectionnez "Encaisser un paiement manuel"',
      'Dans le formulaire qui s\'ouvre :',
      '  • Sélectionnez le type de cotisation (Mensuelle, Dette initiale, etc.)',
      '  • Entrez le montant encaissé',
      '  • Choisissez le moyen de paiement (Espèces, Chèque, Virement)',
      '  • Si c\'est un chèque, notez le numéro',
      '  • Ajoutez une note si nécessaire (optionnel)',
      'Vérifiez toutes les informations',
      'Cliquez sur "Enregistrer le paiement"',
      'Un reçu sera automatiquement généré et envoyé à l\'adhérent par email',
      'Le paiement sera visible dans l\'historique de l\'adhérent',
      '💡 Conseil : Pour les paiements en espèces, pensez à émettre un reçu papier également'
    ],
    actions: [
      { label: 'Gestion des cotisations', action: 'open_admin_cotisations', href: '/admin/cotisations/gestion' }
    ]
  },
  {
    keywords: ['créer cotisation mensuelle', 'générer cotisation mensuelle', 'cotisation du mois', 'lancer cotisation', 'nouvelle cotisation mensuelle', 'admin cotisation', 'créer cotisation'],
    title: '[ADMIN] Comment créer la cotisation mensuelle',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Gestion des Cotisations" > "Cotisations Mensuelles"',
      'Cliquez sur le bouton "Créer la cotisation du mois"',
      'Un dialog de confirmation s\'ouvre avec les informations suivantes :',
      '  • Le mois et l\'année de la cotisation à créer',
      '  • Le nombre d\'adhérents éligibles',
      '  • Le montant de la cotisation mensuelle actuel',
      'Vérifiez que le mois affiché est correct',
      'Cliquez sur "Confirmer la création"',
      'Le système va automatiquement :',
      '  • Créer la cotisation pour tous les adhérents éligibles',
      '  • Appliquer les assistances programmées',
      '  • Calculer les montants dus pour chaque adhérent',
      '  • Envoyer des notifications aux adhérents',
      'Une fois terminé, vous verrez un message de confirmation avec le nombre de cotisations créées',
      'Les adhérents recevront un email les informant de leur nouvelle cotisation',
      '⚠️ Important : Cette opération ne peut être effectuée qu\'une seule fois par mois',
      '💡 Conseil : Créez la cotisation mensuelle au début de chaque mois (idéalement le 1er)'
    ],
    actions: [
      { label: 'Cotisations mensuelles', action: 'open_admin_cotisations_mensuelles', href: '/admin/cotisations/mensuelles' }
    ]
  },
  {
    keywords: ['assistance', 'aider adhérent', 'créer assistance', 'ajouter assistance', 'enregistrer assistance', 'admin assistance', 'soutien adhérent', 'aide financière'],
    title: '[ADMIN] Comment ajouter ou créer une assistance',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Il existe deux types d\'assistances : ponctuelle et mensuelle récurrente',
      '',
      '🔹 Pour créer une assistance ponctuelle :',
      'Allez dans "Admin" > "Gestion des Cotisations" > "Assistances"',
      'Cliquez sur "Nouvelle assistance ponctuelle"',
      'Remplissez le formulaire :',
      '  • Sélectionnez le bénéficiaire (adhérent)',
      '  • Choisissez le donateur (adhérent qui aide)',
      '  • Entrez le montant de l\'assistance',
      '  • Sélectionnez la période (mois/année)',
      '  • Ajoutez une description (motif de l\'assistance)',
      'Cliquez sur "Enregistrer"',
      '',
      '🔹 Pour créer une assistance mensuelle récurrente :',
      'Allez dans "Admin" > "Gestion des Cotisations" > "Assistances Mensuelles"',
      'Cliquez sur "Nouvelle assistance mensuelle"',
      'Remplissez le formulaire :',
      '  • Sélectionnez le bénéficiaire',
      '  • Choisissez le donateur',
      '  • Entrez le montant mensuel',
      '  • Définissez la date de début',
      '  • Définissez la date de fin (optionnel)',
      '  • Choisissez la récurrence (tous les mois, tous les 2 mois, etc.)',
      '  • Ajoutez une description',
      'Cliquez sur "Enregistrer"',
      '',
      'L\'assistance sera automatiquement appliquée lors de la création des cotisations mensuelles',
      'Les deux adhérents (donateur et bénéficiaire) recevront une notification',
      '💡 Conseil : Les assistances mensuelles sont idéales pour les soutiens réguliers'
    ],
    actions: [
      { label: 'Gérer les assistances', action: 'open_admin_assistances', href: '/admin/cotisations/assistances' }
    ]
  },
  {
    keywords: ['ajouter événement', 'créer événement', 'nouvel événement', 'organiser événement', 'admin événement', 'event', 'créer event', 'ajouter event', 'créer un événement', 'comment créer événement'],
    title: '[ADMIN] Comment créer un événement',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Événements" ou directement sur /admin/evenements',
      'Cliquez sur le bouton "Nouvel événement" ou "Créer un événement"',
      '',
      '📝 Informations obligatoires :',
      '  • Titre de l\'événement (obligatoire)',
      '  • Description détaillée (obligatoire)',
      '  • Date de début (obligatoire)',
      '  • Date d\'affichage (date à partir de laquelle l\'événement est visible)',
      '  • Date de fin d\'affichage (date jusqu\'à laquelle l\'événement reste visible)',
      '',
      '📋 Informations optionnelles mais recommandées :',
      '  • Contenu détaillé : Texte enrichi avec toutes les informations complémentaires',
      '  • Date de fin : Si l\'événement dure plusieurs jours',
      '  • Lieu : Nom du lieu (ex: "Salle des fêtes", "Parc de la Villette")',
      '  • Adresse : Adresse complète du lieu',
      '',
      '🏷️ Catégorie et statut :',
      '  • Catégorie : Général, Formation, Social, Sportif, Culturel',
      '  • Statut :',
      '    - Brouillon : L\'événement n\'est pas encore publié',
      '    - Publié : L\'événement est visible par tous',
      '    - Archivé : L\'événement est terminé et archivé',
      '  • Visibilité :',
      '    - Public : Visible par tout le monde sur /evenements',
      '    - Réservé aux adhérents : Visible uniquement sur /agenda',
      '',
      '👥 Paramètres d\'inscription :',
      '  • Inscription requise : Activez si les adhérents doivent s\'inscrire',
      '  • Nombre de places disponibles : Limitez le nombre de participants',
      '  • Date limite d\'inscription : Date après laquelle on ne peut plus s\'inscrire',
      '  • Prix : Si l\'événement est payant, indiquez le montant',
      '',
      '📞 Contact :',
      '  • Email de contact : Pour les questions sur l\'événement',
      '  • Téléphone de contact : Numéro à joindre',
      '',
      '🖼️ Images :',
      '  • Image principale : Téléchargez une image de couverture (recommandé)',
      '  • Images supplémentaires : Vous pouvez ajouter plusieurs images',
      '  • Formats acceptés : JPG, PNG (max 5 Mo par image)',
      '',
      '🏷️ Tags :',
      '  • Ajoutez des tags pour faciliter la recherche (ex: "sortie", "famille", "culture")',
      '',
      '✅ Validation :',
      'Vérifiez toutes les informations avant de créer',
      'Cliquez sur "Enregistrer" ou "Créer l\'événement"',
      '',
      '📢 Après la création :',
      '  • Si le statut est "Publié", l\'événement sera visible immédiatement',
      '  • Les adhérents pourront s\'inscrire si l\'inscription est requise',
      '  • Vous pourrez gérer les inscriptions dans la page de gestion de l\'événement',
      '  • Vous pourrez modifier l\'événement à tout moment',
      '',
      '💡 Conseil : Créez l\'événement au moins 2 semaines à l\'avance pour permettre aux adhérents de s\'organiser',
      '💡 Conseil : Utilisez une image attrayante pour améliorer la visibilité de l\'événement',
      '💡 Conseil : Remplissez bien la description et le contenu détaillé pour informer au mieux les adhérents',
      '⚠️ Important : Les dates d\'affichage déterminent quand l\'événement apparaît dans le calendrier'
    ],
    actions: [
      { label: 'Gestion des événements', action: 'open_admin_events', href: '/admin/evenements' }
    ]
  },
  {
    keywords: ['créer projet', 'nouveau projet', 'ajouter projet', 'admin projet', 'créer un projet', 'comment créer projet', 'gestion projet'],
    title: '[ADMIN] Comment créer un projet',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Projets" ou directement sur /admin/projets',
      'Cliquez sur le bouton "Nouveau projet" ou "Créer un projet"',
      '',
      '📝 Informations obligatoires :',
      '  • Titre du projet : Nom du projet (ex: "Organisation de l\'événement annuel")',
      '  • Description : Description détaillée du projet',
      '',
      '📋 Informations optionnelles :',
      '  • Statut : Choisissez parmi :',
      '    - Planifié : Projet planifié, pas encore démarré',
      '    - En cours : Projet en cours d\'exécution',
      '    - En pause : Projet mis en pause temporairement',
      '    - Terminé : Projet terminé',
      '    - Annulé : Projet annulé',
      '  • Date de début : Date de début prévue ou effective',
      '  • Date de fin : Date de fin prévue ou effective',
      '',
      '✅ Validation :',
      'Vérifiez toutes les informations',
      'Cliquez sur "Créer le projet"',
      '',
      '📊 Après la création :',
      '  • Le projet apparaît dans la liste des projets',
      '  • Vous pouvez maintenant ajouter des tâches (sous-projets) au projet',
      '  • Vous pouvez modifier ou supprimer le projet à tout moment',
      '',
      '💡 Conseil : Donnez un titre clair et une description détaillée pour faciliter la compréhension',
      '💡 Conseil : Définissez des dates réalistes pour mieux planifier le projet'
    ],
    actions: [
      { label: 'Gestion des projets', action: 'open_admin_projets', href: '/admin/projets' }
    ]
  },
  {
    keywords: ['ajouter tâche', 'créer tâche', 'nouvelle tâche', 'ajouter sous-projet', 'créer sous-projet', 'admin tâche', 'tâche projet', 'comment ajouter tâche', 'comment créer tâche'],
    title: '[ADMIN] Comment ajouter une tâche à un projet',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Projets"',
      'Cliquez sur le projet pour lequel vous voulez ajouter une tâche',
      'ou',
      'Allez directement sur /admin/projets/[id]',
      '',
      'Dans la page de détail du projet, cliquez sur "Nouvelle tâche" ou "Ajouter une tâche"',
      '',
      '📝 Informations obligatoires :',
      '  • Titre de la tâche : Nom de la tâche (ex: "Préparation du matériel")',
      '  • Description : Description détaillée de la tâche',
      '',
      '📋 Informations optionnelles :',
      '  • Statut : Choisissez parmi :',
      '    - À planifier : Tâche à planifier',
      '    - En attente : Tâche en attente de démarrage',
      '    - En cours : Tâche en cours d\'exécution',
      '    - En pause : Tâche mise en pause',
      '    - Terminée : Tâche terminée',
      '    - Annulée : Tâche annulée',
      '  • Ordre : Numéro d\'ordre pour l\'affichage dans la liste (0 par défaut)',
      '  • Date de début : Date de début prévue ou effective',
      '  • Date de fin : Date de fin prévue ou effective',
      '',
      '✅ Validation :',
      'Vérifiez toutes les informations',
      'Cliquez sur "Créer la tâche"',
      '',
      '📊 Après la création :',
      '  • La tâche apparaît dans la liste des tâches du projet',
      '  • Vous pouvez maintenant affecter des adhérents à cette tâche',
      '  • Vous pouvez modifier ou supprimer la tâche à tout moment',
      '',
      '💡 Conseil : Utilisez l\'ordre pour organiser les tâches dans un ordre logique',
      '💡 Conseil : Définissez des dates pour chaque tâche pour mieux suivre l\'avancement'
    ],
    actions: [
      { label: 'Gestion des projets', action: 'open_admin_projets', href: '/admin/projets' }
    ]
  },
  {
    keywords: ['affecter tâche', 'affecter adhérent', 'assigner tâche', 'assigner adhérent', 'affecter une tâche', 'comment affecter tâche', 'attribuer tâche', 'donner tâche'],
    title: '[ADMIN] Comment affecter une tâche à un adhérent',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Projets"',
      'Cliquez sur le projet contenant la tâche',
      'Dans la liste des tâches, cliquez sur le bouton "Affecter" (icône 👥) à côté de la tâche',
      '',
      '📋 Dans le dialog d\'affectation :',
      'Vous verrez la liste de tous les adhérents',
      'Utilisez la barre de recherche pour trouver rapidement un adhérent',
      '',
      '✅ Sélection des adhérents :',
      'Cochez les adhérents que vous voulez affecter à la tâche',
      'Vous pouvez sélectionner plusieurs adhérents en même temps',
      'Les adhérents déjà affectés sont pré-cochés',
      '',
      '👤 Responsable :',
      'Vous pouvez désigner un responsable en cochant l\'option "Responsable"',
      'Le premier adhérent sélectionné sera automatiquement responsable si cette option est activée',
      '',
      '✅ Validation :',
      'Vérifiez les adhérents sélectionnés',
      'Cliquez sur "Affecter"',
      '',
      '📢 Notifications automatiques :',
      'Les adhérents nouvellement affectés recevront une notification',
      'Les adhérents retirés recevront également une notification',
      'En cas de changement de responsable, les personnes concernées seront notifiées',
      '',
      '📊 Après l\'affectation :',
      'Les adhérents affectés verront la tâche dans "Mon Profil" > "Mes Tâches"',
      'Ils pourront commenter et documenter l\'avancement de la tâche',
      'Vous pouvez modifier les affectations à tout moment',
      '',
      '💡 Conseil : Affectez les tâches dès leur création pour permettre aux adhérents de commencer rapidement',
      '💡 Conseil : Désignez un responsable pour chaque tâche importante pour faciliter le suivi',
      '⚠️ Important : Un adhérent ne peut être affecté qu\'une seule fois à une même tâche'
    ],
    actions: [
      { label: 'Gestion des projets', action: 'open_admin_projets', href: '/admin/projets' }
    ]
  },
  {
    keywords: ['galerie', 'ajouter photo', 'ajouter image', 'télécharger photo', 'upload photo', 'admin galerie', 'ajouter média', 'publier photo', 'uploader image', 'créer photo', 'créer vidéo', 'ajouter vidéo', 'télécharger vidéo', 'upload vidéo', 'créer média galerie', 'comment ajouter photo galerie', 'comment ajouter vidéo galerie'],
    title: '[ADMIN] Comment créer et ajouter une photo ou une vidéo dans la galerie',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Galerie" ou directement sur /admin/galerie',
      'Cliquez sur le bouton "Nouveau média" ou "Ajouter un média"',
      '',
      '📤 Sélection du fichier :',
      'Cliquez sur "Choisir un fichier" ou glissez-déposez votre fichier',
      'Vous pouvez ajouter un seul média à la fois',
      '',
      '📸 Formats acceptés :',
      '  • Images : JPG, JPEG, PNG, GIF, WEBP',
      '  • Vidéos : MP4, WEBM, MOV, AVI',
      '',
      '💾 Tailles maximales :',
      '  • Images : Maximum 10 Mo par fichier',
      '  • Vidéos : Jusqu\'à 5 Go par fichier (upload par chunks automatique)',
      '',
      '📝 Informations obligatoires :',
      '  • Titre : Nom du média (ex: "Sortie au parc", "Réunion mensuelle")',
      '  • Type : Sélectionnez "Photo" ou "Vidéo" selon votre fichier',
      '  • Catégorie : Choisissez parmi :',
      '    - Événements Officiels',
      '    - Événements Sociaux',
      '    - Actions Caritatives',
      '    - Formations et Conférences',
      '  • Date : Date de prise de vue ou de l\'événement',
      '',
      '📋 Informations optionnelles :',
      '  • Description : Description détaillée du média',
      '  • Couleur : Choisissez une couleur pour l\'affichage (Bleu, Vert, Violet, Orange)',
      '  • Lieu : Lieu où la photo/vidéo a été prise',
      '  • Ordre : Numéro d\'ordre pour l\'affichage (0 par défaut)',
      '  • Statut :',
      '    - Actif : Le média est visible dans la galerie publique',
      '    - Inactif : Le média est masqué (mais toujours dans la base)',
      '',
      '✅ Validation et upload :',
      'Vérifiez que toutes les informations sont correctes',
      'Cliquez sur "Ajouter" ou "Enregistrer"',
      'Une barre de progression s\'affiche pendant l\'upload',
      'Pour les gros fichiers vidéo, l\'upload se fait automatiquement par chunks',
      '',
      '📊 Après l\'ajout :',
      '  • Le média apparaît immédiatement dans la liste de la galerie',
      '  • Si le statut est "Actif", il sera visible dans la galerie publique (/galerie)',
      '  • Vous pouvez modifier ou supprimer le média à tout moment',
      '  • Vous pouvez changer le statut (Actif/Inactif) sans supprimer le média',
      '',
      '🔍 Gestion des médias :',
      'Dans la liste, vous pouvez :',
      '  • Voir tous les médias (photos et vidéos)',
      '  • Filtrer par type (Photo/Vidéo)',
      '  • Filtrer par catégorie',
      '  • Filtrer par statut (Actif/Inactif)',
      '  • Rechercher par titre ou description',
      '  • Modifier un média existant',
      '  • Supprimer un média',
      '  • Changer l\'ordre d\'affichage',
      '',
      '💡 Conseil : Utilisez des titres clairs et descriptifs pour faciliter la recherche',
      '💡 Conseil : Ajoutez une description pour donner du contexte aux adhérents',
      '💡 Conseil : Organisez vos médias par catégorie pour une meilleure navigation',
      '💡 Conseil : Utilisez l\'ordre pour mettre en avant certains médias',
      '💡 Conseil : Pour les gros fichiers vidéo, l\'upload peut prendre quelques minutes, soyez patient',
      '⚠️ Important : Les médias inactifs ne sont pas visibles dans la galerie publique mais restent dans la base de données'
    ],
    actions: [
      { label: 'Gestion de la galerie', action: 'open_admin_galerie', href: '/admin/galerie' }
    ]
  },
  {
    keywords: ['envoyer notification', 'notifier', 'créer notification', 'admin notification', 'notification adhérent', 'notification groupe', 'alerter adhérent', 'message notification'],
    title: '[ADMIN] Comment envoyer une notification à un ou plusieurs adhérents',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Gestion des Notifications"',
      'Cliquez sur "Nouvelle notification"',
      '',
      '📝 Contenu de la notification :',
      '  • Titre de la notification (court et explicite)',
      '  • Message (texte de la notification)',
      '  • Type de notification :',
      '    - Info (bleu) : Information générale',
      '    - Succès (vert) : Confirmation, félicitations',
      '    - Avertissement (orange) : Attention importante',
      '    - Erreur (rouge) : Alerte urgente',
      '  • Lien optionnel vers une page spécifique',
      '',
      '👥 Destinataires :',
      'Vous pouvez choisir plusieurs options :',
      '',
      '🔹 Envoyer à tous les adhérents :',
      '  • Cochez "Tous les adhérents"',
      '  • La notification sera envoyée à tous',
      '',
      '🔹 Envoyer à des adhérents spécifiques :',
      '  • Décochez "Tous les adhérents"',
      '  • Recherchez et sélectionnez les adhérents dans la liste',
      '  • Vous pouvez sélectionner plusieurs adhérents',
      '',
      '🔹 Envoyer par critères :',
      '  • Filtrez par statut (Actif, Inactif, En attente)',
      '  • Filtrez par type d\'adhésion',
      '  • Filtrez par situation de paiement (à jour, en dette)',
      '  • Filtrez par présence à un événement',
      '',
      '📅 Programmation :',
      '  • Envoi immédiat : la notification est envoyée dès la validation',
      '  • Envoi programmé : choisissez une date et heure d\'envoi',
      '',
      '✅ Validation :',
      'Vérifiez le contenu et les destinataires',
      'Cliquez sur "Envoyer la notification"',
      '',
      'Les adhérents verront la notification :',
      '  • Dans l\'application (cloche de notification)',
      '  • Par email si l\'option est activée',
      '  • Sur leur téléphone si les notifications push sont activées',
      '',
      '💡 Conseil : Utilisez des titres clairs pour que les adhérents comprennent rapidement le sujet'
    ],
    actions: [
      { label: 'Gestion des notifications', action: 'open_admin_notifications', href: '/admin/notifications' }
    ]
  },
  {
    keywords: ['dépense', 'dépenses', 'créer dépense', 'ajouter dépense', 'nouvelle dépense', 'enregistrer dépense', 'admin dépense', 'gérer dépenses', 'gestion dépenses', 'dépense association'],
    title: '[ADMIN] Comment créer et gérer une dépense',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Gestion des Finances" > "Dépenses"',
      'ou',
      'Allez directement sur /admin/depenses',
      '',
      '➕ Pour créer une nouvelle dépense :',
      'Cliquez sur le bouton "Nouvelle dépense" ou "Créer une dépense"',
      'Remplissez le formulaire :',
      '',
      '📝 Informations obligatoires :',
      '  • Libellé : Description courte de la dépense',
      '  • Montant : Montant de la dépense (en euros)',
      '  • Date de dépense : Date à laquelle la dépense a été effectuée',
      '',
      '📋 Informations optionnelles :',
      '  • Type de dépense : Sélectionnez un type prédéfini (si disponible)',
      '  • Catégorie : Catégorie de la dépense (Fournitures, Transport, Communication, etc.)',
      '  • Description : Description détaillée de la dépense',
      '  • Justificatif : Upload d\'un fichier justificatif (facture, reçu, etc.)',
      '',
      '✅ Validation :',
      'Vérifiez toutes les informations',
      'Cliquez sur "Créer la dépense"',
      '',
      '📊 Statuts des dépenses :',
      '  • En attente : Dépense créée, en attente de validation',
      '  • Validée : Dépense approuvée par un administrateur',
      '  • Rejetée : Dépense refusée (avec raison)',
      '',
      '🔍 Pour gérer les dépenses existantes :',
      'Dans la liste des dépenses, vous pouvez :',
      '  • Voir les détails d\'une dépense',
      '  • Modifier une dépense (si elle n\'est pas encore validée)',
      '  • Valider une dépense',
      '  • Rejeter une dépense',
      '  • Supprimer une dépense (si elle n\'est pas validée)',
      '',
      '📎 Justificatifs :',
      'Pour chaque dépense, vous pouvez uploader des justificatifs :',
      '  • Formats acceptés : PDF, JPG, PNG, GIF, WEBP, BMP',
      '  • Taille maximale : 10 Mo par fichier',
      '  • Vous pouvez ajouter plusieurs justificatifs par dépense',
      '',
      '📈 Statistiques :',
      'La page affiche des statistiques :',
      '  • Total des dépenses',
      '  • Dépenses du mois',
      '  • Dépenses en attente',
      '  • Montant total du mois',
      '  • Montant total global',
      '',
      '💡 Conseil : Ajoutez toujours un justificatif pour faciliter la traçabilité',
      '💡 Conseil : Validez les dépenses régulièrement pour maintenir une comptabilité à jour',
      '⚠️ Important : Une dépense validée ou rejetée ne peut plus être modifiée'
    ],
    actions: [
      { label: 'Gestion des dépenses', action: 'open_admin_depenses', href: '/admin/depenses' }
    ]
  },
  {
    keywords: ['type dépense', 'types dépense', 'type de dépense', 'types de dépense', 'créer type dépense', 'gérer types dépense', 'admin type dépense', 'catégorie dépense', 'catégories dépense'],
    title: '[ADMIN] Comment gérer les types de dépenses',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Les types de dépenses permettent de catégoriser et organiser les dépenses de l\'association',
      '',
      '🔍 Pour accéder à la gestion des types :',
      'Allez dans "Admin" > "Gestion des Finances" > "Types de Dépenses"',
      'ou',
      'Allez directement sur /admin/types-depense',
      '',
      '➕ Pour créer un nouveau type de dépense :',
      'Cliquez sur le bouton "Nouveau type" ou "Créer un type"',
      'Remplissez le formulaire :',
      '',
      '📝 Informations requises :',
      '  • Titre : Nom du type de dépense (ex: "Fournitures de bureau", "Transport", "Communication")',
      '  • Description : Description détaillée du type (optionnel)',
      '  • Statut : Actif ou Inactif',
      '',
      '✅ Validation :',
      'Vérifiez les informations',
      'Cliquez sur "Créer le type"',
      '',
      '📋 Pour gérer les types existants :',
      'Dans la liste, vous pouvez :',
      '  • Voir les détails d\'un type',
      '  • Modifier un type (titre, description, statut)',
      '  • Activer/Désactiver un type',
      '  • Supprimer un type (si aucune dépense ne l\'utilise)',
      '',
      '🔍 Utilisation :',
      'Lors de la création d\'une dépense, vous pouvez sélectionner un type',
      'Cela permet de :',
      '  • Organiser les dépenses par catégorie',
      '  • Générer des rapports par type',
      '  • Faciliter la comptabilité',
      '',
      '💡 Conseil : Créez des types clairs et spécifiques pour une meilleure organisation',
      '💡 Conseil : Désactivez plutôt que supprimer les types non utilisés pour garder l\'historique',
      '⚠️ Important : Un type utilisé par des dépenses ne peut pas être supprimé'
    ],
    actions: [
      { label: 'Gestion des types de dépenses', action: 'open_admin_types_depense', href: '/admin/types-depense' }
    ]
  },
  {
    keywords: ['envoyer email', 'envoyer mail', 'email adhérent', 'mail adhérent', 'admin email', 'admin mail', 'emailing', 'mailing', 'email groupe', 'mail collectif'],
    title: '[ADMIN] Comment envoyer un email à un ou plusieurs adhérents',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Gestion des Emails"',
      'Cliquez sur "Nouvel email" ou "Composer un email"',
      '',
      '📝 Composition de l\'email :',
      '  • Objet de l\'email (ligne d\'objet)',
      '  • Corps du message :',
      '    - Utilisez l\'éditeur riche pour formater le texte',
      '    - Ajoutez des images, liens, tableaux',
      '    - Insérez des variables personnalisées (prénom, nom, etc.)',
      '  • Signature automatique de l\'association',
      '',
      '📎 Pièces jointes (optionnel) :',
      '  • Cliquez sur "Ajouter une pièce jointe"',
      '  • Formats acceptés : PDF, DOCX, XLSX, JPG, PNG',
      '  • Taille maximale : 10 Mo par fichier',
      '  • Maximum 5 pièces jointes par email',
      '',
      '👥 Destinataires :',
      'Plusieurs options disponibles :',
      '',
      '🔹 Envoyer à tous :',
      '  • Cochez "Tous les adhérents"',
      '  • L\'email sera envoyé à tous les adhérents actifs',
      '',
      '🔹 Sélection manuelle :',
      '  • Décochez "Tous les adhérents"',
      '  • Recherchez et sélectionnez les destinataires',
      '  • Vous pouvez sélectionner plusieurs adhérents',
      '',
      '🔹 Filtrage avancé :',
      '  • Par statut d\'adhésion',
      '  • Par type d\'adhésion',
      '  • Par situation de cotisation',
      '  • Par année de promotion',
      '  • Par ville ou pays',
      '  • Par participation à des événements',
      '',
      '🔍 Aperçu :',
      'Cliquez sur "Prévisualiser" pour voir le rendu final',
      'Vérifiez que les variables personnalisées s\'affichent correctement',
      '',
      '📤 Envoi :',
      'Deux options :',
      '  • Envoi immédiat : cliquez sur "Envoyer maintenant"',
      '  • Envoi programmé : choisissez date et heure, puis "Programmer l\'envoi"',
      '',
      '📊 Suivi :',
      'Après l\'envoi, vous pourrez consulter :',
      '  • Le nombre d\'emails envoyés',
      '  • Le nombre d\'emails ouverts',
      '  • Le nombre de clics sur les liens',
      '  • Les erreurs d\'envoi éventuelles',
      '',
      '💡 Conseil : Testez l\'email en l\'envoyant d\'abord à vous-même',
      '💡 Conseil : Utilisez des objets courts et accrocheurs pour améliorer le taux d\'ouverture',
      '⚠️ Important : Les emails sont envoyés depuis l\'adresse officielle de l\'association'
    ],
    actions: [
      { label: 'Gestion des emails', action: 'open_admin_emails', href: '/admin/emails' }
    ]
  },
  // ============================================================
  // GUIDE AMÉLIORÉ POUR LA BOÎTE À IDÉES (TOUT LE MONDE)
  // ============================================================
  {
    keywords: ['boîte à idées', 'boite a idees', 'ajouter idée', 'proposer idée', 'soumettre idée', 'nouvelle idée', 'idée association', 'suggestion', 'proposition'],
    title: 'Comment ajouter une idée dans la boîte à idées',
    steps: [
      '💡 La boîte à idées permet à tous les adhérents de proposer des idées pour améliorer l\'association',
      '',
      '📝 Pour ajouter une nouvelle idée :',
      'Allez dans "Idées" depuis le menu principal',
      'ou',
      'Allez dans "Mon Profil" > "Mes Idées"',
      '',
      'Cliquez sur le bouton "Proposer une idée" ou "Nouvelle idée"',
      '',
      'Remplissez le formulaire :',
      '  • Titre de votre idée (court et explicite)',
      '  • Catégorie :',
      '    - Événement : Proposition d\'événement à organiser',
      '    - Amélioration : Amélioration de l\'association ou du site',
      '    - Projet : Nouveau projet ou initiative',
      '    - Autre : Autres suggestions',
      '  • Description détaillée :',
      '    - Expliquez votre idée clairement',
      '    - Mentionnez les bénéfices pour l\'association',
      '    - Si possible, proposez un plan de mise en œuvre',
      '  • Budget estimé (optionnel)',
      '  • Échéance souhaitée (optionnel)',
      '',
      'Vous pouvez ajouter des pièces jointes :',
      '  • Documents explicatifs (PDF, DOCX)',
      '  • Images illustratives (JPG, PNG)',
      '  • Taille maximale : 5 Mo par fichier',
      '',
      'Cliquez sur "Soumettre l\'idée"',
      '',
      '📊 Après la soumission :',
      '  • Votre idée sera visible par tous les adhérents',
      '  • Les autres adhérents pourront :',
      '    - Voter pour votre idée (👍 J\'aime)',
      '    - Commenter et enrichir votre proposition',
      '    - Proposer des améliorations',
      '  • Les administrateurs examineront les idées populaires',
      '  • Vous serez notifié de l\'évolution de votre idée',
      '',
      '🏆 Statuts possibles de votre idée :',
      '  • En attente : L\'idée vient d\'être soumise',
      '  • En examen : Les administrateurs étudient l\'idée',
      '  • Approuvée : L\'idée est retenue et sera mise en œuvre',
      '  • En cours : L\'idée est en cours de réalisation',
      '  • Réalisée : L\'idée a été mise en œuvre avec succès',
      '  • Rejetée : L\'idée n\'a pas été retenue (avec explication)',
      '',
      '✨ Vous pouvez suivre toutes vos idées dans "Mon Profil" > "Mes Idées"',
      '',
      '💡 Conseil : Plus votre idée est détaillée et concrète, plus elle a de chances d\'être retenue',
      '💡 Conseil : N\'hésitez pas à proposer des idées innovantes, même audacieuses !'
    ],
    actions: [
      { label: 'Voir la boîte à idées', action: 'open_idees', href: '/idees' },
      { label: 'Mes idées', action: 'open_mes_idees', href: '/user/profile?section=idees' }
    ]
  }
];

/**
 * Normalise une chaîne pour la comparaison (supprime accents, ponctuation, etc.)
 */
function normalizeString(str: string): string {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprime les accents
    .replace(/[^\w\s]/g, ' ') // Remplace la ponctuation par des espaces
    .replace(/\s+/g, ' ') // Normalise les espaces
    .trim();
}

/**
 * Calcule la distance de Levenshtein entre deux chaînes (pour la détection de fautes)
 */
function levenshteinDistance(str1: string, str2: string): number {
  const matrix: number[][] = [];
  const len1 = str1.length;
  const len2 = str2.length;

  if (len1 === 0) return len2;
  if (len2 === 0) return len1;

  for (let i = 0; i <= len1; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= len2; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= len1; i++) {
    for (let j = 1; j <= len2; j++) {
      if (str1[i - 1] === str2[j - 1]) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j - 1] + 1
        );
      }
    }
  }

  return matrix[len1][len2];
}

/**
 * Vérifie si deux mots sont similaires (tolérance aux fautes)
 */
function isSimilar(word1: string, word2: string, threshold: number = 2): boolean {
  const normalized1 = normalizeString(word1);
  const normalized2 = normalizeString(word2);
  
  if (normalized1 === normalized2) return true;
  if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) return true;
  
  const distance = levenshteinDistance(normalized1, normalized2);
  const maxLen = Math.max(normalized1.length, normalized2.length);
  
  // Si la distance est faible par rapport à la longueur, considérer comme similaire
  return distance <= threshold && distance / maxLen < 0.3;
}

/**
 * Trouve le guide correspondant à une question avec amélioration de la détection
 */
export function findGuideForQuestion(question: string): Guide | null {
  const questionLower = normalizeString(question);
  
  // Si la question est vide, retourner null
  if (!questionLower) {
    return null;
  }
  
  // Mots de la question
  const questionWords = questionLower.split(' ').filter(w => w.length > 2);
  
  // Chercher le guide avec le plus de mots-clés correspondants
  let bestMatch: Guide | null = null;
  let bestScore = 0;
  
  for (const guide of chatbotGuides) {
    let score = 0;
    let exactMatches = 0;
    let partialMatches = 0;
    
    for (const keyword of guide.keywords) {
      const keywordLower = normalizeString(keyword);
      const keywordWords = keywordLower.split(' ');
      
      // Vérifier correspondance exacte
      if (questionLower.includes(keywordLower) || keywordLower.includes(questionLower)) {
        score += 3;
        exactMatches++;
        // Bonus si le mot-clé est au début de la question
        if (questionLower.startsWith(keywordLower)) {
          score += 2;
        }
      } else {
        // Vérifier correspondance partielle (mots individuels)
        for (const keywordWord of keywordWords) {
          if (keywordWord.length > 2) {
            for (const questionWord of questionWords) {
              if (questionWord.includes(keywordWord) || keywordWord.includes(questionWord)) {
                score += 1;
                partialMatches++;
              } else if (isSimilar(questionWord, keywordWord)) {
                score += 0.5;
                partialMatches++;
              }
            }
          }
        }
      }
    }
    
    // Bonus si plusieurs mots-clés correspondent
    if (exactMatches > 1) {
      score += exactMatches;
    }
    
    if (score > bestScore) {
      bestScore = score;
      bestMatch = guide;
    }
  }
  
  // Si aucun match n'a été trouvé avec un score > 0, retourner le guide d'aide par défaut
  if (bestScore === 0) {
    // Chercher le guide d'aide
    return chatbotGuides.find(g => g.keywords.includes('aide')) || null;
  }
  
  return bestMatch;
}

/**
 * Génère une réponse du bot basée sur une question
 */
export function generateBotResponse(question: string): { message: string; guide?: Guide } {
  // Validation de type pour éviter les erreurs
  if (typeof question !== 'string' || !question || !question.trim()) {
    return {
      message: `Bonjour ! Je suis Amaki, votre assistant virtuel. Posez-moi une question et je vous guiderai étape par étape !\n\n👤 Pour tous les adhérents :\n• Modifier votre mot de passe\n• Payer vos cotisations\n• Modifier votre photo de profil\n• Modifier votre profil\n• Imprimer votre passeport\n• Voir vos obligations\n• Voir vos droits\n• Consulter le règlement d'ordre intérieur\n• Accéder à vos documents\n• Téléverser un document\n• Voir vos badges\n• Postuler à une élection\n• Voter\n• Participer à un événement\n• Consulter les rapports de réunion\n• Gérer vos notifications\n• Utiliser la messagerie interne\n• Commenter ou documenter l'avancement de vos tâches\n• Ajouter une idée dans la boîte à idées\n• Consulter la galerie\n• Contacter l'association\n\n👨‍💼 Pour les administrateurs :\n• Encaisser une cotisation manuelle\n• Créer la cotisation mensuelle\n• Ajouter ou créer une assistance\n• Créer un événement\n• Créer un projet\n• Ajouter une tâche à un projet\n• Affecter une tâche à un adhérent\n• Créer et ajouter une photo ou vidéo dans la galerie\n• Envoyer une notification\n• Envoyer un email aux adhérents\n• Créer et gérer une dépense\n• Gérer les types de dépenses`
    };
  }
  
  const guide = findGuideForQuestion(question);
  
  if (guide) {
    const message = `Voici comment ${guide.title.toLowerCase()} :\n\n${guide.steps.map((step, index) => {
      // Ne pas numéroter les lignes vides
      if (step.trim() === '') return '\n';
      return `${index + 1}. ${step}`;
    }).join('\n\n')}\n\nN'hésitez pas si vous avez d'autres questions !`;
    return { message, guide };
  }
  
  // Réponse par défaut avec suggestions
  return {
    message: `Je n'ai pas trouvé de guide spécifique pour votre question "${question}". Mais ne vous inquiétez pas, je suis là pour vous aider !\n\n👤 Pour tous les adhérents :\n• Modifier votre mot de passe\n• Payer vos cotisations\n• Modifier votre photo de profil\n• Modifier votre profil\n• Imprimer votre passeport\n• Voir vos obligations\n• Voir vos droits\n• Consulter le règlement d'ordre intérieur\n• Accéder à vos documents\n• Téléverser un document\n• Voir vos badges\n• Postuler à une élection\n• Voter\n• Participer à un événement\n• Consulter les rapports de réunion\n• Gérer vos notifications\n• Utiliser la messagerie interne\n• Commenter ou documenter l'avancement de vos tâches\n• Ajouter une idée dans la boîte à idées\n• Consulter la galerie\n• Contacter l'association\n\n👨‍💼 Pour les administrateurs :\n• Encaisser une cotisation manuelle\n• Créer la cotisation mensuelle\n• Ajouter ou créer une assistance\n• Créer un événement\n• Créer un projet\n• Ajouter une tâche à un projet\n• Affecter une tâche à un adhérent\n• Créer et ajouter une photo ou vidéo dans la galerie\n• Envoyer une notification\n• Envoyer un email aux adhérents\n• Créer et gérer une dépense\n• Gérer les types de dépenses\n\nPosez-moi une question plus précise en utilisant des mots-clés et je vous guiderai étape par étape !`
  };
}

/**
 * Messages de bienvenue
 */
export const welcomeMessages = [
  "Bonjour ! Je suis Amaki, votre assistant virtuel. Je suis là pour vous aider à naviguer sur la plateforme. Comment puis-je vous assister aujourd'hui ?",
  "Salut ! Moi c'est Amaki. Je suis là pour vous guider dans l'utilisation de la plateforme AMAKI France. Que souhaitez-vous faire ?",
  "Bonjour ! Je suis Amaki, votre assistant. Posez-moi une question et je vous expliquerai comment procéder étape par étape.",
  "Bonjour ! Amaki à votre service. Je peux vous aider avec toutes vos questions sur la plateforme. Que puis-je faire pour vous ?"
];

/**
 * Messages d'aide rapide
 */
export const quickHelpMessages = [
  "Voici quelques actions que je peux vous aider à réaliser :",
  "Je peux vous guider pour :",
  "Voici ce que je peux vous expliquer :"
];

/**
 * Suggestions de questions rapides
 */
export const quickQuestions = [
  "Comment payer ma cotisation ?",
  "Comment modifier mon mot de passe ?",
  "Comment modifier ma photo ?",
  "Comment voir mes documents ?",
  "Comment voir mes obligations ?",
  "Comment voir mes droits ?",
  "Comment consulter le règlement ?",
  "Comment participer à un événement ?",
  "Comment consulter les rapports ?",
  "Comment ajouter une idée ?",
  "Comment modifier mon profil ?",
  "Comment utiliser la messagerie ?",
  "Comment voir mes notifications ?",
  "Comment commenter ma tâche ?",
  "[ADMIN] Comment encaisser une cotisation ?",
  "[ADMIN] Comment créer la cotisation mensuelle ?",
  "[ADMIN] Comment créer un événement ?",
  "[ADMIN] Comment créer un projet ?",
  "[ADMIN] Comment ajouter une tâche ?",
  "[ADMIN] Comment affecter une tâche ?",
  "[ADMIN] Comment ajouter une photo dans la galerie ?",
  "[ADMIN] Comment envoyer une notification ?",
  "[ADMIN] Comment créer une dépense ?",
  "[ADMIN] Comment gérer les types de dépenses ?"
];
