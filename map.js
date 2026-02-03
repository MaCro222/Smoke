// Map Management

class MapManager {
    constructor() {
        this.map = null;
        this.markers = {};
        this.userMarker = null;
        this.userLocation = null;
        this.addingMode = false;
        this.tempMarker = null;
        this.showUnvalidated = false;
    }

    /**
     * Initialize the map
     */
    async init() {
        // Create map
        this.map = L.map('map', {
            zoomControl: true,
            attributionControl: true
        });

        // Add tile layer
        L.tileLayer(CONFIG.map.tileLayer, {
            attribution: CONFIG.map.attribution,
            maxZoom: CONFIG.map.maxZoom,
            minZoom: CONFIG.map.minZoom
        }).addTo(this.map);

        // Try to get user location and center map
        try {
            const location = await getUserLocation();
            this.userLocation = location;
            this.map.setView([location.lat, location.lng], CONFIG.map.defaultZoom);
            this.addUserMarker(location.lat, location.lng);
        } catch (error) {
            console.warn('Could not get user location:', error);
            // Use default center
            this.map.setView(CONFIG.map.defaultCenter, CONFIG.map.defaultZoom);
        }

        // Load setting for showing unvalidated machines
        this.showUnvalidated = storage.getSetting(CONFIG.storageKeys.showUnvalidated, false);

        // Load and display machines
        this.refreshMarkers();

        // Set up standard map events
        this.bindStandardMapEvents();

        console.log('Map initialized');
    }

    /**
     * Bind standard map events (non-adding mode)
     */
    bindStandardMapEvents() {
        // Entferne alle vorherigen Handler
        this.map.off('click');
        this.map.off('tap');
        
        // Keine Events im Standard-Modus - nur im Adding-Modus
        console.log('Standard map events bound (no click handling)');
    }

