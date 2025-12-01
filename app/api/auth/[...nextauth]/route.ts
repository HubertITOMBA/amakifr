import { GET, POST } from "@/auth";

// Wrapper pour gérer les erreurs CSRF en développement
export { GET, POST } from "@/auth";

// Note: Les erreurs MissingCSRF peuvent survenir lors de déconnexions automatiques
// en développement. Ces erreurs sont généralement non bloquantes et peuvent être ignorées.