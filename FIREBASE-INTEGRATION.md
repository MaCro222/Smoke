# Firebase Integration Guide

Detaillierte Anleitung zur Firebase-Integration für Echtzeit-Synchronisation zwischen Geräten.

## Warum Firebase?

- ☁️ **Cloud-Speicher** - Daten über Geräte hinweg verfügbar
- 🔄 **Echtzeit-Sync** - Automatische Updates wenn neue Automaten hinzugefügt werden
- 🆓 **Kostenlos** - Spark Plan reicht für die meisten Anwendungsfälle
- 🔒 **Sicher** - Firestore Security Rules schützen deine Daten

## Schritt 1: Firebase SDK einbinden

Füge in `index.html` vor `</body>` hinzu:

```html
<!-- Firebase SDKs -->
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-auth-compat.js"></script>
```

## Schritt 2: Storage Manager erweitern

Bearbeite `storage.js` und aktiviere die Firebase-Funktionen:

### A) Initialize Firebase

Ersetze die `initFirebase()` Funktion:

```javascript
initFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase not loaded');
        return;
    }

    try {
        firebase.initializeApp(firebaseConfig);
        this.db = firebase.firestore();
        this.auth = firebase.auth();
        
        // Enable offline persistence
        this.db.enablePersistence()
            .catch(err => {
                if (err.code === 'failed-precondition') {
                    console.warn('Persistence failed: multiple tabs open');
                } else if (err.code === 'unimplemented') {
                    console.warn('Persistence not supported');
                }
            });

        // Anonymous authentication
        this.auth.signInAnonymously()
            .then(() => {
                console.log('Firebase authenticated anonymously');
                this.setupFirebaseListeners();
            })
            .catch(err => console.error('Auth error:', err));

        console.log('Firebase initialized');
    } catch (error) {
        console.error('Firebase init error:', error);
    }
}
```

### B) Setup Real-time Listeners

Füge diese Methode hinzu:

```javascript
setupFirebaseListeners() {
    if (!this.db) return;

    // Listen for new/updated machines
    this.db.collection('machines')
        .where('validated', '==', true)
        .onSnapshot(snapshot => {
            snapshot.docChanges().forEach(change => {
                const machine = { id: change.doc.id, ...change.doc.data() };

                if (change.type === 'added' || change.type === 'modified') {
                    this.mergeMachineFromFirebase(machine);
                }

                if (change.type === 'removed') {
                    this.deleteMachine(machine.id);
                }
            });

            // Update UI
            if (typeof mapManager !== 'undefined') {
                mapManager.refreshMarkers();
            }
            if (typeof updateStats === 'function') {
                updateStats();
            }
        }, err => {
            console.error('Firebase listener error:', err);
        });
}
```

### C) Merge Firebase Data

```javascript
mergeMachineFromFirebase(firebaseMachine) {
    const localIndex = this.localMachines.findIndex(m => m.id === firebaseMachine.id);

    if (localIndex !== -1) {
        // Update existing
        const localMachine = this.localMachines[localIndex];
        
        // Keep local data if newer
        if (firebaseMachine.updatedAt > localMachine.updatedAt) {
            this.localMachines[localIndex] = {
                ...firebaseMachine,
                tags: this.mergeTags(localMachine.tags, firebaseMachine.tags)
            };
        }
    } else {
        // Add new
        this.localMachines.push(firebaseMachine);
    }

    this.saveLocalData();
}
```

### D) Merge Tags

```javascript
mergeTags(localTags, firebaseTags) {
    const tagMap = new Map();

    // Add local tags
    localTags.forEach(tag => tagMap.set(tag.id, tag));

    // Add/update with firebase tags
    firebaseTags.forEach(tag => {
        if (!tagMap.has(tag.id)) {
            tagMap.set(tag.id, tag);
        }
    });

    return Array.from(tagMap.values());
}
```

### E) Sync with Firebase

Ersetze die `syncWithFirebase()` Methode:

