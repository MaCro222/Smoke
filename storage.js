// Storage Management mit Firebase Integration
// Handles local storage AND Firebase Cloud Sync

class StorageManager {
    constructor() {
        this.deviceId = null;
        this.localMachines = [];
        this.userTags = [];
        this.initialized = false;
        
        // Firebase
        this.db = null;
        this.auth = null;
        this.currentUser = null;
        this.syncInProgress = false;
        this.listeners = [];
    }

    /**
     * Initialize storage
     */
    async init() {
        if (this.initialized) return;
        
        console.log('📦 Initializing storage...');
        
        // Get or create device ID
        this.deviceId = await this.getOrCreateDeviceId();
        
        // Load local data
        this.loadLocalData();
        
        // Initialize Firebase (if enabled)
        if (CONFIG.useFirebase) {
            await this.initFirebase();
        } else {
            console.log('⚠️ Firebase disabled in config');
        }
        
        this.initialized = true;
        console.log('✅ Storage initialized with device ID:', this.deviceId);
    }

    /**
     * Initialize Firebase
     */
    async initFirebase() {
        if (typeof firebase === 'undefined') {
            console.error('❌ Firebase SDK not loaded!');
            this.updateFirebaseStatus('Fehler: SDK nicht geladen');
            return;
        }

        try {
            console.log('🔥 Initializing Firebase...');
            
            // Initialize Firebase App
            firebase.initializeApp(firebaseConfig);
            this.db = firebase.firestore();
            this.auth = firebase.auth();
            
            // Enable offline persistence
            if (CONFIG.firebase.enablePersistence) {
                try {
                    await this.db.enablePersistence({ synchronizeTabs: true });
                    console.log('💾 Offline persistence enabled');
                } catch (err) {
                    if (err.code === 'failed-precondition') {
                        console.warn('⚠️ Persistence failed: multiple tabs open');
                    } else if (err.code === 'unimplemented') {
                        console.warn('⚠️ Persistence not supported in this browser');
                    }
                }
            }

            // Anonymous authentication
            await this.auth.signInAnonymously();
            this.currentUser = this.auth.currentUser;
            console.log('👤 Signed in anonymously:', this.currentUser.uid);
            
            // Setup real-time listeners
            if (CONFIG.features.enableRealTimeUpdates) {
                this.setupFirebaseListeners();
            }
            
            // Initial sync
            await this.syncWithFirebase();
            
            // Auto-sync timer
            if (CONFIG.firebase.autoSync) {
                setInterval(() => {
                    this.syncWithFirebase();
                }, CONFIG.firebase.syncInterval);
            }
            
            this.updateFirebaseStatus('✅ Verbunden');
            console.log('✅ Firebase initialized successfully');
            
        } catch (error) {
            console.error('❌ Firebase init error:', error);
            this.updateFirebaseStatus('❌ Fehler: ' + error.message);
        }
    }

    /**
     * Setup Firebase real-time listeners
     */
    setupFirebaseListeners() {
        if (!this.db) return;

        console.log('👂 Setting up Firebase listeners...');

        // Listen for validated machines
        const unsubscribe = this.db.collection('machines')
            .where('validated', '==', true)
            .onSnapshot(
                snapshot => {
                    console.log('🔄 Firebase update: ' + snapshot.size + ' machines');
                    
                    snapshot.docChanges().forEach(change => {
                        const machine = { 
                            id: change.doc.id, 
                            ...change.doc.data(),
                            // Convert Firestore Timestamps
                            createdAt: change.doc.data().createdAt?.toMillis() || Date.now(),
                            updatedAt: change.doc.data().updatedAt?.toMillis() || Date.now(),
                            validatedAt: change.doc.data().validatedAt?.toMillis() || null
                        };

                        if (change.type === 'added' || change.type === 'modified') {
                            this.mergeMachineFromFirebase(machine);
                        }

                        if (change.type === 'removed') {
                            this.deleteMachineLocal(machine.id);
                        }
                    });

                    // Update UI
                    if (typeof mapManager !== 'undefined') {
                        mapManager.refreshMarkers();
                    }
                    if (typeof updateStats === 'function') {
                        updateStats();
                    }
                },
                err => {
                    console.error('❌ Firebase listener error:', err);
                    this.updateFirebaseStatus('❌ Sync-Fehler');
                }
            );

        this.listeners.push(unsubscribe);
    }

    /**
     * Merge machine from Firebase into local storage
     */
    mergeMachineFromFirebase(firebaseMachine) {
        const localIndex = this.localMachines.findIndex(m => m.id === firebaseMachine.id);

        if (localIndex !== -1) {
            // Update existing - keep newer version
            const localMachine = this.localMachines[localIndex];
            
            if (firebaseMachine.updatedAt > (localMachine.updatedAt || 0)) {
                console.log('📥 Updating machine from Firebase:', firebaseMachine.id);
                this.localMachines[localIndex] = firebaseMachine;
            }
        } else {
            // Add new
            console.log('📥 Adding new machine from Firebase:', firebaseMachine.id);
            this.localMachines.push(firebaseMachine);
        }

        this.saveLocalData();
    }

