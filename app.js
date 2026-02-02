// Main Application Logic

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', async () => {
    console.log('AutoMap starting...');
    
    try {
        // Initialize storage
        await storage.init();
        
        // Initialize map
        await mapManager.init();
        
        // Set up UI event listeners
        setupEventListeners();
        
        // Update stats
        updateStats();
        
        // Display device ID
        document.getElementById('deviceId').textContent = storage.deviceId;
        
        // Load settings
        loadSettings();
        
        console.log('AutoMap ready!');
        showToast('AutoMap geladen', 'success');
    } catch (error) {
        console.error('Initialization error:', error);
        showToast('Fehler beim Laden der App', 'error');
    }
});

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Navigation buttons
    document.getElementById('locateBtn').addEventListener('click', () => {
        mapManager.centerOnUser();
    });

    document.getElementById('addBtn').addEventListener('click', () => {
        openAddModal();
    });

    document.getElementById('menuBtn').addEventListener('click', () => {
        openMenuModal();
    });

    // Add modal
    document.getElementById('closeAddModal').addEventListener('click', closeAddModal);
    document.getElementById('confirmAddBtn').addEventListener('click', () => {
        mapManager.startAddingMode();
        closeAddModal();
    });

    // Detail modal
    document.getElementById('closeDetailModal').addEventListener('click', () => {
        document.getElementById('detailModal').classList.remove('active');
    });

    // Menu modal
    document.getElementById('closeMenuModal').addEventListener('click', closeMenuModal);
    
    document.getElementById('showUnvalidated').addEventListener('change', (e) => {
        mapManager.toggleUnvalidated(e.target.checked);
        updateStats();
    });

    document.getElementById('adminBtn').addEventListener('click', () => {
        closeMenuModal();
        openAdminModal();
    });

    document.getElementById('clearCacheBtn').addEventListener('click', clearCache);

    // Admin modal
    document.getElementById('closeAdminModal').addEventListener('click', closeAdminModal);
    document.getElementById('adminLoginBtn').addEventListener('click', adminLogin);

    // Close modals when clicking outside
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('active');
                
                // Cancel adding mode if add modal is closed
                if (modal.id === 'addModal') {
                    mapManager.cancelAddingMode();
                }
            }
        });
    });

    // Admin password enter key
    document.getElementById('adminPassword').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            adminLogin();
        }
    });

    // Notes enter key
    document.getElementById('notes').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && e.ctrlKey) {
            document.getElementById('confirmAddBtn').click();
        }
    });
}

/**
 * Update statistics display
 */
function updateStats() {
    const stats = storage.getStats();
    
    document.getElementById('validatedCount').textContent = stats.validated;
    document.getElementById('pendingCount').textContent = stats.pending;
    document.getElementById('userTagsCount').textContent = stats.userTags;
}

/**
 * Load settings from storage
 */
function loadSettings() {
    const showUnvalidated = storage.getSetting(CONFIG.storageKeys.showUnvalidated, false);
    document.getElementById('showUnvalidated').checked = showUnvalidated;
}

/**
 * Open add machine modal
 */
function openAddModal() {
    document.getElementById('notes').value = '';
    document.getElementById('addModal').classList.add('active');
}

/**
 * Close add machine modal
 */
function closeAddModal() {
    document.getElementById('addModal').classList.remove('active');
    mapManager.cancelAddingMode();
}

/**
 * Open menu modal
 */
function openMenuModal() {
    document.getElementById('menuModal').classList.add('active');
}

/**
 * Close menu modal
 */
function closeMenuModal() {
    document.getElementById('menuModal').classList.remove('active');
}

/**
 * Open admin modal
 */
function openAdminModal() {
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminLogin').style.display = 'flex';
    document.getElementById('adminContent').style.display = 'none';
    document.getElementById('adminModal').classList.add('active');
}

/**
 * Close admin modal
 */
function closeAdminModal() {
    document.getElementById('adminModal').classList.remove('active');
}

/**
 * Admin login
 */
async function adminLogin() {
    const password = document.getElementById('adminPassword').value;
    
    if (!password) {
        showToast('Bitte Passwort eingeben', 'warning');
        return;
    }

    try {
        showLoading();
        
        // Hash the password
        const hash = await hashString(password);
        
        // Check if correct
        if (hash === ADMIN_PASSWORD_HASH) {
            // Save auth temporarily
            storage.setSetting(CONFIG.storageKeys.adminAuth, Date.now());
            
            // Show admin content
            document.getElementById('adminLogin').style.display = 'none';
            document.getElementById('adminContent').style.display = 'block';
            
            // Load admin data
            loadAdminData();
            
            showToast('Angemeldet als Admin', 'success');
        } else {
            showToast('Falsches Passwort', 'error');
        }
    } catch (error) {
        showToast('Login-Fehler', 'error');
    } finally {
        hideLoading();
    }
}

/**
 * Load admin data
 */
