import { Mail, Send, CheckCircle, Users, Calendar, MessageCircle } from "lucide-react";

export function NewsletterSection() {
  return (
    <section className="py-20 bg-gradient-to-r from-blue-600 to-purple-700">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
          {/* Contenu principal */}
          <div className="text-white">
            <h2 className="text-4xl font-bold mb-6">
              Restez Connecté avec AMAKI France
            </h2>
            <p className="text-xl mb-8 opacity-90">
              Recevez nos dernières actualités, invitations aux événements et 
              opportunités de networking directement dans votre boîte mail.
            </p>
            
            {/* Formulaire d'inscription */}
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      placeholder="Votre adresse email"
                      className="w-full pl-10 pr-4 py-3 rounded-lg border-0 text-gray-900 placeholder-gray-500 focus:ring-2 focus:ring-white/50 focus:outline-none"
                    />
                  </div>
                </div>
                <button className="px-8 py-3 bg-white text-blue-600 rounded-lg font-semibold hover:bg-gray-100 transition-colors duration-300 flex items-center justify-center">
                  <Send className="h-5 w-5 mr-2" />
                  S'abonner
                </button>
              </div>
              
              {/* Avantages de l'inscription */}
              <div className="space-y-3">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <span className="opacity-90">Invitations exclusives aux événements</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <span className="opacity-90">Opportunités de networking</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <span className="opacity-90">Actualités de l'association</span>
                </div>
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-400 mr-3" />
                  <span className="opacity-90">Conseils professionnels</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Section contact et réseaux sociaux */}
          <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8">
            <h3 className="text-2xl font-bold text-white mb-6">
              Contactez-Nous
            </h3>
            
            <div className="space-y-6">
              {/* Informations de contact */}
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="p-2 bg-white/20 rounded-lg mr-4">
                    <Mail className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">Email</p>
                    <p className="text-white/80">contact@amaki.fr</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="p-2 bg-white/20 rounded-lg mr-4">
                    <MessageCircle className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">WhatsApp</p>
                    <p className="text-white/80">+06 XX XX XX XX</p>
                  </div>
                </div>
                
                <div className="flex items-center">
                  <div className="p-2 bg-white/20 rounded-lg mr-4">
                    <Users className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold">119 rue des Grands Champs</p>
                    <p className="text-white/80">77000 Lieusaint</p>
                  </div>
                </div>
              </div>
              
              {/* Réseaux sociaux */}
              <div className="pt-6 border-t border-white/20">
                <p className="text-white font-semibold mb-4">Suivez-nous</p>
                <div className="flex space-x-4">
                  <button className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors duration-300">
                    <span className="text-white font-semibold">FB</span>
                  </button>
                  <button className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors duration-300">
                    <span className="text-white font-semibold">TW</span>
                  </button>
                  <button className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors duration-300">
                    <span className="text-white font-semibold">LI</span>
                  </button>
                  <button className="p-3 bg-white/20 rounded-lg hover:bg-white/30 transition-colors duration-300">
                    <span className="text-white font-semibold">IG</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

