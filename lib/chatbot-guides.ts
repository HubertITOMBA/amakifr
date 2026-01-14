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
      'Le passeport contient vos droits et obligations en tant qu\'adhérent'
    ],
    actions: [
      { label: 'Ouvrir mon passeport', action: 'open_passeport', href: '/user/profile?section=passeport' }
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
      { label: 'Voir mes documents', action: 'open_documents', href: '/user/profile?section=documents' }
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
      '• Comment accéder à vos documents',
      '• Comment voir vos badges',
      '• Comment postuler à une élection',
      '• Comment voter',
      '• Comment participer à un événement',
      '• Comment consulter les rapports de réunion',
      '• Comment gérer vos notifications',
      '• Comment utiliser la messagerie interne',
      '• Comment proposer une idée dans la boîte à idées',
      '• [ADMIN] Comment encaisser une cotisation manuelle',
      '• [ADMIN] Comment créer une cotisation mensuelle',
      '• [ADMIN] Comment ajouter une assistance',
      '• [ADMIN] Comment ajouter un événement',
      '• [ADMIN] Comment ajouter un élément dans la galerie',
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
    keywords: ['ajouter événement', 'créer événement', 'nouvel événement', 'organiser événement', 'admin événement', 'event', 'créer event', 'ajouter event'],
    title: '[ADMIN] Comment ajouter un événement',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Gestion des Événements"',
      'Cliquez sur le bouton "Nouvel événement" ou "Créer un événement"',
      'Remplissez le formulaire de création :',
      '',
      '📝 Informations principales :',
      '  • Titre de l\'événement',
      '  • Description détaillée',
      '  • Type d\'événement (Réunion, Fête, Formation, Sortie, etc.)',
      '  • Catégorie (Culturel, Social, Sportif, etc.)',
      '',
      '📅 Date et lieu :',
      '  • Date et heure de début',
      '  • Date et heure de fin',
      '  • Lieu (adresse complète)',
      '  • Lien Google Maps (optionnel)',
      '',
      '👥 Paramètres d\'inscription :',
      '  • Nombre de places disponibles (optionnel)',
      '  • Date limite d\'inscription',
      '  • Événement payant ou gratuit',
      '  • Si payant, définir le prix',
      '  • Autoriser les inscriptions avec accompagnants',
      '',
      '🖼️ Média :',
      '  • Téléchargez une image de couverture (recommandé)',
      '  • Format : JPG, PNG (max 5 Mo)',
      '',
      '✅ Validation :',
      'Vérifiez toutes les informations',
      'Cliquez sur "Créer l\'événement"',
      '',
      'L\'événement sera publié et visible par tous les adhérents',
      'Une notification sera envoyée à tous les adhérents',
      'Vous pourrez gérer les inscriptions dans "Gestion des inscriptions"',
      '',
      '💡 Conseil : Créez l\'événement au moins 2 semaines à l\'avance pour permettre aux adhérents de s\'organiser'
    ],
    actions: [
      { label: 'Gestion des événements', action: 'open_admin_events', href: '/admin/evenements' }
    ]
  },
  {
    keywords: ['galerie', 'ajouter photo', 'ajouter image', 'télécharger photo', 'upload photo', 'admin galerie', 'ajouter média', 'publier photo', 'uploader image'],
    title: '[ADMIN] Comment ajouter un élément dans la galerie',
    steps: [
      '📋 Cette fonction est réservée aux administrateurs',
      'Allez dans "Admin" > "Gestion de la Galerie"',
      'Cliquez sur le bouton "Ajouter des médias" ou "Télécharger"',
      '',
      '📤 Téléchargement :',
      'Vous pouvez télécharger plusieurs fichiers en même temps',
      'Cliquez sur "Choisir des fichiers" ou glissez-déposez vos fichiers',
      'Formats acceptés :',
      '  • Images : JPG, PNG, GIF, WEBP (max 10 Mo par image)',
      '  • Vidéos : MP4, WEBM (max 100 Mo par vidéo)',
      '',
      '🏷️ Informations pour chaque média :',
      '  • Titre du média',
      '  • Description (optionnel)',
      '  • Catégorie (Événement, Réunion, Fête, Divers, etc.)',
      '  • Tags pour faciliter la recherche (optionnel)',
      '  • Date de prise de vue (optionnel)',
      '  • Associer à un événement existant (optionnel)',
      '',
      '✅ Publication :',
      'Vérifiez que toutes les informations sont correctes',
      'Cochez "Publier immédiatement" ou programmez une publication',
      'Cliquez sur "Télécharger et publier"',
      '',
      'Le système va :',
      '  • Optimiser automatiquement les images',
      '  • Générer des vignettes',
      '  • Publier les médias dans la galerie',
      '',
      'Les adhérents verront les nouveaux médias dans la galerie publique',
      '',
      '💡 Conseil : Organisez vos médias par événement pour faciliter la navigation',
      '💡 Conseil : Utilisez des titres descriptifs et des tags pour améliorer la recherche'
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
      message: `Bonjour ! Je suis Amaki, votre assistant virtuel. Posez-moi une question et je vous guiderai étape par étape !\n\n👤 Pour tous les adhérents :\n• Modifier votre mot de passe\n• Payer vos cotisations\n• Modifier votre photo de profil\n• Modifier votre profil\n• Imprimer votre passeport\n• Accéder à vos documents\n• Voir vos badges\n• Postuler à une élection\n• Voter\n• Participer à un événement\n• Consulter les rapports de réunion\n• Gérer vos notifications\n• Utiliser la messagerie interne\n• Ajouter une idée dans la boîte à idées\n• Consulter la galerie\n• Contacter l'association\n\n👨‍💼 Pour les administrateurs :\n• Encaisser une cotisation manuelle\n• Créer la cotisation mensuelle\n• Ajouter ou créer une assistance\n• Ajouter un événement\n• Ajouter un élément dans la galerie\n• Envoyer une notification\n• Envoyer un email aux adhérents\n• Créer et gérer une dépense\n• Gérer les types de dépenses`
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
    message: `Je n'ai pas trouvé de guide spécifique pour votre question "${question}". Mais ne vous inquiétez pas, je suis là pour vous aider !\n\n👤 Pour tous les adhérents :\n• Modifier votre mot de passe\n• Payer vos cotisations\n• Modifier votre photo de profil\n• Modifier votre profil\n• Imprimer votre passeport\n• Accéder à vos documents\n• Voir vos badges\n• Postuler à une élection\n• Voter\n• Participer à un événement\n• Consulter les rapports de réunion\n• Gérer vos notifications\n• Utiliser la messagerie interne\n• Ajouter une idée dans la boîte à idées\n• Consulter la galerie\n• Contacter l'association\n\n👨‍💼 Pour les administrateurs :\n• Encaisser une cotisation manuelle\n• Créer la cotisation mensuelle\n• Ajouter ou créer une assistance\n• Ajouter un événement\n• Ajouter un élément dans la galerie\n• Envoyer une notification\n• Envoyer un email aux adhérents\n• Créer et gérer une dépense\n• Gérer les types de dépenses\n\nPosez-moi une question plus précise en utilisant des mots-clés et je vous guiderai étape par étape !`
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
  "Comment participer à un événement ?",
  "Comment consulter les rapports ?",
  "Comment ajouter une idée ?",
  "Comment modifier mon profil ?",
  "Comment utiliser la messagerie ?",
  "Comment voir mes notifications ?",
  "[ADMIN] Comment encaisser une cotisation ?",
  "[ADMIN] Comment créer la cotisation mensuelle ?",
  "[ADMIN] Comment ajouter un événement ?",
  "[ADMIN] Comment envoyer une notification ?",
  "[ADMIN] Comment créer une dépense ?",
  "[ADMIN] Comment gérer les types de dépenses ?"
];
