/**
 * @fileoverview Handles all Firebase interactions, including configuration,
 * authentication, and Firestore database operations.
 */

// --- Firebase Configuration and Initialization ---
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Export instances for direct use if needed, though functions are preferred
export const auth = firebase.auth();
export const db = firebase.firestore();


// --- Authentication Functions ---

/**
 * Sets up the authentication state listener.
 * @param {function} onAuthStateChangedCallback - The function to call when the auth state changes. It receives the user object.
 */
export function initFirebaseAuth(onAuthStateChangedCallback) {
    auth.onAuthStateChanged(onAuthStateChangedCallback);
}

/**
 * Signs the current user out.
 * @returns {Promise<void>} A promise that resolves when sign-out is complete.
 */
export async function performLogout() {
    await auth.signOut();
}


// --- Firestore (Database) Functions ---

/**
 * Loads the analysis history for a given user from Firestore.
 * @param {object} user - The Firebase user object.
 * @returns {Promise<Array>} A promise that resolves with the user's history array.
 */
export async function loadUserHistory(user) {
    if (!user) return [];
    try {
        const doc = await db.collection('userHistory').doc(user.uid).get();
        if (doc.exists) {
            // Ensure timestamps are converted to Date objects for consistency
            const history = doc.data().history || [];
            return history.map(item => ({
                ...item,
                timestamp: item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp)
            }));
        }
        return [];
    } catch (error) {
        console.error("Error fetching user history from Firestore:", error);
        throw new Error("Could not fetch user history.");
    }
}

/**
 * Saves or updates the user's history in Firestore.
 * @param {Array} historyData - The complete history array to save.
 * @returns {Promise<void>} A promise that resolves when the data is saved.
 */
export async function syncHistoryWithFirestore(historyData) {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated. Cannot sync history.");
    }

    const historyRef = db.collection('userHistory').doc(user.uid);
    try {
        await historyRef.set({ history: historyData }, { merge: true });
        console.log("History synchronized successfully with Firestore.");
    } catch (error) {
        console.error("Error syncing history with Firestore:", error);
        throw new Error("Could not sync history to the cloud.");
    }
}