// Guard4Campers — Google Auth Service
// Verwendet Google Identity Services (GIS) für OAuth 2.0 Token Flow
// Scope: drive.file (nicht vertraulich, keine Security-Prüfung nötig)

const CLIENT_ID = '155648938067-dc7tb40qkenu5q61sugcea1dbjcq7t5i.apps.googleusercontent.com';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
const TOKEN_KEY = 'g4c_google_token';

export interface GoogleAuthState {
  isSignedIn: boolean;
  accessToken: string | null;
  userEmail: string | null;
  expiresAt: number | null;
}

// Initiale State
export function getInitialAuthState(): GoogleAuthState {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (!stored) {
    return { isSignedIn: false, accessToken: null, userEmail: null, expiresAt: null };
  }
  try {
    const parsed = JSON.parse(stored) as GoogleAuthState;
    // Token abgelaufen?
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return { isSignedIn: false, accessToken: null, userEmail: null, expiresAt: null };
    }
    return parsed;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return { isSignedIn: false, accessToken: null, userEmail: null, expiresAt: null };
  }
}

// Google Login starten
export function signIn(callback: (state: GoogleAuthState) => void): void {
  // @ts-ignore — google.accounts wird durch das GIS-Script global bereitgestellt
  const tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CLIENT_ID,
    scope: SCOPE,
    callback: (tokenResponse: any) => {
      if (tokenResponse.error) {
        console.error('Google Auth Fehler:', tokenResponse.error);
        callback({ isSignedIn: false, accessToken: null, userEmail: null, expiresAt: null });
        return;
      }
      // E-Mail aus Token holen
      const expiresAt = Date.now() + (tokenResponse.expires_in * 1000);
      // UserInfo abrufen um E-Mail zu bekommen
      fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenResponse.access_token}` }
      })
        .then(res => res.json())
        .then(userInfo => {
          const state: GoogleAuthState = {
            isSignedIn: true,
            accessToken: tokenResponse.access_token,
            userEmail: userInfo.email || null,
            expiresAt
          };
          localStorage.setItem(TOKEN_KEY, JSON.stringify(state));
          callback(state);
        })
        .catch(() => {
          // Login hat funktioniert, aber E-Mail konnte nicht abgerufen werden
          const state: GoogleAuthState = {
            isSignedIn: true,
            accessToken: tokenResponse.access_token,
            userEmail: null,
            expiresAt
          };
          localStorage.setItem(TOKEN_KEY, JSON.stringify(state));
          callback(state);
        });
    }
  });
  tokenClient.requestAccessToken();
}

// Google Logout
export function signOut(callback: (state: GoogleAuthState) => void): void {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (stored) {
    try {
      const parsed = JSON.parse(stored);
      if (parsed.accessToken) {
        // Token bei Google widerrufen
        // @ts-ignore
        google.accounts.oauth2.revoke(parsed.accessToken, () => {});
      }
    } catch { /* ignore */ }
  }
  localStorage.removeItem(TOKEN_KEY);
  callback({ isSignedIn: false, accessToken: null, userEmail: null, expiresAt: null });
}

// Prüfen ob Token noch gültig, sonst null
export function getValidToken(): string | null {
  const stored = localStorage.getItem(TOKEN_KEY);
  if (!stored) return null;
  try {
    const parsed = JSON.parse(stored) as GoogleAuthState;
    if (parsed.expiresAt && parsed.expiresAt < Date.now()) {
      localStorage.removeItem(TOKEN_KEY);
      return null;
    }
    return parsed.accessToken;
  } catch {
    localStorage.removeItem(TOKEN_KEY);
    return null;
  }
}
