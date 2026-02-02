# AutoMap - Zigarettenautomaten Finder PWA

Eine Progressive Web App zum Finden und Teilen von Zigarettenautomaten-Standorten. Community-basiert mit einem Validierungssystem ähnlich wie bei Flush oder Ooono.

## Features

### ✨ Hauptfunktionen
- 🗺️ **Interaktive Karte** mit Leaflet.js
- 📍 **Automaten taggen** durch Tippen auf die Karte
- ✅ **5-Geräte-Validierung** - Automaten werden erst nach 5 unabhängigen Bestätigungen öffentlich
- 🔐 **Geräte-Fingerprinting** zur Verhinderung von Spam
- 👤 **Admin-Panel** zum manuellen Validieren/Löschen
- 📱 **Offline-fähig** (PWA mit Service Worker)
- 🌍 **Geolocation** - Automatische Standorterkennung
- 📊 **Statistiken** - Validierte, ausstehende und eigene Tags

### 🎨 Design
- Modern und schlank mit dunklem Theme
- Gradient-Akzente (Orange/Gelb)
- Responsive Design für Mobile und Desktop
- Smooth Animationen und Transitions

## Installation & Setup

### 1. Repository klonen oder Dateien hochladen
```bash
# Alle Dateien in dein GitHub Pages Repository kopieren
```

### 2. GitHub Pages aktivieren
1. Gehe zu deinem Repository auf GitHub
2. Settings → Pages
3. Source: `main` branch, `/root` folder
4. Speichern

### 3. Firebase einrichten (Optional, für Sync)