```javascript
async syncWithFirebase(machine) {
    if (!this.db) {
        console.warn('Firebase not initialized');
        return;
    }

    try {
        const docRef = this.db.collection('machines').doc(machine.id);
        
        await docRef.set({
            lat: machine.lat,
            lng: machine.lng,
            validated: machine.validated,
            createdAt: machine.createdAt,
            updatedAt: Date.now(),
            validatedAt: machine.validatedAt || null,
            tagCount: machine.tags.length,
            uniqueDevices: getUniqueDeviceIds(machine.tags).length
        }, { merge: true });

        // Store tags in subcollection
        const batch = this.db.batch();
        machine.tags.forEach(tag => {
            const tagRef = docRef.collection('tags').doc(tag.id);
            batch.set(tagRef, {
                deviceId: tag.deviceId,
                timestamp: tag.timestamp,
                notes: tag.notes || '',
                lat: tag.lat,
                lng: tag.lng
            });
        });
        await batch.commit();

        console.log('Synced to Firebase:', machine.id);
    } catch (error) {
        console.error('Firebase sync error:', error);
        throw error;
    }
}
```

## Schritt 3: Update addMachineTag

In `storage.js`, erweitere `addMachineTag()`:

```javascript
async addMachineTag(lat, lng, notes = '') {
    // ... existing code ...

    // Sync with Firebase
    if (this.db) {
        try {
            await this.syncWithFirebase(machine);
            showToast('Mit Cloud synchronisiert', 'success');
        } catch (error) {
            console.error('Sync failed:', error);
            showToast('Offline-Modus: Wird später synchronisiert', 'warning');
        }
    }

    return machine;
}
```

## Schritt 4: Firestore Data Structure

### Collections Structure

```
machines (collection)
├── {machineId} (document)
│   ├── lat: number
│   ├── lng: number
│   ├── validated: boolean
│   ├── createdAt: timestamp
│   ├── updatedAt: timestamp
│   ├── validatedAt: timestamp?
│   ├── tagCount: number
│   ├── uniqueDevices: number
│   └── tags (subcollection)
│       └── {tagId} (document)
│           ├── deviceId: string
│           ├── timestamp: timestamp
│           ├── notes: string
│           ├── lat: number
│           └── lng: number
```

## Schritt 5: Security Rules

### Production Rules

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // Helper functions
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isValidMachine() {
      return request.resource.data.keys().hasAll(['lat', 'lng', 'validated']) &&
             request.resource.data.lat is number &&
             request.resource.data.lng is number &&
             request.resource.data.lat >= -90 &&
             request.resource.data.lat <= 90 &&
             request.resource.data.lng >= -180 &&
             request.resource.data.lng <= 180;
    }
    
    function isValidTag() {
      return request.resource.data.keys().hasAll(['deviceId', 'timestamp', 'lat', 'lng']) &&
             request.resource.data.deviceId is string &&
             request.resource.data.timestamp is number;
    }
    
    // Machines collection
    match /machines/{machineId} {
      // Everyone can read validated machines
      allow read: if resource.data.validated == true;
      
      // Authenticated users can read their own pending machines
      allow read: if isAuthenticated() && 
                     resource.data.validated == false;
      
      // Authenticated users can create new machines
      allow create: if isAuthenticated() && 
                       isValidMachine();
      
      // Authenticated users can update existing machines
      allow update: if isAuthenticated() && 
                       isValidMachine() &&
                       // Can only validate if enough tags
                       (!request.resource.data.diff(resource.data).affectedKeys().hasAny(['validated']) ||
                        request.resource.data.uniqueDevices >= 5);
      
      // Only allow delete for admins (implement custom claims)
      allow delete: if isAuthenticated() &&
                       request.auth.token.admin == true;
      
      // Tags subcollection
      match /tags/{tagId} {
        allow read: if true;
        allow create: if isAuthenticated() && isValidTag();
        allow update, delete: if false; // Tags are immutable
      }
    }
    
    // User profiles (optional)
    match /users/{userId} {
      allow read, write: if isAuthenticated() && 
                           request.auth.uid == userId;
    }
  }
}
```

## Schritt 6: Admin Custom Claims

Für Admin-Funktionen über Firebase:

```javascript
// In Firebase Functions (functions/index.js)
const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

