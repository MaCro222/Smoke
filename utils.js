// Utility Functions

/**
 * Generate a unique device fingerprint
 * Combines multiple device characteristics for identification
 */
async function generateDeviceFingerprint() {
    const components = [];
    
    // Browser information
    components.push(navigator.userAgent);
    components.push(navigator.language);
    components.push(navigator.hardwareConcurrency || 'unknown');
    components.push(navigator.platform);
    components.push(screen.width + 'x' + screen.height);
    components.push(screen.colorDepth);
    components.push(new Date().getTimezoneOffset());
    
    // Canvas fingerprinting (basic implementation)
    try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        ctx.textBaseline = 'top';
        ctx.font = '14px Arial';
        ctx.fillStyle = '#f60';
        ctx.fillRect(0, 0, 140, 20);
        ctx.fillStyle = '#069';
        ctx.fillText('AutoMap Fingerprint', 2, 2);
        components.push(canvas.toDataURL());
    } catch (e) {
        components.push('canvas-error');
    }
    
    // Combine all components
    const fingerprint = components.join('|');
    
    // Hash the fingerprint using SHA-256
    const hash = await hashString(fingerprint);
    return hash.substring(0, 16); // Use first 16 chars
}

/**
 * Hash a string using SHA-256
 */
async function hashString(str) {
    const encoder = new TextEncoder();
    const data = encoder.encode(str);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
}

/**
 * Calculate distance between two coordinates (Haversine formula)
 * Returns distance in meters
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Format distance for display
 */
function formatDistance(meters) {
    if (meters < 1000) {
        return Math.round(meters) + ' m';
    }
    return (meters / 1000).toFixed(1) + ' km';
}

/**
 * Format date for display
 */
function formatDate(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffMins < 1) return 'Gerade eben';
    if (diffMins < 60) return `vor ${diffMins} Min.`;
    if (diffHours < 24) return `vor ${diffHours} Std.`;
    if (diffDays < 7) return `vor ${diffDays} Tag${diffDays > 1 ? 'en' : ''}`;
    
    return date.toLocaleDateString('de-DE');
}

/**
 * Generate a unique ID
 */
function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
}

/**
 * Debounce function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

/**
 * Show toast notification
 */
function showToast(message, type = 'info', duration = 3000) {
    const container = document.getElementById('toastContainer');
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    container.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            container.removeChild(toast);
        }, 300);
    }, duration);
}

/**
 * Show loading spinner
 */
function showLoading() {
    document.getElementById('loadingSpinner').classList.add('active');
}

/**
 * Hide loading spinner
 */
function hideLoading() {
    document.getElementById('loadingSpinner').classList.remove('active');
}

/**
 * Request user location
 * iOS/Safari optimized with better error handling
 */
function getUserLocation() {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error('Geolocation nicht unterstützt'));
            return;
        }
        
        // iOS-optimierte Optionen
        const options = {
            enableHighAccuracy: true,
            timeout: 15000, // iOS braucht manchmal länger
            maximumAge: 0
        };
        
        // Fallback für iOS: Erst mit hoher Genauigkeit, dann mit niedriger
        let highAccuracyTried = false;
        
        const tryGetLocation = (useHighAccuracy) => {
            const opts = { ...options, enableHighAccuracy: useHighAccuracy };
            
            navigator.geolocation.getCurrentPosition(
                position => {
                    resolve({
                        lat: position.coords.latitude,
                        lng: position.coords.longitude,
                        accuracy: position.coords.accuracy
                    });
                },
                error => {
                    // iOS Fallback: Bei Timeout mit niedriger Genauigkeit versuchen
                    if (!highAccuracyTried && useHighAccuracy && error.code === error.TIMEOUT) {
                        console.log('High accuracy timeout, trying low accuracy...');
                        highAccuracyTried = true;
                        tryGetLocation(false);
                        return;
                    }
                    
                    let message = 'Standort konnte nicht ermittelt werden';
                    let hint = '';
                    
                    switch (error.code) {
                        case error.PERMISSION_DENIED:
                            message = 'Standortzugriff verweigert';
                            hint = '\n\niOS: Einstellungen → Safari → Standort → "Beim Verwenden erlauben"';
                            break;
                        case error.POSITION_UNAVAILABLE:
                            message = 'Standort nicht verfügbar';
                            hint = '\n\nPrüfe ob Ortungsdienste aktiviert sind';
                            break;
                        case error.TIMEOUT:
                            message = 'Standortabfrage Timeout';
                            hint = '\n\nVersuche es erneut oder gehe nach draußen für besseren GPS-Empfang';
                            break;
                    }
                    
                    reject(new Error(message + hint));
                },
                opts
            );
        };
        
        // Starte mit hoher Genauigkeit
        tryGetLocation(true);
    });
}

/**
 * Validate coordinates
 */
function isValidCoordinate(lat, lng) {
    return !isNaN(lat) && !isNaN(lng) && 
           lat >= -90 && lat <= 90 && 
           lng >= -180 && lng <= 180;
}

/**
 * Check if two locations are close enough to be considered the same
 */
function areLocationsNearby(lat1, lng1, lat2, lng2, maxDistance = 50) {
    const distance = calculateDistance(lat1, lng1, lat2, lng2);
    return distance <= maxDistance;
}

/**
 * Group tags by location proximity
 */
function groupTagsByLocation(tags, maxDistance = 50) {
    const groups = [];
    
    tags.forEach(tag => {
        let foundGroup = false;
        
        for (let group of groups) {
            const representative = group[0];
            if (areLocationsNearby(
                tag.lat, tag.lng,
                representative.lat, representative.lng,
                maxDistance
            )) {
                group.push(tag);
                foundGroup = true;
                break;
            }
        }
        
        if (!foundGroup) {
            groups.push([tag]);
        }
    });
    
    return groups;
}

/**
 * Get unique device IDs from a group of tags
 */
function getUniqueDeviceIds(tags) {
    return [...new Set(tags.map(tag => tag.deviceId))];
}

/**
 * Check if machine should be validated based on tags
 */
function shouldValidateMachine(tags) {
    const uniqueDevices = getUniqueDeviceIds(tags);
    return uniqueDevices.length >= CONFIG.MIN_TAGS_FOR_VALIDATION;
}

/**
 * Copy text to clipboard
 */
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast('In Zwischenablage kopiert', 'success');
    } catch (err) {
        // Fallback for older browsers
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
            document.execCommand('copy');
            showToast('In Zwischenablage kopiert', 'success');
        } catch (err) {
            showToast('Kopieren fehlgeschlagen', 'error');
        }
        document.body.removeChild(textarea);
    }
}

/**
 * Format coordinates for display
 */
function formatCoordinates(lat, lng) {
    return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/**
 * Parse query parameters from URL
 */
function getQueryParams() {
    const params = {};
    const queryString = window.location.search.substring(1);
    const pairs = queryString.split('&');
    
    for (let pair of pairs) {
        const [key, value] = pair.split('=');
        if (key) {
            params[decodeURIComponent(key)] = decodeURIComponent(value || '');
        }
    }
    
    return params;
}

/**
 * Check if device is mobile
 */
function isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

/**
 * Request notification permission
 */
async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        return false;
    }
    
    if (Notification.permission === 'granted') {
        return true;
    }
    
    if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    }
    
    return false;
}

/**
 * Show notification
 */
function showNotification(title, options = {}) {
    if (Notification.permission === 'granted') {
        new Notification(title, {
            icon: 'icons/icon-192.png',
            badge: 'icons/icon-192.png',
            ...options
        });
    }
}
