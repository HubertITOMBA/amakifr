import { Heart, Users, Award, BookOpen, Handshake, Lightbulb } from "lucide-react";

export function ValuesSection() {
  const values = [
    {
      icon: Heart,
      title: "Solidarité",
      description: "Nous nous soutenons mutuellement dans nos projets personnels et professionnels, créant un réseau d'entraide solide.",
      color: "text-red-500",
      bgColor: "bg-red-50 dark:bg-red-900/20"
    },
    {
      icon: Users,
      title: "Intégration",
      description: "Nous facilitons l'intégration de nos membres sur le territoire français .",
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
    },
    {
      icon: Award,
      title: "Respect",
      description: "Nous cultivons un environnement de respect mutuel, d'écoute et de tolérance.",
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
    },
    {
      icon: Award,
      title: "Entraide",
      description: "L'entraide est au cœur de notre mission. Nous nous soutenons mutuellement dans les moments difficiles et célébrons ensemble nos succès,créant une véritable famille d'anciens élèves.",
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
    },
    {
      icon: Award,
      title: "Excellence",
      description: "Nous promouvons l'excellence académique et professionnelle, encourageant nos membres à toujours viser le meilleur.",
      color: "text-yellow-500",
      bgColor: "bg-yellow-50 dark:bg-yellow-900/20"
    },
    {
      icon: Users,
      title: "Communauté",
      description: "Nous créons des liens durables entre les anciens élèves, favorisant les rencontres et les échanges.",
      color: "text-blue-500",
      bgColor: "bg-blue-50 dark:bg-blue-900/20"
    },
    {
      icon: BookOpen,
      title: "Formation",
      description: "Nous organisons des conférences, ateliers et formations pour le développement continu de nos membres.",
      color: "text-green-500",
      bgColor: "bg-green-50 dark:bg-green-900/20"
    },
    {
      icon: Handshake,
      title: "Mentorat",
      description: "Les anciens élèves accompagnent les plus jeunes dans leur parcours académique et professionnel.",
      color: "text-purple-500",
      bgColor: "bg-purple-50 dark:bg-purple-900/20"
    },
    {
      icon: Lightbulb,
      title: "Innovation",
      description: "Nous encourageons l'innovation et l'entrepreneuriat parmi nos membres, soutenant leurs projets novateurs.",
      color: "text-orange-500",
      bgColor: "bg-orange-50 dark:bg-orange-900/20"
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Nos Valeurs Fondamentales
          </h2>
          <h2 className="text-2xl font-bold text-red-900 dark:text-white mb-4">
          Intégration, Respect, Solidarité  
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
                      
            Ces valeurs guident notre action et définissent l'identité AMAKI. 
            Elles sont le socle de notre communauté et de notre engagement.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {values.map((value, index) => (
            <div
              key={index}
              className={`${value.bgColor} p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 group`}
            >
              <div className="flex items-center mb-6">
                <div className={`p-3 rounded-xl ${value.bgColor} group-hover:scale-110 transition-transform duration-300`}>
                  <value.icon className={`h-8 w-8 ${value.color}`} />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white ml-4">
                  {value.title}
                </h3>
              </div>
              <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
                {value.description}
              </p>
            </div>
          ))}
        </div>
        
        {/* Section d'appel à l'action */}
        <div className="mt-16 text-center">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl">
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Rejoignez Notre Communauté
            </h3>
            <p className="text-gray-600 dark:text-gray-300 mb-6 max-w-2xl mx-auto">
              Découvrez comment ces valeurs se traduisent concrètement dans nos actions 
              et événements. Participez à notre mission de développement communautaire.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors duration-300 shadow-lg hover:shadow-xl">
                Devenir Membre
              </button>
              <button className="px-8 py-3 border-2 border-blue-600 text-blue-600 dark:text-blue-400 rounded-lg font-semibold hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors duration-300">
                Découvrir nos Événements
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

