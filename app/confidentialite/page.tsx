"use client";

import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Lock, Eye, FileText, Mail, Calendar } from "lucide-react";
import Link from "next/link";

export default function ConfidentialitePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <DynamicNavbar />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="shadow-lg border-blue-200">
          <CardHeader className="bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-t-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8" />
              <CardTitle className="text-3xl font-bold">Politique de Confidentialité</CardTitle>
            </div>
            <p className="text-blue-100 mt-2">Dernière mise à jour : {new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </CardHeader>
          
          <CardContent className="p-6 sm:p-8 space-y-8">
            {/* Introduction */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <FileText className="h-6 w-6 text-blue-600" />
                1. Introduction
              </h2>
              <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
                L'association <strong>AMAKI France</strong> (Amicale des Anciens Élèves de Kipaku en France) 
                s'engage à protéger la confidentialité et la sécurité de vos données personnelles. 
                Cette politique de confidentialité explique comment nous collectons, utilisons, stockons 
                et protégeons vos informations personnelles lorsque vous utilisez notre site web et nos services.
              </p>
            </section>

            {/* Données collectées */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Eye className="h-6 w-6 text-blue-600" />
                2. Données que nous collectons
              </h2>
              <div className="space-y-4">
                <div>
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    2.1. Données d'identification
                  </h3>
                  <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                    <li>Nom et prénom</li>
                    <li>Adresse email</li>
                    <li>Numéro de téléphone</li>
                    <li>Date de naissance</li>
                    <li>Adresse postale</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    2.2. Données de connexion
                  </h3>
                  <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                    <li>Identifiants de connexion (email, mot de passe hashé)</li>
                    <li>Données de session et cookies</li>
                    <li>Historique de connexion</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    2.3. Données d'activité
                  </h3>
                  <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                    <li>Inscriptions aux événements</li>
                    <li>Participations aux élections et votes</li>
                    <li>Historique des paiements et cotisations</li>
                    <li>Interactions avec le site (pages visitées, actions effectuées)</li>
                  </ul>
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
                    2.4. Données provenant de services tiers
                  </h3>
                  <p className="text-slate-700 dark:text-slate-300">
                    Lorsque vous vous connectez via Google, Facebook ou Apple, nous recevons certaines 
                    informations de votre profil (nom, email, photo de profil) conformément aux paramètres 
                    de confidentialité de ces services.
                  </p>
                </div>
              </div>
            </section>

            {/* Utilisation des données */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Lock className="h-6 w-6 text-blue-600" />
                3. Utilisation de vos données
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Nous utilisons vos données personnelles pour les finalités suivantes :
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                <li>Gérer votre compte et votre adhésion à l'association</li>
                <li>Vous permettre de participer aux événements et activités de l'association</li>
                <li>Gérer les élections et les votes</li>
                <li>Traiter les paiements et cotisations</li>
                <li>Vous envoyer des communications importantes concernant l'association</li>
                <li>Améliorer nos services et votre expérience utilisateur</li>
                <li>Respecter nos obligations légales et réglementaires</li>
                <li>Assurer la sécurité de notre site et prévenir la fraude</li>
              </ul>
            </section>

            {/* Partage des données */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                4. Partage de vos données
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Nous ne vendons jamais vos données personnelles. Nous pouvons partager vos données uniquement dans les cas suivants :
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                <li><strong>Services tiers de paiement</strong> : Stripe, PayPal pour le traitement des paiements</li>
                <li><strong>Services d'authentification</strong> : Google, Facebook, Apple pour la connexion OAuth</li>
                <li><strong>Services d'email</strong> : Resend ou SMTP pour l'envoi d'emails</li>
                <li><strong>Obligations légales</strong> : Si la loi l'exige ou en réponse à une demande judiciaire</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 mt-4">
                Tous nos prestataires sont soumis à des obligations strictes de confidentialité et de sécurité.
              </p>
            </section>

            {/* Sécurité */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                5. Sécurité de vos données
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données :
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                <li>Chiffrement des données sensibles (mots de passe hashés avec bcrypt)</li>
                <li>Connexions sécurisées (HTTPS/TLS)</li>
                <li>Authentification à deux facteurs disponible</li>
                <li>Accès restreint aux données personnelles</li>
                <li>Sauvegardes régulières et sécurisées</li>
                <li>Surveillance et détection des intrusions</li>
              </ul>
            </section>

            {/* Vos droits */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                6. Vos droits
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                <li><strong>Droit d'accès</strong> : Vous pouvez demander une copie de vos données personnelles</li>
                <li><strong>Droit de rectification</strong> : Vous pouvez corriger vos données inexactes</li>
                <li><strong>Droit à l'effacement</strong> : Vous pouvez demander la suppression de vos données</li>
                <li><strong>Droit à la portabilité</strong> : Vous pouvez récupérer vos données dans un format structuré</li>
                <li><strong>Droit d'opposition</strong> : Vous pouvez vous opposer au traitement de vos données</li>
                <li><strong>Droit à la limitation</strong> : Vous pouvez demander la limitation du traitement</li>
              </ul>
              <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-slate-700 dark:text-slate-300 mb-2">
                  <strong>Pour exercer vos droits</strong>, vous pouvez :
                </p>
                <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-1 ml-4">
                  <li>Utiliser notre <Link href="/suppression-donnees" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">formulaire de demande de suppression des données</Link></li>
                  <li>Nous contacter par email à <a href="mailto:asso.amaki@gmail.com" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">asso.amaki@gmail.com</a></li>
                </ul>
              </div>
            </section>

            {/* Cookies */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                7. Cookies et technologies similaires
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Nous utilisons des cookies et technologies similaires pour :
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                <li>Maintenir votre session de connexion</li>
                <li>Mémoriser vos préférences</li>
                <li>Améliorer la sécurité et prévenir la fraude</li>
                <li>Analyser l'utilisation du site (de manière anonyme)</li>
              </ul>
              <p className="text-slate-700 dark:text-slate-300 mt-4">
                Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur.
              </p>
            </section>

            {/* Conservation */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Calendar className="h-6 w-6 text-blue-600" />
                8. Durée de conservation
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Nous conservons vos données personnelles :
              </p>
              <ul className="list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-4">
                <li><strong>Données de compte</strong> : Tant que votre compte est actif, puis 3 ans après la dernière activité</li>
                <li><strong>Données financières</strong> : 10 ans conformément aux obligations comptables</li>
                <li><strong>Données d'élections</strong> : Indéfiniment pour l'historique et la transparence</li>
                <li><strong>Logs de sécurité</strong> : 1 an</li>
              </ul>
            </section>

            {/* Modifications */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4">
                9. Modifications de cette politique
              </h2>
              <p className="text-slate-700 dark:text-slate-300">
                Nous pouvons mettre à jour cette politique de confidentialité de temps à autre. 
                Toute modification sera publiée sur cette page avec une nouvelle date de mise à jour. 
                Nous vous encourageons à consulter régulièrement cette page pour rester informé de 
                la manière dont nous protégeons vos données.
              </p>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-4 flex items-center gap-2">
                <Mail className="h-6 w-6 text-blue-600" />
                10. Contact
              </h2>
              <p className="text-slate-700 dark:text-slate-300 mb-4">
                Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits, 
                vous pouvez nous contacter :
              </p>
              <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-slate-900 dark:text-slate-100 font-semibold mb-2">AMAKI France</p>
                <p className="text-slate-700 dark:text-slate-300">119 rue des Grands Champs</p>
                <p className="text-slate-700 dark:text-slate-300">77000 Lieusaint, France</p>
                <p className="text-slate-700 dark:text-slate-300 mt-2">
                  Email : <a href="mailto:asso.amaki@gmail.com" className="text-blue-600 dark:text-blue-400 hover:underline">asso.amaki@gmail.com</a>
                </p>
                <p className="text-slate-700 dark:text-slate-300">
                  Téléphone : <a href="tel:+33751066264" className="text-blue-600 dark:text-blue-400 hover:underline">+33 7 51 06 62 64</a>
                </p>
              </div>
            </section>
          </CardContent>
        </Card>
      </div>

      <Footer />
    </div>
  );
}