function loadAdminData() {
    const unvalidated = storage.getUnvalidatedMachines();
    const listContainer = document.getElementById('adminList');
    
    if (unvalidated.length === 0) {
        listContainer.innerHTML = '<p style="color: var(--color-text-secondary);">Keine unvalidierten Automaten vorhanden.</p>';
        return;
    }

    listContainer.innerHTML = unvalidated.map(machine => {
        const uniqueDevices = getUniqueDeviceIds(machine.tags);
        const hasNotes = machine.tags.some(t => t.notes);
        
        return `
            <div class="admin-list-item" data-machine-id="${machine.id}">
                <h4>Automat #${machine.id.substring(0, 8)}</h4>
                <p>
                    <strong>Standort:</strong> ${formatCoordinates(machine.lat, machine.lng)}<br>
                    <strong>Tags:</strong> ${uniqueDevices.length} von ${CONFIG.MIN_TAGS_FOR_VALIDATION}<br>
                    <strong>Hinzugefügt:</strong> ${formatDate(machine.createdAt)}
                </p>
                ${hasNotes ? `
                    <p><strong>Notizen:</strong></p>
                    <ul style="margin: 0.5rem 0; padding-left: 1.5rem; color: var(--color-text-secondary); font-size: 0.875rem;">
                        ${machine.tags.filter(t => t.notes).map(t => `<li>${t.notes}</li>`).join('')}
                    </ul>
                ` : ''}
                <div class="admin-actions">
                    <button class="btn btn-success" onclick="adminValidateMachine('${machine.id}')">
                        Validieren
                    </button>
                    <button class="btn btn-secondary" onclick="adminShowOnMap('${machine.id}')">
                        Auf Karte
                    </button>
                    <button class="btn btn-danger" onclick="adminDeleteMachine('${machine.id}')">
                        Löschen
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Admin: Validate machine
 */
function adminValidateMachine(machineId) {
    if (confirm('Diesen Automaten validieren?')) {
        storage.validateMachine(machineId);
        mapManager.refreshMarkers();
        updateStats();
        loadAdminData();
        showToast('Automat validiert', 'success');
    }
}

/**
 * Admin: Show machine on map
 */
function adminShowOnMap(machineId) {
    const machine = storage.getMachineById(machineId);
    if (machine) {
        closeAdminModal();
        mapManager.map.setView([machine.lat, machine.lng], 16);
        setTimeout(() => {
            mapManager.showMachineDetail(machine);
        }, 500);
    }
}

/**
 * Admin: Delete machine
 */
function adminDeleteMachine(machineId) {
    if (confirm('Diesen Automaten wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
        storage.deleteMachine(machineId);
        mapManager.removeMarker(machineId);
        mapManager.refreshMarkers();
        updateStats();
        loadAdminData();
        showToast('Automat gelöscht', 'success');
    }
}

/**
 * Clear cache
 */
function clearCache() {
    if (confirm('Wirklich alle lokalen Daten löschen? Dies kann nicht rückgängig gemacht werden.')) {
        storage.clearAllData();
        mapManager.refreshMarkers();
        updateStats();
        
        // Clear service worker cache
        if ('serviceWorker' in navigator && 'caches' in window) {
            caches.keys().then(names => {
                names.forEach(name => caches.delete(name));
            });
        }
        
        showToast('Cache geleert', 'success');
        
        // Reload page after a short delay
        setTimeout(() => {
            window.location.reload();
        }, 1000);
    }
}

/**
 * Handle keyboard shortcuts
 */
document.addEventListener('keydown', (e) => {
    // ESC to close modals
    if (e.key === 'Escape') {
        document.querySelectorAll('.modal.active').forEach(modal => {
            modal.classList.remove('active');
        });
        mapManager.cancelAddingMode();
    }
    
    // L to locate
    if (e.key === 'l' && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
            mapManager.centerOnUser();
        }
    }
    
    // A to add
    if (e.key === 'a' && !e.ctrlKey && !e.metaKey) {
        const activeElement = document.activeElement;
        if (activeElement.tagName !== 'INPUT' && activeElement.tagName !== 'TEXTAREA') {
            openAddModal();
        }
    }
});

/**
 * Handle online/offline status
 */
window.addEventListener('online', () => {
    showToast('Verbindung wiederhergestellt', 'success');
});

window.addEventListener('offline', () => {
    showToast('Keine Internetverbindung', 'warning', 5000);
});

/**
 * Handle visibility change (when app comes back to foreground)
 */
document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
        // Refresh data when app becomes visible again
        updateStats();
    }
});

/**
 * Debug function - log all data to console
 */
function debugData() {
    console.log('=== AutoMap Debug ===');
    console.log('Device ID:', storage.deviceId);
    console.log('Machines:', storage.localMachines);
    console.log('User Tags:', storage.userTags);
    console.log('Stats:', storage.getStats());
    console.log('Show Unvalidated:', mapManager.showUnvalidated);
}

// Make debug function globally available
window.debugData = debugData;
