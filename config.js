// Firebase Configuration
// TODO: Replace with your actual Firebase config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Admin Password Hash (SHA-256)
// Default password: "admin123" - CHANGE THIS!
const ADMIN_PASSWORD_HASH = "240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9";

// App Configuration
const CONFIG = {
    // Minimum number of independent tags needed for validation
    MIN_TAGS_FOR_VALIDATION: 5,
    
    // Minimum distance in meters between tags to be considered independent
    MIN_TAG_DISTANCE: 50,
    
    // Maximum age of a tag in days (after this, it might need revalidation)
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
        // Default center (will be replaced by user location)
        defaultCenter: [50.2333, 8.9167], // Bad Orb, Germany
        tileLayer: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    },
    
    // Feature flags
    features: {
        allowAnonymousTagging: true,
        requireEmailVerification: false,
        enableRealTimeUpdates: false,
        enableNotifications: false
    },
    
    // Storage keys
    storageKeys: {
        deviceId: 'automap_device_id',
        userTags: 'automap_user_tags',
        showUnvalidated: 'automap_show_unvalidated',
        adminAuth: 'automap_admin_auth'
    }
};

// Export for use in other files
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { firebaseConfig, ADMIN_PASSWORD_HASH, CONFIG };
}
