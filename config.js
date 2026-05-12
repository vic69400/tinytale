/**
 * ╔══════════════════════════════════════════════════╗
 * ║         TINYTALE — GUIDE D'ACTIVATION APIs       ║
 * ╠══════════════════════════════════════════════════╣
 * ║ ÉTAPE 1 — Firebase (Auth + Bibliothèque)         ║
 * ║   → console.firebase.google.com                  ║
 * ║   → Remplace la section FIREBASE ci-dessous      ║
 * ║   → Déjà configuré ✅                            ║
 * ╠══════════════════════════════════════════════════╣
 * ║ ÉTAPE 2 — Claude API (Génération histoires)      ║
 * ║   → console.anthropic.com → API Keys             ║
 * ║   → Remplace ANTHROPIC.API_KEY                   ║
 * ║   → Décommenter BLOC B dans create.html          ║
 * ╠══════════════════════════════════════════════════╣
 * ║ ÉTAPE 3 — ElevenLabs (Voix clonée)               ║
 * ║   → elevenlabs.io → Profile → API Key            ║
 * ║   → Remplace ELEVENLABS.API_KEY                  ║
 * ║   → Décommenter BLOC C dans create.html          ║
 * ╠══════════════════════════════════════════════════╣
 * ║ ÉTAPE 4 — Leonardo AI (Illustrations)            ║
 * ║   → app.leonardo.ai → API Access                 ║
 * ║   → Remplace LEONARDO.API_KEY                    ║
 * ║   → Décommenter BLOC D dans create.html          ║
 * ╠══════════════════════════════════════════════════╣
 * ║ ÉTAPE 5 — Stripe (Paiements)                     ║
 * ║   → dashboard.stripe.com → API Keys              ║
 * ║   → Remplace STRIPE.PUBLIC_KEY + PRICE_IDs       ║
 * ║   → Décommenter BLOC A dans create.html          ║
 * ║   → Mettre APP.MODE_TEST = false en production   ║
 * ╠══════════════════════════════════════════════════╣
 * ║ ÉTAPE 6 — EmailJS (Envoi emails)                 ║
 * ║   → dashboard.emailjs.com                        ║
 * ║   → Remplace EMAILJS.SERVICE_ID etc.             ║
 * ║   → Décommenter BLOC E dans create.html          ║
 * ╚══════════════════════════════════════════════════╝
 *
 * TinyTale.org — Fichier de configuration central   // ✅ AMÉLIORATION 10
 * Remplissez vos clés API ici une seule fois.
 * Ne commitez jamais ce fichier avec de vraies clés dans un dépôt public.
 */

