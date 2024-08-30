// src/client-admin/lib/auth.ts

const SESSION_KEY = 'auth_user';

// Function to check if the user is authenticated
export function isAuthenticated(): boolean {
  return sessionStorage.getItem(SESSION_KEY) !== null;
}

// Function to log in the user
export function login(username: string, password: string): boolean {
  // Simple authentication logic (replace with actual logic)
  if (username === 'admin' && password === 'password') {
    sessionStorage.setItem(SESSION_KEY, username);
    return true;
  }
  return false;
}

// Function to log out the user
export function logout(): void {
  sessionStorage.removeItem(SESSION_KEY);
}