    /**
     * Sync with Firebase
     */
    async syncWithFirebase() {
        if (!this.db || this.syncInProgress) return;

        this.syncInProgress = true;
        console.log('🔄 Syncing with Firebase...');

        try {
            // Upload local machines to Firebase
            for (let machine of this.localMachines) {
                await this.uploadMachineToFirebase(machine);
            }

            // Update last sync time
            localStorage.setItem(CONFIG.storageKeys.lastSync, Date.now().toString());
            
            console.log('✅ Sync complete');
            this.updateFirebaseStatus('✅ Verbunden (zuletzt: ' + new Date().toLocaleTimeString() + ')');
            
        } catch (error) {
            console.error('❌ Sync error:', error);
            this.updateFirebaseStatus('❌ Sync-Fehler');
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Upload a machine to Firebase
     */
    async uploadMachineToFirebase(machine) {
        if (!this.db) return;

        try {
            const docRef = this.db.collection('machines').doc(machine.id);
            
            // Load tags from subcollection
            const tagsSnapshot = await docRef.collection('tags').get();
            const existingTags = {};
            tagsSnapshot.forEach(doc => {
                existingTags[doc.id] = true;
            });

            // Upload machine data
            await docRef.set({
                lat: machine.lat,
                lng: machine.lng,
                validated: machine.validated || false,
                createdAt: firebase.firestore.Timestamp.fromMillis(machine.createdAt || Date.now()),
                updatedAt: firebase.firestore.Timestamp.fromMillis(Date.now()),
                validatedAt: machine.validatedAt ? firebase.firestore.Timestamp.fromMillis(machine.validatedAt) : null,
                tagCount: machine.tags?.length || 0,
                uniqueDevices: getUniqueDeviceIds(machine.tags || []).length
            }, { merge: true });

            // Upload new tags to subcollection
            if (machine.tags && machine.tags.length > 0) {
                const batch = this.db.batch();
                
                machine.tags.forEach(tag => {
                    if (!existingTags[tag.id]) {
                        const tagRef = docRef.collection('tags').doc(tag.id);
                        batch.set(tagRef, {
                            deviceId: tag.deviceId,
                            timestamp: firebase.firestore.Timestamp.fromMillis(tag.timestamp),
                            notes: tag.notes || '',
                            lat: tag.lat,
                            lng: tag.lng
                        });
                    }
                });

                await batch.commit();
            }

        } catch (error) {
            console.error('❌ Upload error for machine', machine.id, error);
            throw error;
        }
    }

    /**
     * Update Firebase status in UI
     */
    updateFirebaseStatus(status) {
        const statusEl = document.getElementById('firebaseStatus');
        if (statusEl) {
            statusEl.textContent = status;
        }
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
            const machinesData = localStorage.getItem('smoke_machines');
            this.localMachines = machinesData ? JSON.parse(machinesData) : [];
            
            // Load user tags
            const tagsData = localStorage.getItem(CONFIG.storageKeys.userTags);
            this.userTags = tagsData ? JSON.parse(tagsData) : [];
            
            console.log('📂 Loaded from local:', this.localMachines.length, 'machines');
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
            localStorage.setItem('smoke_machines', JSON.stringify(this.localMachines));
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

        // Upload to Firebase (async, don't wait)
        if (CONFIG.useFirebase && this.db) {
            this.uploadMachineToFirebase(machine)
                .then(() => console.log('✅ Uploaded to Firebase'))
                .catch(err => console.error('❌ Upload failed:', err));
        }

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
    async validateMachine(machineId) {
        const machine = this.getMachineById(machineId);
        if (machine) {
            machine.validated = true;
            machine.validatedAt = Date.now();
            machine.validatedBy = 'admin';
            machine.updatedAt = Date.now();
            
            this.saveLocalData();
            
            // Upload to Firebase
            if (CONFIG.useFirebase && this.db) {
                await this.uploadMachineToFirebase(machine);
            }
            
            return true;
        }
        return false;
    }

    /**
     * Delete machine (admin function)
     */
    async deleteMachine(machineId) {
        const index = this.localMachines.findIndex(m => m.id === machineId);
        if (index !== -1) {
            this.localMachines.splice(index, 1);
            
            // Remove from user tags
            this.userTags = this.userTags.filter(t => t.machineId !== machineId);
            
            this.saveLocalData();
            
            // Delete from Firebase
            if (CONFIG.useFirebase && this.db) {
                try {
                    await this.db.collection('machines').doc(machineId).delete();
                    console.log('✅ Deleted from Firebase');
                } catch (err) {
                    console.error('❌ Firebase delete error:', err);
                }
            }
            
            return true;
        }
        return false;
    }

    /**
     * Delete machine locally (from Firebase listener)
     */
    deleteMachineLocal(machineId) {
        const index = this.localMachines.findIndex(m => m.id === machineId);
        if (index !== -1) {
            this.localMachines.splice(index, 1);
            this.saveLocalData();
        }
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
     * Clear all data
     */
    clearAllData() {
        this.localMachines = [];
        this.userTags = [];
        this.saveLocalData();
        
        localStorage.removeItem(CONFIG.storageKeys.showUnvalidated);
        localStorage.removeItem(CONFIG.storageKeys.adminAuth);
        localStorage.removeItem(CONFIG.storageKeys.lastSync);
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

    /**
     * Cleanup (remove listeners)
     */
    cleanup() {
        this.listeners.forEach(unsubscribe => unsubscribe());
        this.listeners = [];
    }
}

// Create global storage instance
const storage = new StorageManager();
