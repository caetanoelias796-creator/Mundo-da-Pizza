// Initialize Firebase Firestore globally
var db;
if (typeof firebase !== 'undefined') {
    if (!firebase.apps.length && typeof firebaseConfig !== 'undefined') {
        firebase.initializeApp(firebaseConfig);
    }
    window.db = firebase.firestore();
    db = window.db;
} else {
    console.warn("Firebase SDK compat library is not loaded.");
}