const TINYTALE_CONFIG = {

  // ─────────────────────────────────────────────
  // ANTHROPIC (génération des histoires)
  // Clé API : https://console.anthropic.com/settings/keys
  // ─────────────────────────────────────────────
  ANTHROPIC: {
    API_KEY: "sk-ant-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",

    // Modèle recommandé pour la génération narrative
    // Liste complète : https://docs.anthropic.com/en/docs/about-claude/models
    MODEL: "claude-opus-4-5", // ✅ FIX BUG 8

    // Nombre maximum de tokens générés par histoire (2 000 ≈ ~1 500 mots)
    MAX_TOKENS: 2000,

    // Template du prompt envoyé à Claude pour chaque histoire
    // Variables disponibles : {prenom}, {age}, {theme}, {langue}
    PROMPT_TEMPLATE: `Tu es un auteur de contes pour enfants bienveillant et créatif.
Écris une histoire courte et enchantée pour un enfant prénommé {prenom}, âgé de {age} ans.
Le thème principal est : {theme}.
L'histoire doit être positive, adaptée à l'âge, et se terminer avec une belle morale.
Langue : {langue}.`,
  },

  // ─────────────────────────────────────────────
  // ELEVENLABS (narration audio de l'histoire)
  // Clé API : https://elevenlabs.io/app/settings/api-keys
  // ─────────────────────────────────────────────
  ELEVENLABS: {
    API_KEY: "el_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",

    // ID du modèle TTS. Modèles disponibles :
    // "eleven_multilingual_v2"  → multilingue, meilleure qualité
    // "eleven_turbo_v2_5"       → rapide et moins coûteux
    // Liste : https://api.elevenlabs.io/v1/models
    MODEL_ID: "eleven_multilingual_v2",

    // Paramètres de la voix narratrice
    VOICE_SETTINGS: {
      // ID de la voix choisie
      // Bibliothèque : https://elevenlabs.io/voice-library
      VOICE_ID: "21m00Tcm4TlvDq8ikWAM",  // "Rachel" par défaut (douce, naturelle)

      // Stabilité de la voix (0.0 → plus expressive, 1.0 → plus stable)
      STABILITY: 0.5,

      // Clarté et ressemblance avec la voix originale (0.0 à 1.0)
      SIMILARITY_BOOST: 0.75,

      // Intensité du style expressif (0.0 = neutre, 1.0 = très expressif)
      STYLE: 0.3,

      // Amélioration de la qualité grâce au speaker boost (léger surcoût CPU)
      USE_SPEAKER_BOOST: true,
    },
  },

  // ─────────────────────────────────────────────
  // LEONARDO AI (illustration de l'histoire)
  // Clé API : https://app.leonardo.ai/settings/api-keys
  // ─────────────────────────────────────────────
  LEONARDO: {
    API_KEY: "leo_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",

    // ID du modèle d'illustration
    // Modèles disponibles : https://docs.leonardo.ai/reference/getplatformmodels
    // "b24e16ff-06e3-43eb-8d33-4416c2d75876" → Leonardo Diffusion XL (illustrations)
    // "ac614f96-1082-45bf-be9d-757f2d31c174" → DreamShaper v7 (style conte)
    MODEL_ID: "ac614f96-1082-45bf-be9d-757f2d31c174",

    // Nombre d'illustrations générées par histoire
    NUM_IMAGES: 1,

    // Dimensions de l'image (en pixels) — doit respecter les ratios supportés
    WIDTH: 1024,
    HEIGHT: 768,

    // Suffixe de style ajouté automatiquement à chaque prompt d'illustration
    // Définit l'esthétique visuelle globale de TinyTale
    PROMPT_STYLE: "children's book illustration, soft watercolor, warm colors, whimsical, gentle, magical atmosphere, safe for kids",
  },

  // ─────────────────────────────────────────────
  // STRIPE (paiements et abonnements)
  // Clé publique : https://dashboard.stripe.com/apikeys
  // ─────────────────────────────────────────────
  STRIPE: {
    // Clé publique (pk_live_... en production, pk_test_... en test)
    // NE JAMAIS utiliser la clé secrète ici (côté client uniquement)
    PUBLIC_KEY: "pk_test_XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",

    // Identifiants des produits/prix Stripe
    // Trouvez-les dans : Dashboard Stripe → Produits → sélectionner → copier "Price ID"
    PRODUCTS: {
      HISTOIRE_UNIQUE: {
        // Prix unique, sans abonnement
        PRICE_ID: "price_XXXXXXXXXXXXXXXXXXXXXXXX",
        LABEL: "Histoire unique",
        AMOUNT: 2.99,
        CURRENCY: "eur",
      },
      FAMILLE: {
        // Abonnement mensuel famille
        PRICE_ID: "price_XXXXXXXXXXXXXXXXXXXXXXXX",
        LABEL: "Abonnement Famille",
        AMOUNT: 9.99,
        CURRENCY: "eur",
        INTERVAL: "month",
      },
      PREMIUM: {
        // Abonnement mensuel premium (histoires illimitées + fonctionnalités avancées)
        PRICE_ID: "price_XXXXXXXXXXXXXXXXXXXXXXXX",
        LABEL: "Abonnement Premium",
        AMOUNT: 19.99,
        CURRENCY: "eur",
        INTERVAL: "month",
      },
    },
  },

  // ─────────────────────────────────────────────
  // EMAILJS (envoi d'e-mails depuis le navigateur)
  // Configuration : https://dashboard.emailjs.com
  // ─────────────────────────────────────────────
  EMAILJS: {
    // ID du service e-mail configuré (ex: Gmail, SendGrid, Mailgun...)
    // Dashboard → Email Services → copier le "Service ID"
    SERVICE_ID: "service_XXXXXXXX",

    // ID du template d'e-mail utilisé pour les envois
    // Dashboard → Email Templates → copier le "Template ID"
    TEMPLATE_ID: "template_XXXXXXXX",

    // Clé publique de votre compte EmailJS
    // Dashboard → Account → API Keys → "Public Key"
    PUBLIC_KEY: "XXXXXXXXXXXXXXXXXXXXXXXX",
  },

  // ─────────────────────────────────────────────
  // APP — Paramètres généraux de l'application
  // ─────────────────────────────────────────────
  APP: {
    NAME: "TinyTale",
    URL: "https://tinytale.org",
    EMAIL: "contact@tinytale.org",

    // Si true, chaque nouvel utilisateur reçoit sa première histoire gratuitement
    PREMIERE_HISTOIRE_GRATUITE: true,

    // MODE_TEST : true  → clés Stripe test, logs verbeux, pas de vrais débits
    //             false → production (passer à false avant le lancement !)
    MODE_TEST: true,
  },

  // ─────────────────────────────────────────────
  // FIREBASE — Auth + Stockage histoires
  // Obtenir : https://console.firebase.google.com
  // Crée un projet → Ajoute une app Web → Copie la config
  // ─────────────────────────────────────────────
  FIREBASE: {
    API_KEY:             "AIzaSyCl4DaUOML2JqXcfOzpM5TobnLGBjFCasg",
    AUTH_DOMAIN:         "tinytale-4203f.firebaseapp.com",
    DATABASE_URL:        "https://tinytale-4203f-default-rtdb.europe-west1.firebasedatabase.app",
    PROJECT_ID:          "tinytale-4203f",
    STORAGE_BUCKET:      "tinytale-4203f.firebasestorage.app",
    MESSAGING_SENDER_ID: "35404819260",
    APP_ID:              "1:35404819260:web:5589de686180161dc78c39",
    MEASUREMENT_ID:      "G-Q5K5DB575X",
  },

};

// Export pour utilisation en module ES6 ou Node.js
if (typeof module !== "undefined" && module.exports) {
  module.exports = TINYTALE_CONFIG;
}
