// Storage Management
// Handles local storage and Firebase interaction

class StorageManager {
    constructor() {
        this.deviceId = null;
        this.localMachines = [];
        this.userTags = [];
        this.initialized = false;
    }

    /**
     * Initialize storage
     */
    async init() {
        if (this.initialized) return;
        
        // Get or create device ID
        this.deviceId = await this.getOrCreateDeviceId();
        
        // Load local data
        this.loadLocalData();
        
        // Initialize Firebase (if configured)
        // this.initFirebase();
        
        this.initialized = true;
        console.log('Storage initialized with device ID:', this.deviceId);
    }

    /**
     * Get or create device ID
     */
    async getOrCreateDeviceId() {
        let deviceId = localStorage.getItem(CONFIG.storageKeys.deviceId);
        
        if (!deviceId) {
            deviceId = await generateDeviceFingerprint();
            localStorage.setItem(CONFIG.storageKeys.deviceId, deviceId);
        }
        
        return deviceId;
    }

    /**
     * Load data from local storage
     */
    loadLocalData() {
        try {
            // Load machines
            const machinesData = localStorage.getItem('automap_machines');
            this.localMachines = machinesData ? JSON.parse(machinesData) : [];
            
            // Load user tags
            const tagsData = localStorage.getItem(CONFIG.storageKeys.userTags);
            this.userTags = tagsData ? JSON.parse(tagsData) : [];
        } catch (error) {
            console.error('Error loading local data:', error);
            this.localMachines = [];
            this.userTags = [];
        }
    }

    /**
     * Save data to local storage
     */
    saveLocalData() {
        try {
            localStorage.setItem('automap_machines', JSON.stringify(this.localMachines));
            localStorage.setItem(CONFIG.storageKeys.userTags, JSON.stringify(this.userTags));
        } catch (error) {
            console.error('Error saving local data:', error);
        }
    }

    /**
     * Add a new machine tag
     */
    async addMachineTag(lat, lng, notes = '') {
        const tag = {
            id: generateId(),
            lat,
            lng,
            deviceId: this.deviceId,
            timestamp: Date.now(),
            notes,
            validated: false
        };

        // Check if this device already tagged a nearby machine
        const nearbyTag = this.findNearbyTag(lat, lng, this.deviceId);
        if (nearbyTag) {
            throw new Error('Du hast bereits einen Automaten in der Nähe markiert');
        }

        // Find or create machine entry
        let machine = this.findMachineByLocation(lat, lng);
        
        if (machine) {
            // Add tag to existing machine
            machine.tags.push(tag);
            machine.updatedAt = Date.now();
        } else {
            // Create new machine
            machine = {
                id: generateId(),
                lat,
                lng,
                tags: [tag],
                validated: false,
                createdAt: Date.now(),
                updatedAt: Date.now()
            };
            this.localMachines.push(machine);
        }

        // Check if machine should be validated
        const uniqueDevices = getUniqueDeviceIds(machine.tags);
        if (uniqueDevices.length >= CONFIG.MIN_TAGS_FOR_VALIDATION) {
            machine.validated = true;
            machine.validatedAt = Date.now();
        }

        // Add to user's tags
        this.userTags.push({
            machineId: machine.id,
            tagId: tag.id,
            timestamp: tag.timestamp
        });

        // Save to local storage
        this.saveLocalData();

        // TODO: Sync with Firebase
        // await this.syncWithFirebase(machine);

        return machine;
    }

    /**
     * Find machine by location (within proximity)
     */
    findMachineByLocation(lat, lng) {
        return this.localMachines.find(machine => 
            areLocationsNearby(
                machine.lat, machine.lng,
                lat, lng,
                CONFIG.MIN_TAG_DISTANCE
            )
        );
    }

    /**
     * Find nearby tag by same device
     */
    findNearbyTag(lat, lng, deviceId) {
        for (let machine of this.localMachines) {
            for (let tag of machine.tags) {
                if (tag.deviceId === deviceId &&
                    areLocationsNearby(tag.lat, tag.lng, lat, lng, CONFIG.MIN_TAG_DISTANCE)) {
                    return tag;
                }
            }
        }
        return null;
    }