    /**
     * Add user location marker
     */
    addUserMarker(lat, lng) {
        if (this.userMarker) {
            this.map.removeLayer(this.userMarker);
        }

        const icon = L.divIcon({
            className: 'user-location-marker',
            html: `
                <div style="
                    width: 20px;
                    height: 20px;
                    background: #4ecca3;
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.3);
                "></div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        this.userMarker = L.marker([lat, lng], { icon }).addTo(this.map);
        
        // Add accuracy circle if available
        if (this.userLocation && this.userLocation.accuracy) {
            L.circle([lat, lng], {
                radius: this.userLocation.accuracy,
                color: '#4ecca3',
                fillColor: '#4ecca3',
                fillOpacity: 0.1,
                weight: 1
            }).addTo(this.map);
        }
    }

    /**
     * Center map on user location
     */
    async centerOnUser() {
        try {
            showLoading();
            const location = await getUserLocation();
            this.userLocation = location;
            this.map.setView([location.lat, location.lng], CONFIG.map.defaultZoom);
            this.addUserMarker(location.lat, location.lng);
            showToast('Standort aktualisiert', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Refresh all markers on the map
     */
    refreshMarkers() {
        // Remove all existing markers
        Object.values(this.markers).forEach(marker => {
            this.map.removeLayer(marker);
        });
        this.markers = {};

        // Get machines to display
        const machines = storage.getAllMachines(this.showUnvalidated);

        // Add markers
        machines.forEach(machine => {
            this.addMarker(machine);
        });
    }

    /**
     * Add a marker for a machine
     */
    addMarker(machine) {
        const isValidated = machine.validated;
        const tagCount = getUniqueDeviceIds(machine.tags).length;

        const icon = L.divIcon({
            className: 'custom-marker-wrapper',
            html: `
                <div class="custom-marker ${isValidated ? 'validated' : 'pending'}">
                    <div class="custom-marker-inner">
                        ${isValidated ? '✓' : tagCount}
                    </div>
                </div>
            `,
            iconSize: [40, 40],
            iconAnchor: [20, 40]
        });

        const marker = L.marker([machine.lat, machine.lng], { 
            icon,
            interactive: true,
            bubblingMouseEvents: false
        })
            .addTo(this.map);

        // Event Handler für alle Plattformen
        const showDetail = (e) => {
            if (e && e.originalEvent) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
            }
            this.showMachineDetail(machine);
        };

        // Click für Desktop/Android
        marker.on('click', showDetail);
        
        // Tap für iOS (Leaflet-spezifisch)
        if (L.Browser.mobile) {
            marker.on('tap', showDetail);
        }

        this.markers[machine.id] = marker;
    }

    /**
     * Show machine details
     */
    showMachineDetail(machine) {
        const uniqueDevices = getUniqueDeviceIds(machine.tags);
        const hasUserTagged = storage.hasUserTaggedMachine(machine.id);
        const progress = (uniqueDevices.length / CONFIG.MIN_TAGS_FOR_VALIDATION) * 100;

        let notesHtml = '';
        if (machine.tags.some(t => t.notes)) {
            const notesWithText = machine.tags.filter(t => t.notes);
            notesHtml = `
                <div style="margin-top: 1rem;">
                    <strong>Notizen:</strong>
                    <ul style="margin: 0.5rem 0; padding-left: 1.5rem; color: var(--color-text-secondary);">
                        ${notesWithText.map(t => `<li>${t.notes}</li>`).join('')}
                    </ul>
                </div>
            `;
        }

        const content = `
            <div class="detail-info">
                <h3>${machine.validated ? 'Validierter Automat' : 'Unvalidierter Automat'}</h3>
                <p><strong>Standort:</strong> ${formatCoordinates(machine.lat, machine.lng)}</p>
                <p><strong>Tags:</strong> ${uniqueDevices.length} von ${CONFIG.MIN_TAGS_FOR_VALIDATION}</p>
                <p><strong>Hinzugefügt:</strong> ${formatDate(machine.createdAt)}</p>
                ${machine.validatedAt ? `<p><strong>Validiert:</strong> ${formatDate(machine.validatedAt)}</p>` : ''}
                
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${Math.min(progress, 100)}%"></div>
                </div>
                
                ${notesHtml}
                
                ${!hasUserTagged && !machine.validated ? `
                    <button class="btn btn-primary tag-btn" onclick="mapManager.tagMachine('${machine.id}')">
                        Bestätigen (+1 Tag)
                    </button>
                ` : ''}
                
                ${hasUserTagged ? `
                    <p style="color: var(--color-success); margin-top: 1rem;">
                        ✓ Du hast diesen Automaten bereits bestätigt
                    </p>
                ` : ''}
            </div>
            
            <button class="btn btn-secondary" onclick="mapManager.navigateToMachine(${machine.lat}, ${machine.lng})">
                Navigation starten
            </button>
        `;

        document.getElementById('detailContent').innerHTML = content;
        document.getElementById('detailModal').classList.add('active');
    }

    /**
     * Tag an existing machine
     */
    async tagMachine(machineId) {
        try {
            showLoading();
            
            const machine = storage.getMachineById(machineId);
            if (!machine) {
                throw new Error('Automat nicht gefunden');
            }

            // Check if user is close enough
            if (this.userLocation) {
                const distance = calculateDistance(
                    this.userLocation.lat,
                    this.userLocation.lng,
                    machine.lat,
                    machine.lng
                );

                if (distance > 100) { // 100 meters
                    showToast('Du bist zu weit entfernt (max. 100m)', 'error');
                    return;
                }
            }

            // Add tag
            await storage.addMachineTag(machine.lat, machine.lng, '');
            
            // Refresh markers
            this.refreshMarkers();
            
            // Close modal
            document.getElementById('detailModal').classList.remove('active');
            
            // Update stats
            updateStats();
            
            showToast('Tag hinzugefügt!', 'success');
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Navigate to machine (open in maps app)
     */
    navigateToMachine(lat, lng) {
        const isMobileDevice = isMobile();
        const url = isMobileDevice
            ? `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`
            : `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
        
        window.open(url, '_blank');
    }

    /**
     * Handle map click
     */
    handleMapClick(e) {
        console.log('🗺️ handleMapClick called!');
        console.log('  - addingMode:', this.addingMode);
        console.log('  - event:', e);
        console.log('  - coordinates:', e.latlng);
        
        if (!this.addingMode) {
            console.log('  ⚠️ Not in adding mode, ignoring click');
            return;
        }

        // Get coordinates
        const lat = e.latlng.lat;
        const lng = e.latlng.lng;
        
        console.log(`  ✅ Adding machine at: ${lat}, ${lng}`);
        
        // Store coordinates
        this.tempCoords = { lat, lng };
        
        // Show confirmation with coordinates
        const confirmAdd = confirm(`Automaten hier markieren?\n\nStandort: ${lat.toFixed(5)}, ${lng.toFixed(5)}`);
        
        if (confirmAdd) {
            console.log('  ✅ User confirmed, adding machine...');
            // Add the machine immediately
            this.confirmAddMachine('');
        } else {
            console.log('  ❌ User cancelled');
            // Just cancel
            this.cancelAddingMode();
        }
    }

    /**
     * Start adding mode
     */
    startAddingMode() {
        console.log('🎯 Starting adding mode...');
        this.addingMode = true;
        
        // Visual feedback
        const mapContainer = this.map.getContainer();
        mapContainer.style.cursor = 'crosshair';
        mapContainer.style.border = '4px solid #ff6b35'; // Orange border
        mapContainer.style.boxShadow = '0 0 20px rgba(255, 107, 53, 0.5)';
        
        // Entferne alte Handler und binde neu (iOS/Android Fix)
        this.map.off('click');
        this.map.off('tap');
        
        // Bind Click Handler
        this.clickHandler = (e) => {
            console.log('🗺️ Map clicked at:', e.latlng);
            this.handleMapClick(e);
        };
        
        this.map.on('click', this.clickHandler);
        
        // iOS/Mobile: Auch tap-Event
        if (L.Browser.mobile) {
            console.log('📱 Mobile detected, binding tap event');
            this.map.on('tap', this.clickHandler);
        }
        
        showToast('🎯 Tippe auf die Karte!', 'info', 5000);
    }

    /**
     * Cancel adding mode
     */
    cancelAddingMode() {
        console.log('🚫 Cancelling adding mode...');
        this.addingMode = false;
        
        // Remove visual feedback
        const mapContainer = this.map.getContainer();
        mapContainer.style.cursor = '';
        mapContainer.style.border = '';
        mapContainer.style.boxShadow = '';
        
        // Entferne Adding-Handler
        if (this.clickHandler) {
            this.map.off('click', this.clickHandler);
            this.map.off('tap', this.clickHandler);
            this.clickHandler = null;
        }
        
        // Binde Standard-Handler wieder (für normale Nutzung)
        this.bindStandardMapEvents();
        
        if (this.tempMarker) {
            this.map.removeLayer(this.tempMarker);
            this.tempMarker = null;
        }
        
        this.tempCoords = null;
    }

    /**
     * Confirm adding machine
     */
    async confirmAddMachine(notes) {
        if (!this.tempCoords) {
            showToast('Bitte markiere zuerst einen Standort auf der Karte', 'warning');
            return;
        }

        try {
            showLoading();

            // Add machine
            const machine = await storage.addMachineTag(
                this.tempCoords.lat,
                this.tempCoords.lng,
                notes
            );

            // Clean up
            this.cancelAddingMode();

            // Refresh map
            this.refreshMarkers();

            // Update stats
            updateStats();

            showToast('Automat hinzugefügt!', 'success');
            
            if (machine.validated) {
                showToast('Automat wurde validiert! 🎉', 'success', 5000);
            }
        } catch (error) {
            showToast(error.message, 'error');
        } finally {
            hideLoading();
        }
    }

    /**
     * Toggle showing unvalidated machines
     */
    toggleUnvalidated(show) {
        this.showUnvalidated = show;
        storage.setSetting(CONFIG.storageKeys.showUnvalidated, show);
        this.refreshMarkers();
    }

    /**
     * Remove marker
     */
    removeMarker(machineId) {
        if (this.markers[machineId]) {
            this.map.removeLayer(this.markers[machineId]);
            delete this.markers[machineId];
        }
    }
}

// Create global map instance
const mapManager = new MapManager();

// Add CSS for pulse animation
const style = document.createElement('style');
style.textContent = `
    @keyframes pulse {
        0%, 100% { transform: scale(1); opacity: 1; }
        50% { transform: scale(1.1); opacity: 0.8; }
    }
`;
document.head.appendChild(style);
