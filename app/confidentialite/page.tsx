"use client";

import { DynamicNavbar } from "@/components/home/DynamicNavbar";
import { Footer } from "@/components/home/Footer";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Shield, Lock, Eye, FileText, Mail, Calendar } from "lucide-react";
import Link from "next/link";

const pageShell =
  "min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800";

const mainCard =
  "shadow-lg border-blue-200 dark:border-blue-800 overflow-hidden gap-0 rounded-xl";

const gradientHeader =
  "bg-gradient-to-r from-blue-500/90 via-blue-400/80 to-blue-500/90 dark:from-blue-700/50 dark:via-blue-600/40 dark:to-blue-700/50 text-white px-5 sm:px-6 pt-5 sm:pt-6 pb-4 sm:pb-5 rounded-t-xl";

const sectionBlock =
  "rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/40 p-4 sm:p-5 space-y-3";

const sectionTitle =
  "text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2 leading-snug";

const subSectionTitle =
  "text-base sm:text-lg font-semibold text-slate-800 dark:text-slate-200 leading-snug";

const bodyText = "text-slate-700 dark:text-slate-300 leading-relaxed text-sm sm:text-base";

const listText =
  "list-disc list-inside text-slate-700 dark:text-slate-300 space-y-2 ml-1 sm:ml-4 text-sm sm:text-base";

/**
 * Page publique — Politique de confidentialité AMAKI.
 */