    /**
     * Get all machines
     */
    getAllMachines(includeUnvalidated = false) {
        if (includeUnvalidated) {
            return this.localMachines;
        }
        return this.localMachines.filter(m => m.validated);
    }

    /**
     * Get machine by ID
     */
    getMachineById(id) {
        return this.localMachines.find(m => m.id === id);
    }

    /**
     * Get unvalidated machines
     */
    getUnvalidatedMachines() {
        return this.localMachines.filter(m => !m.validated);
    }

    /**
     * Validate machine (admin function)
     */
    validateMachine(machineId) {
        const machine = this.getMachineById(machineId);
        if (machine) {
            machine.validated = true;
            machine.validatedAt = Date.now();
            machine.validatedBy = 'admin';
            this.saveLocalData();
            return true;
        }
        return false;
    }

    /**
     * Delete machine (admin function)
     */
    deleteMachine(machineId) {
        const index = this.localMachines.findIndex(m => m.id === machineId);
        if (index !== -1) {
            this.localMachines.splice(index, 1);
            
            // Remove from user tags
            this.userTags = this.userTags.filter(t => t.machineId !== machineId);
            
            this.saveLocalData();
            return true;
        }
        return false;
    }

    /**
     * Get user's tag count
     */
    getUserTagCount() {
        return this.userTags.length;
    }

    /**
     * Check if user has tagged a specific machine
     */
    hasUserTaggedMachine(machineId) {
        return this.userTags.some(t => t.machineId === machineId);
    }

    /**
     * Get statistics
     */
    getStats() {
        return {
            total: this.localMachines.length,
            validated: this.localMachines.filter(m => m.validated).length,
            pending: this.localMachines.filter(m => !m.validated).length,
            userTags: this.userTags.length
        };
    }

    /**
     * Clear all data (for testing/debugging)
     */
    clearAllData() {
        this.localMachines = [];
        this.userTags = [];
        this.saveLocalData();
        
        // Clear other local storage items
        localStorage.removeItem(CONFIG.storageKeys.showUnvalidated);
        localStorage.removeItem(CONFIG.storageKeys.adminAuth);
    }

    /**
     * Export data as JSON
     */
    exportData() {
        return {
            deviceId: this.deviceId,
            machines: this.localMachines,
            userTags: this.userTags,
            exportedAt: Date.now()
        };
    }

    /**
     * Import data from JSON
     */
    importData(data) {
        try {
            if (data.machines && Array.isArray(data.machines)) {
                this.localMachines = data.machines;
            }
            if (data.userTags && Array.isArray(data.userTags)) {
                this.userTags = data.userTags;
            }
            this.saveLocalData();
            return true;
        } catch (error) {
            console.error('Error importing data:', error);
            return false;
        }
    }

    /**
     * Initialize Firebase (placeholder)
     */
    initFirebase() {
        // TODO: Implement Firebase initialization
        // This will be used for real-time sync and multi-device support
        
        /*
        if (typeof firebase !== 'undefined') {
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.firestore();
            this.setupFirebaseListeners();
        }
        */
    }

    /**
     * Sync with Firebase (placeholder)
     */
    async syncWithFirebase(machine) {
        // TODO: Implement Firebase sync
        
        /*
        if (this.db) {
            try {
                await this.db.collection('machines').doc(machine.id).set({
                    ...machine,
                    syncedAt: firebase.firestore.FieldValue.serverTimestamp()
                }, { merge: true });
            } catch (error) {
                console.error('Firebase sync error:', error);
            }
        }
        */
    }

    /**
     * Get setting
     */
    getSetting(key, defaultValue = null) {
        const value = localStorage.getItem(key);
        if (value === null) return defaultValue;
        
        try {
            return JSON.parse(value);
        } catch {
            return value;
        }
    }

    /**
     * Set setting
     */
    setSetting(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
    }
}

// Create global storage instance
const storage = new StorageManager();
