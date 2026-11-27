// Мок Firebase Auth: одразу «входить» тестовим користувачем u1.
export function getAuth() { return {}; }
export function onAuthStateChanged(auth, cb) { setTimeout(() => cb({ uid: "u1", email: "test@example.com" }), 5); return () => {}; }
export class GoogleAuthProvider {}
export async function signInWithPopup() {} export async function signInWithRedirect() {} export async function signOut() {}
export async function signInWithEmailAndPassword() {} export async function createUserWithEmailAndPassword() {} export async function sendPasswordResetEmail() {}
