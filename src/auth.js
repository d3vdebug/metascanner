import './auth.css';

// !!! IMPORTANT: REPLACE WITH YOUR ACTUAL FIREBASE CONFIGURATION IF NEEDED !!!
const firebaseConfig = {
    apiKey: "AIzaSyB0APY2yqEJpvm6zpA6QotwlZ-yW5-16ck", // Replace with your actual API Key
    authDomain: "imagetraceapp.firebaseapp.com",
    projectId: "imagetraceapp",
    storageBucket: "imagetraceapp.firebasestorage.app",
    messagingSenderId: "804236575302",
    appId: "1:804236575302:web:956aa0cd72b298a8620047"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// DOM elements
const userStatus = document.getElementById('userStatus');
const authForms = document.getElementById('authForms');
const loggedInControls = document.getElementById('loggedInControls');
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const signUpBtn = document.getElementById('signUpBtn');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const messageBox = document.getElementById('messageBox');
const showPasswordCheckbox = document.getElementById('showPasswordCheckbox');

/**
 * Displays a message in the message box with styling.
 * @param {string} message - The message text.
 * @param {string} type - 'info' or 'error' for styling.
 */
function showMessage(message, type = 'info') {
    clearMessage(); // Clear any existing messageBox

    // Reset classes and ensure proper default for messageBox
    messageBox.className = 'message-box'; 
    messageBox.innerHTML = ''; // Clear previous content

    if (type === 'info') {
        messageBox.classList.add('info-message');
        messageBox.innerHTML = '<div class="spinner"></div> ' + message;
    } else if (type === 'error') {
        messageBox.classList.add('error-message');
        messageBox.innerHTML = message;
    }
    messageBox.classList.remove('hidden'); // Ensure message box is visible
}

/**
 * Clears the message box.
 */
function clearMessage() {
    messageBox.classList.add('hidden');
    messageBox.innerHTML = '';
}

// Show/Hide password functionality
showPasswordCheckbox.addEventListener('click', () => {
    passwordInput.type = showPasswordCheckbox.checked ? 'text' : 'password';
});

// Firebase Authentication Event Listeners
signUpBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
        showMessage("ENTER EMAIL AND PASSWORD.", 'error');
        return;
    }
    showMessage("CREATING ACCOUNT...", 'info');
    try {
        await auth.createUserWithEmailAndPassword(email, password);
        // Redirection handled by onAuthStateChanged
    } catch (error) {
        console.error("Sign up error:", error);
        showMessage(`SIGN UP ERROR: ${error.message.toUpperCase()}`, 'error');
    }
});

signInBtn.addEventListener('click', async () => {
    const email = emailInput.value;
    const password = passwordInput.value;
    if (!email || !password) {
        showMessage("ENTER EMAIL AND PASSWORD.", 'error');
        return;
    }
    showMessage("AUTHENTICATING...", 'info');
    try {
        await auth.signInWithEmailAndPassword(email, password);
        // Redirection handled by onAuthStateChanged
    } catch (error) {
        console.error("Sign in error:", error);
        showMessage(`SIGN IN ERROR: ${error.message.toUpperCase()}`, 'error');
    }
});

signOutBtn.addEventListener('click', async () => {
    showMessage("LOGGING OUT...", 'info');
    try {
        await auth.signOut();
        // UI update handled by onAuthStateChanged
    } catch (error) {
        console.error("Sign out error:", error);
        showMessage(`LOGOUT ERROR: ${error.message.toUpperCase()}`, 'error');
    }
});

// Firebase Auth State Listener (Crucial for UI management and redirection)
auth.onAuthStateChanged((user) => {
    clearMessage(); // Clear any existing messages

    if (user) {
        // User is logged in
        userStatus.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-user-check" style="vertical-align: middle; margin-right: 5px;"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="22 7 16 13 19 16"/></svg> LOGGED IN AS: ${user.email.toUpperCase()}`;
        userStatus.style.color = '#00FF00';
        userStatus.style.textShadow = '0 0 3px #00FF00';
        authForms.classList.add('hidden');
        loggedInControls.classList.remove('hidden');
        
        // Redirect to the main application page
        window.location.href = 'index'; 
    } else {
        // User is logged out
        userStatus.innerHTML = `SECURE ACCESS REQUIRED FOR METADATA ANALYSIS`;
        userStatus.style.color = '#FF0000';
        userStatus.style.textShadow = '0 0 3px #FF0000';
        authForms.classList.remove('hidden');
        loggedInControls.classList.add('hidden');
    }
});