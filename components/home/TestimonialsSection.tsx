import { Star, Quote } from "lucide-react";
import Image from "next/image";

export function TestimonialsSection() {
  const testimonials = [
    {
      id: 1,
      name: "Billy KAMBA",
      role: "Ingénieure Logiciel",
      company: "Amaki Savigny",
      graduation: "Promotion 2015",
      image: "/images/testimonial1.jpg",
      content: "L'AMAKI m'a permis de développer mon réseau professionnel et de trouver des opportunités incroyables. L'entraide entre les membres est exceptionnelle.",
      rating: 5
    },
    {
      id: 2,
      name: "Bavueza Tongi Simon",
      role: "Entrepreneur",
      company: "TechStart 91",
      graduation: "Promotion 2012",
      image: "/images/testimonial2.jpg",
      content: "Grâce aux conférences et ateliers de l'AMAKI, j'ai pu lancer ma startup avec succès. Les conseils des anciens élèves ont été déterminants.",
      rating: 5
    },
    {
      id: 3,
      name: "Miss Ekote Henriette",
      role: "Médecin",
      company: "Hôpital Central",
      graduation: "Promotion 2018",
      image: "/images/testimonial3.jpg",
      content: "L'AMAKI m'a aidée à financer mes études de médecine grâce à leur programme de bourses. Aujourd'hui, je peux aider d'autres jeunes à leur tour.",
      rating: 5
    },
    {
      id: 4,
      name: "Miss Muilu",
      role: "Directeur Marketing",
      company: "Orange 77",
      graduation: "Promotion 2010",
      image: "/images/testimonial4.jpg",
      content: "Les valeurs de solidarité et d'excellence de l'AMAKI m'ont accompagné tout au long de ma carrière. C'est une famille pour la vie.",
      rating: 5
    }
  ];

  return (
    <section className="py-20 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-800 dark:to-slate-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 dark:text-white mb-4">
            Témoignages de Nos Membres
          </h2>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
            Découvrez les histoires de réussite de nos anciens élèves et comment 
            l'AMAKI a contribué à leur parcours professionnel et personnel.
          </p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.id}
              className="bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-2 relative"
            >
              {/* Icône de citation */}
              <div className="absolute top-6 right-6">
                <Quote className="h-8 w-8 text-blue-500 opacity-20" />
              </div>
              
              {/* Étoiles de notation */}
              <div className="flex items-center mb-4">
                {[...Array(testimonial.rating)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 text-yellow-400 fill-current" />
                ))}
              </div>
              
              {/* Contenu du témoignage */}
              <p className="text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
                "{testimonial.content}"
              </p>
              
              {/* Informations sur la personne */}
              <div className="flex items-center">
                <div className="relative h-12 w-12 rounded-full overflow-hidden mr-4">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold">
                    {testimonial.name.split(' ').map(n => n[0]).join('')}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900 dark:text-white">
                    {testimonial.name}
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {testimonial.role} chez {testimonial.company}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {testimonial.graduation}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Section statistiques */}
        <div className="mt-16 bg-white dark:bg-slate-800 rounded-2xl p-8 shadow-xl">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-2">95%</div>
              <p className="text-gray-600 dark:text-gray-400">Satisfaction des membres</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400 mb-2">85%</div>
              <p className="text-gray-600 dark:text-gray-400">Taux de réussite professionnelle</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600 dark:text-purple-400 mb-2">70%</div>
              <p className="text-gray-600 dark:text-gray-400">Membres qui ont trouvé un emploi</p>
            </div>
            <div>
              <div className="text-3xl font-bold text-orange-600 dark:text-orange-400 mb-2">60%</div>
              <p className="text-gray-600 dark:text-gray-400">Membres entrepreneurs</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

