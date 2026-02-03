// ⚠️ WICHTIG: ERSETZE DIESE WERTE MIT DEINEN FIREBASE-DATEN! ⚠️
// Siehe Schritt 3 im Setup-Guide

const firebaseConfig = {
    apiKey: "AIzaSyAgl5BHPfoR8LezXF2gz1evehqaqiCnL0k",
  authDomain: "smoke-85e3b.firebaseapp.com",
  projectId: "smoke-85e3b",
  storageBucket: "smoke-85e3b.firebasestorage.app",
  messagingSenderId: "768256931745",
  appId: "1:768256931745:web:2728b27586cb1ec96ffde0",
};

// Admin Password Hash (SHA-256)
//  password: ""
const ADMIN_PASSWORD_HASH = "b3b997b182d5501290e4ff8987be99054d957865ce9c1428d5ee1993264abf49";

// App Configuration
const CONFIG = {
    // Firebase aktiviert?
    useFirebase: true, // Setze auf false wenn du nur lokal speichern willst
    
    // Minimum number of independent tags needed for validation
    MIN_TAGS_FOR_VALIDATION: 5,
    
    // Minimum distance in meters between tags to be considered independent
    MIN_TAG_DISTANCE: 50,
    
    // Maximum age of a tag in days
    MAX_TAG_AGE_DAYS: 365,
    
    // Geolocation options
    geolocationOptions: {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
    },
    
    // Map default settings
    map: {
        defaultZoom: 13,
        maxZoom: 18,
        minZoom: 10,
        // Default center (wird durch User-Standort ersetzt)
        defaultCenter: [50.2333, 8.9167], // Bad Orb, Germany - ÄNDERE DAS!
        tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    
    // Firebase Sync Settings
    firebase: {
        // Sync Intervall in Millisekunden (60000 = 1 Minute)
        syncInterval: 60000,
        
        // Automatisch synchronisieren?
        autoSync: true,
        
        // Offline Persistence aktivieren?
        enablePersistence: true
    },
    
    // Feature flags
    features: {
        allowAnonymousTagging: true,
        requireEmailVerification: false,
        enableRealTimeUpdates: true, // Firebase Real-time Listener
        enableNotifications: false
    },
    
    // Storage keys
    storageKeys: {
        deviceId: 'smoke_device_id',
        userTags: 'smoke_user_tags',
        showUnvalidated: 'smoke_show_unvalidated',
        adminAuth: 'smoke_admin_auth',
        lastSync: 'smoke_last_sync'
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebaseConfig, ADMIN_PASSWORD_HASH, CONFIG };
}
