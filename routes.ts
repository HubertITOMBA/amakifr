/**
 * An array of routes that are accessible to the public
 * Cette route ne nécessite pas d'authentification
 * @type {string[]}
 */
export const publicRoutes = [
    "/",
    "/agenda",
    "/amicale",
    "/contact",
    "/evenements",
    "/galerie",
    "/upload",
    "/resultats",
    "/vote",
];
/**
 * Routes utilisées pour l'authentification
 * Ces routes redirigeront les utilisateurs connectés vers /settings
 * @type {string[]}
 */
export const authRoutes = [
 "/auth/sign-in",
 "/auth/sign-up",
 "/auth/error",
 "/auth/reset",
 "/auth/new-password",
 "/auth/new-verification",
"/candidatures", 
 "/elections",

  ];
  
/**
 * Le préfixe des routes d'authentification API
 * Les routes commençant par ce préfixe sont utilisées à des fins d'authentification API
 * @type {string}
 */
export const apiAuthPrefix = "/api/auth";

/**
 * The default redirect path after logging in
 * @type {string}
 */
// export const DEFAULT_LOGIN_REDIRECT = "/auth/sign-in";
export const DEFAULT_LOGIN_REDIRECT = "/";