exports.setAdminClaim = functions.https.onCall(async (data, context) => {
  // Check if requester is already admin
  if (!context.auth.token.admin) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only admins can make other users admin'
    );
  }

  // Set admin claim
  await admin.auth().setCustomUserClaims(data.uid, { admin: true });
  
  return { success: true };
});
```

## Schritt 7: Offline Support

Firebase bietet automatisch Offline-Support:

```javascript
// In storage.js initFirebase()
this.db.enablePersistence({ synchronizeTabs: true })
    .then(() => console.log('Offline persistence enabled'))
    .catch(err => {
        if (err.code === 'failed-precondition') {
            console.warn('Multiple tabs open, persistence disabled');
        } else if (err.code === 'unimplemented') {
            console.warn('Browser doesn\'t support persistence');
        }
    });
```

## Schritt 8: Testing

### A) Test Data einfügen

In Browser-Konsole:

```javascript
// Add test machine
storage.db.collection('machines').add({
    lat: 50.2333,
    lng: 8.9167,
    validated: true,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    validatedAt: Date.now(),
    tagCount: 5,
    uniqueDevices: 5
}).then(doc => console.log('Test machine added:', doc.id));
```

### B) Monitor Real-time Updates

```javascript
// Listen to all changes
storage.db.collection('machines').onSnapshot(snapshot => {
    console.log('Firebase update:', snapshot.size, 'documents');
    snapshot.docChanges().forEach(change => {
        console.log(change.type, change.doc.id, change.doc.data());
    });
});
```

## Schritt 9: Monitoring & Analytics

### Firebase Console

1. **Firestore Usage:**
   - Console → Firestore → Usage
   - Überwache Reads/Writes/Deletes

2. **Quota Limits (Spark Plan):**
   - 50,000 reads/day
   - 20,000 writes/day
   - 20,000 deletes/day
   - 1 GB storage

3. **Performance:**
   - Console → Performance
   - Überwache App-Ladezeiten

## Schritt 10: Cost Optimization

### Tipps zur Reduzierung von Firestore-Kosten

1. **Caching nutzen:**
```javascript
// Cache data for 1 hour
const oneHour = 1000 * 60 * 60;
db.collection('machines')
  .where('validated', '==', true)
  .get({ source: 'cache' })
  .catch(() => db.collection('machines').get());
```

2. **Batch Operations:**
```javascript
// Update multiple docs in one operation
const batch = db.batch();
machines.forEach(machine => {
    const ref = db.collection('machines').doc(machine.id);
    batch.update(ref, { validated: true });
});
await batch.commit(); // Only 1 write cost!
```

3. **Index Optimization:**
   - Console → Firestore → Indexes
   - Erstelle nur notwendige Composite Indexes

4. **Pagination:**
```javascript
// Load machines in batches
const first = db.collection('machines')
    .limit(25);
const snapshot = await first.get();
const last = snapshot.docs[snapshot.docs.length - 1];

const next = db.collection('machines')
    .startAfter(last)
    .limit(25);
```

## Troubleshooting

### Problem: "Missing or insufficient permissions"

**Lösung:** Prüfe Firestore Rules, stelle sicher dass User authentifiziert ist

### Problem: "quota exceeded"

**Lösung:** Upgrade zu Blaze Plan oder optimiere Queries

### Problem: Daten werden nicht synchronisiert

**Lösung:**
```javascript
// Check Firebase connection
firebase.firestore().disableNetwork()
    .then(() => firebase.firestore().enableNetwork())
    .then(() => console.log('Reconnected'));
```

---

**Mit Firebase-Integration ist deine App jetzt cloud-connected! ☁️**