**Firebase Projekt erstellen:**
1. Gehe zu [Firebase Console](https://console.firebase.google.com/)
2. Erstelle ein neues Projekt
3. Aktiviere Firestore Database
4. Erstelle eine Web-App

**Firebase Config eintragen:**
Bearbeite `config.js` und ersetze die Platzhalter:

```javascript
const firebaseConfig = {
    apiKey: "DEIN_API_KEY",
    authDomain: "dein-projekt.firebaseapp.com",
    projectId: "dein-projekt-id",
    storageBucket: "dein-projekt.appspot.com",
    messagingSenderId: "DEINE_SENDER_ID",
    appId: "DEINE_APP_ID"
};
```

**Firestore Regeln (Beispiel):**
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /machines/{machineId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
      allow delete: if request.auth != null;
    }
  }
}
```

### 4. Admin-Passwort ändern

Das Standard-Passwort ist `admin123`. **Ändere es unbedingt!**

```bash
# Generiere einen neuen Hash mit diesem Befehl in der Browser-Konsole:
const password = "dein-neues-passwort";
crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  .then(hash => console.log(Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('')));
```

Ersetze dann in `config.js`:
```javascript
const ADMIN_PASSWORD_HASH = "DEIN_NEUER_HASH";
```

### 5. Icons erstellen

Erstelle einen `icons/` Ordner mit App-Icons in folgenden Größen:
- 72x72, 96x96, 128x128, 144x144, 152x152, 192x192, 384x384, 512x512

Online-Tools zum Erstellen:
- [Favicon Generator](https://realfavicongenerator.net/)
- [PWA Asset Generator](https://www.pwabuilder.com/)

## Dateistruktur

```
automap/
├── index.html           # Haupt-HTML-Datei
├── styles.css           # Styling
├── config.js            # Konfiguration & Firebase
├── utils.js             # Hilfsfunktionen
├── storage.js           # Datenverwaltung
├── map.js               # Kartenfunktionalität
├── app.js               # Hauptlogik & UI
├── service-worker.js    # PWA Service Worker
├── manifest.json        # PWA Manifest
├── icons/               # App-Icons
│   ├── icon-72.png
│   ├── icon-192.png
│   └── icon-512.png
└── README.md            # Diese Datei
```

## Konfiguration

Alle wichtigen Einstellungen befinden sich in `config.js`:

```javascript
const CONFIG = {
    MIN_TAGS_FOR_VALIDATION: 5,     // Anzahl Tags für Validierung
    MIN_TAG_DISTANCE: 50,            // Min. Abstand zwischen Tags (Meter)
    MAX_TAG_AGE_DAYS: 365,           // Max. Alter eines Tags
    // ... weitere Einstellungen
};
```

## Verwendung

### Als Nutzer
1. App öffnen → Standort erlauben
2. Karte erkunden
3. Neuen Automaten hinzufügen:
   - Plus-Button klicken
   - Auf Karte tippen
   - Optional Notizen hinzufügen
   - Bestätigen
4. Existierende Automaten bestätigen:
   - Marker antippen
   - "Bestätigen" klicken (nur in der Nähe möglich)

### Als Admin
1. Menü öffnen (☰)
2. "Admin-Panel" klicken
3. Passwort eingeben
4. Unvalidierte Automaten verwalten:
   - Validieren
   - Auf Karte anzeigen
   - Löschen

## Funktionsweise

### Validierungssystem
1. User taggt einen Standort
2. Geräte-Fingerprint wird erstellt (anonym)
3. System prüft, ob 5 verschiedene Geräte den Standort getaggt haben
4. Bei 5+ Tags → Automat wird validiert und öffentlich sichtbar
5. Admin kann manuell validieren

### Geräte-Fingerprinting
Kombiniert mehrere Browser-Eigenschaften:
- User Agent
- Sprache
- Hardware-Kerne
- Bildschirmauflösung
- Zeitzone
- Canvas-Fingerprint

Hash wird lokal gespeichert, nicht persönlich identifizierbar.

### Offline-Funktionalität
- Service Worker cached alle Assets
- Lokale Daten in localStorage
- Funktioniert auch ohne Internet
- Sync bei Wiederverbindung (mit Firebase)

## Erweiterungsmöglichkeiten

### Firebase Integration
Aktiviere in `storage.js`:
```javascript
// Uncomment in initFirebase() und syncWithFirebase()
```

### Kategorien/Typen
Erweitere das Tag-System um Automaten-Typen:
- Standard
- Premium (mit Kreditkarte)
- 24/7 zugänglich

### Bewertungen
Füge Bewertungssystem hinzu:
- Zustand des Automaten
- Verfügbarkeit
- Preis

### Push-Benachrichtigungen
Bei neuen Automaten in der Nähe benachrichtigen

### Social Features
- Nutzerprofile
- Kommentare
- Fotos hochladen

## Troubleshooting

**Karte lädt nicht:**
- Prüfe Internetverbindung
- Browser-Konsole auf Fehler checken
- Leaflet CDN erreichbar?

**Standort funktioniert nicht:**
- HTTPS erforderlich (außer localhost)
- Standortberechtigung erteilt?
- GitHub Pages nutzt HTTPS automatisch

**Service Worker Fehler:**
- Cache leeren und neu laden
- In Chrome: DevTools → Application → Service Workers → Unregister

**Admin-Login funktioniert nicht:**
- Hash korrekt generiert?
- Kein Leerzeichen im Passwort?

## Browser-Kompatibilität

Getestet auf:
- ✅ Chrome/Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Mobile Browser (iOS Safari, Chrome Android)

Benötigt:
- ES6+ Support
- Geolocation API
- Service Workers
- LocalStorage
- Canvas API

## Lizenz & Credits

**Technologien:**
- [Leaflet.js](https://leafletjs.com/) - Interaktive Karten
- [OpenStreetMap](https://www.openstreetmap.org/) - Kartendaten

**Inspiration:**
- Flush App (Toiletten-Finder)
- Ooono (Community-Warnungen)

## Support & Feedback

Bei Fragen oder Problemen:
1. GitHub Issues erstellen
2. Code überprüfen und debuggen
3. Browser-Konsole checken (`F12`)

---

**Viel Erfolg mit deiner AutoMap PWA! 🚬🗺️**
