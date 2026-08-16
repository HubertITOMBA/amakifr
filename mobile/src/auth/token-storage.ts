import * as SecureStore from "expo-secure-store";

export const ACCESS_KEY = "amaki.accessToken";
export const REFRESH_KEY = "amaki.refreshToken";

/**
 * Persistance sécurisée des tokens (SecureStore uniquement).
 * Ne jamais stocker le mot de passe.
 *
 * SecureStore ne fournit PAS de transaction multi-clés.
 * Après rotation backend, l'ancien refresh est déjà révoqué :
 * on écrit donc le NOUVEAU refresh EN PREMIER, puis le nouvel access.
 * Si la 2ᵉ écriture échoue, le refresh persisté reste le nouveau (valide).
 */
export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

/**
 * Persiste la paire de tokens (ordre : refresh puis access).
 * Non transactionnel — voir commentaire module.
 */
export async function saveTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
}

export async function clearTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
}