export default function ConfidentialitePage() {
  return (
    <div className={pageShell}>
      <DynamicNavbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <Card className={mainCard} data-testid="confidentialite-main-card">
          <CardHeader
            className={gradientHeader}
            data-testid="confidentialite-card-header"
          >
            <div className="flex items-start gap-3">
              <Shield
                className="h-7 w-7 sm:h-8 sm:w-8 shrink-0 mt-0.5 text-white"
                aria-hidden
              />
              <div className="min-w-0 space-y-2">
                <h1 className="text-white text-2xl sm:text-3xl font-bold leading-snug">
                  Politique de Confidentialité
                </h1>
                <p className="text-blue-50 dark:text-blue-100 text-xs sm:text-sm">
                  Dernière mise à jour :{" "}
                  {new Date().toLocaleDateString("fr-FR", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </CardHeader>

          <CardContent className="px-4 sm:px-6 py-5 sm:py-7 space-y-5 sm:space-y-6 bg-white dark:bg-gray-900">
            {/* Introduction */}
            <section className={sectionBlock} aria-labelledby="intro-heading">
              <h2 id="intro-heading" className={sectionTitle}>
                <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" aria-hidden />
                1. Introduction
              </h2>
              <p className={bodyText}>
                L&apos;association <strong>AMAKI France</strong> (Amicale des Anciens Élèves de Kipaku en France)
                s&apos;engage à protéger la confidentialité et la sécurité de vos données personnelles.
                Cette politique de confidentialité explique comment nous collectons, utilisons, stockons 
                et protégeons vos informations personnelles lorsque vous utilisez notre site web et nos services.
              </p>
            </section>

            {/* Données collectées */}
            <section className={sectionBlock} aria-labelledby="data-heading">
              <h2 id="data-heading" className={sectionTitle}>
                <Eye className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" aria-hidden />
                2. Données que nous collectons
              </h2>
              <div className="space-y-4">
                <div className="space-y-2">
                  <h3 className={subSectionTitle}>
                    2.1. Données d&apos;identification
                  </h3>
                  <ul className={listText}>
                    <li>Nom et prénom</li>
                    <li>Adresse email</li>
                    <li>Numéro de téléphone</li>
                    <li>Date de naissance</li>
                    <li>Adresse postale</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className={subSectionTitle}>
                    2.2. Données de connexion
                  </h3>
                  <ul className={listText}>
                    <li>Identifiants de connexion (email, mot de passe hashé)</li>
                    <li>Données de session et cookies</li>
                    <li>Historique de connexion</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className={subSectionTitle}>
                    2.3. Données d&apos;activité
                  </h3>
                  <ul className={listText}>
                    <li>Inscriptions aux événements</li>
                    <li>Participations aux élections et votes</li>
                    <li>Historique des paiements et cotisations</li>
                    <li>Interactions avec le site (pages visitées, actions effectuées)</li>
                  </ul>
                </div>
                <div className="space-y-2">
                  <h3 className={subSectionTitle}>
                    2.4. Données provenant de services tiers
                  </h3>
                  <p className={bodyText}>
                    Lorsque vous vous connectez via Google, Facebook ou Apple, nous recevons certaines 
                    informations de votre profil (nom, email, photo de profil) conformément aux paramètres 
                    de confidentialité de ces services.
                  </p>
                </div>
              </div>
            </section>

            {/* Utilisation des données */}
            <section className={sectionBlock} aria-labelledby="usage-heading">
              <h2 id="usage-heading" className={sectionTitle}>
                <Lock className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" aria-hidden />
                3. Utilisation de vos données
              </h2>
              <p className={`${bodyText} mb-1`}>
                Nous utilisons vos données personnelles pour les finalités suivantes :
              </p>
              <ul className={listText}>
                <li>Gérer votre compte et votre adhésion à l&apos;association</li>
                <li>Vous permettre de participer aux événements et activités de l&apos;association</li>
                <li>Gérer les élections et les votes</li>
                <li>Traiter les paiements et cotisations</li>
                <li>Vous envoyer des communications importantes concernant l&apos;association</li>
                <li>Améliorer nos services et votre expérience utilisateur</li>
                <li>Respecter nos obligations légales et réglementaires</li>
                <li>Assurer la sécurité de notre site et prévenir la fraude</li>
              </ul>
            </section>

            {/* Partage des données */}
            <section className={sectionBlock} aria-labelledby="share-heading">
              <h2 id="share-heading" className={sectionTitle}>
                4. Partage de vos données
              </h2>
              <p className={`${bodyText} mb-1`}>
                Nous ne vendons jamais vos données personnelles. Nous pouvons partager vos données uniquement dans les cas suivants :
              </p>
              <ul className={listText}>
                <li><strong>Services tiers de paiement</strong> : Stripe, PayPal pour le traitement des paiements</li>
                <li><strong>Services d&apos;authentification</strong> : Google, Facebook, Apple pour la connexion OAuth</li>
                <li><strong>Services d&apos;email</strong> : Resend ou SMTP pour l&apos;envoi d&apos;emails</li>
                <li><strong>Obligations légales</strong> : Si la loi l&apos;exige ou en réponse à une demande judiciaire</li>
              </ul>
              <p className={`${bodyText} mt-3`}>
                Tous nos prestataires sont soumis à des obligations strictes de confidentialité et de sécurité.
              </p>
            </section>

            {/* Sécurité */}
            <section className={sectionBlock} aria-labelledby="security-heading">
              <h2 id="security-heading" className={sectionTitle}>
                5. Sécurité de vos données
              </h2>
              <p className={`${bodyText} mb-1`}>
                Nous mettons en œuvre des mesures de sécurité techniques et organisationnelles appropriées pour protéger vos données :
              </p>
              <ul className={listText}>
                <li>Chiffrement des données sensibles (mots de passe hashés avec bcrypt)</li>
                <li>Connexions sécurisées (HTTPS/TLS)</li>
                <li>Authentification à deux facteurs disponible</li>
                <li>Accès restreint aux données personnelles</li>
                <li>Sauvegardes régulières et sécurisées</li>
                <li>Surveillance et détection des intrusions</li>
              </ul>
            </section>

            {/* Vos droits */}
            <section className={sectionBlock} aria-labelledby="rights-heading">
              <h2 id="rights-heading" className={sectionTitle}>
                6. Vos droits
              </h2>
              <p className={`${bodyText} mb-1`}>
                Conformément au Règlement Général sur la Protection des Données (RGPD), vous disposez des droits suivants :
              </p>
              <ul className={listText}>
                <li><strong>Droit d&apos;accès</strong> : Vous pouvez demander une copie de vos données personnelles</li>
                <li><strong>Droit de rectification</strong> : Vous pouvez corriger vos données inexactes</li>
                <li><strong>Droit à l&apos;effacement</strong> : Vous pouvez demander la suppression de vos données</li>
                <li><strong>Droit à la portabilité</strong> : Vous pouvez récupérer vos données dans un format structuré</li>
                <li><strong>Droit d&apos;opposition</strong> : Vous pouvez vous opposer au traitement de vos données</li>
                <li><strong>Droit à la limitation</strong> : Vous pouvez demander la limitation du traitement</li>
              </ul>
              <div className="mt-4 p-3 sm:p-4 bg-blue-50/80 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className={`${bodyText} mb-2`}>
                  <strong>Pour exercer vos droits</strong> (y compris depuis l&apos;application mobile AMAKI / Google Play), vous pouvez :
                </p>
                <ul className={listText}>
                  <li>
                    Utiliser notre{" "}
                    <Link
                      href="/suppression-donnees"
                      className="text-blue-600 dark:text-blue-400 hover:underline font-semibold"
                    >
                      page publique de demande de suppression des données
                    </Link>{" "}
                    <span className="text-slate-600 dark:text-slate-400">
                      (https://www.amaki.fr/suppression-donnees)
                    </span>
                  </li>
                  <li>Nous contacter par email à <a href="mailto:contact@amaki.fr" className="text-blue-600 dark:text-blue-400 hover:underline font-semibold">contact@amaki.fr</a></li>
                </ul>
              </div>
            </section>

            {/* Cookies */}
            <section className={sectionBlock} aria-labelledby="cookies-heading">
              <h2 id="cookies-heading" className={sectionTitle}>
                7. Cookies et technologies similaires
              </h2>
              <p className={`${bodyText} mb-1`}>
                Nous utilisons des cookies et technologies similaires pour :
              </p>
              <ul className={listText}>
                <li>Maintenir votre session de connexion</li>
                <li>Mémoriser vos préférences</li>
                <li>Améliorer la sécurité et prévenir la fraude</li>
                <li>Analyser l&apos;utilisation du site (de manière anonyme)</li>
              </ul>
              <p className={`${bodyText} mt-3`}>
                Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur.
              </p>
            </section>

            {/* Conservation */}
            <section className={sectionBlock} aria-labelledby="retention-heading">
              <h2 id="retention-heading" className={sectionTitle}>
                <Calendar className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" aria-hidden />
                8. Durée de conservation
              </h2>
              <p className={`${bodyText} mb-1`}>
                Nous conservons vos données personnelles :
              </p>
              <ul className={listText}>
                <li><strong>Données de compte</strong> : Tant que votre compte est actif, puis 3 ans après la dernière activité</li>
                <li><strong>Données financières</strong> : 10 ans conformément aux obligations comptables</li>
                <li><strong>Données d&apos;élections</strong> : Indéfiniment pour l&apos;historique et la transparence</li>
                <li><strong>Logs de sécurité</strong> : 1 an</li>
              </ul>
            </section>

            {/* Modifications */}
            <section className={sectionBlock} aria-labelledby="changes-heading">
              <h2 id="changes-heading" className={sectionTitle}>
                9. Modifications de cette politique
              </h2>
              <p className={bodyText}>
                Nous pouvons mettre à jour cette politique de confidentialité de temps à autre. 
                Toute modification sera publiée sur cette page avec une nouvelle date de mise à jour. 
                Nous vous encourageons à consulter régulièrement cette page pour rester informé de 
                la manière dont nous protégeons vos données.
              </p>
            </section>

            {/* Contact */}
            <section className={sectionBlock} aria-labelledby="contact-heading">
              <h2 id="contact-heading" className={sectionTitle}>
                <Mail className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 shrink-0" aria-hidden />
                10. Contact
              </h2>
              <p className={`${bodyText} mb-3`}>
                Pour toute question concernant cette politique de confidentialité ou pour exercer vos droits, 
                vous pouvez nous contacter :
              </p>
              <div className="bg-white dark:bg-slate-800/80 p-4 sm:p-5 rounded-lg border border-slate-200 dark:border-slate-700">
                <p className="text-slate-900 dark:text-slate-100 font-semibold mb-2">AMAKI France</p>
                <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base">119 rue des Grands Champs</p>
                <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base">77127 Lieusaint, France</p>
                <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base mt-2">
                  Email : <a href="mailto:contact@amaki.fr" className="text-blue-600 dark:text-blue-400 hover:underline">contact@amaki.fr</a>
                </p>
                <p className="text-slate-700 dark:text-slate-300 text-sm sm:text-base">
                  Téléphone : <a href="tel:+33607034364" className="text-blue-600 dark:text-blue-400 hover:underline">+33 6 07 03 43 64</a>
                </p>
              </div>
            </section>
          </CardContent>
        </Card>
      </main>

      <Footer />
    </div>
  );
}
