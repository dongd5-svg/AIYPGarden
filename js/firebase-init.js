// Firebase initialization — runs after compat SDK scripts load
firebase.initializeApp({
  apiKey:            "AIzaSyDFVgPG-oauNpgmkXWK0Wvj6z4PmyqWNY0",
  authDomain:        "aiyp-interactive-garden.firebaseapp.com",
  projectId:         "aiyp-interactive-garden",
  storageBucket:     "aiyp-interactive-garden.firebasestorage.app",
  messagingSenderId: "388306498",
  appId:             "1:388306498:web:0d3beafd58dcff93c9bfdb"
});

// Enable offline persistence so the app works without network
firebase.firestore().enablePersistence({ synchronizeTabs: true })
  .catch(err => {
    if (err.code !== 'failed-precondition' && err.code !== 'unimplemented') {
      console.warn('Firestore persistence:', err.code);
    }
  });
