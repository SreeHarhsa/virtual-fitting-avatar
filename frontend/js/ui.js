/**
 * UI Manager - Handles UI interactions and state management
 */
class UIManager {
    constructor() {
        // Current UI state
        this.currentView = 'capture';
        this.currentTab = 'webcam-tab';
        this.currentCategory = 'clothing';
        this.isDarkMode = false;
        
        // Initialize UI
        this.initialize();
    }
    
    /**
     * Initialize UI manager and set up event handlers
     */
    initialize() {
        // Check for saved theme preference
        this.loadThemePreference();
        
        // Set up navigation handlers
        this.setupNavigation();
        
        // Set up tab switching
        this.setupTabs();
        
        // Set up modal handlers
        this.setupModals();
        
        // Set up file upload handler
        this.setupFileUpload();
        
        // Set up category selection
        this.setupCategorySelection();
        
        // Set up process button
        this.setupProcessButton();
        
        // Set up accessory selection
        this.setupAccessorySelection();
        
        // Set up avatar controls
        this.setupAvatarControls();
        
        // Set up save look functionality
        this.setupSaveLook();
        
        // Check URL parameters
        this.checkURLParameters();
    }
    
    /**
     * Load theme preference from local storage
     */
    loadThemePreference() {
        const savedTheme = localStorage.getItem(CONFIG.ui.theme.storageKey);
        
        if (savedTheme) {
            this.isDarkMode = savedTheme === 'dark';
        } else {
            // Check for system preference
            this.isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
        }
        
        // Apply theme
        this.applyTheme(this.isDarkMode ? 'dark' : 'light');
        
        // Set toggle state
        const themeToggle = document.getElementById('dark-mode-toggle');
        if (themeToggle) {
            themeToggle.checked = this.isDarkMode;
            
            // Add change listener
            themeToggle.addEventListener('change', (e) => {
                this.toggleTheme(e.target.checked);
            });
        }
    }
    
    /**
     * Set up navigation between main views
     */
    setupNavigation() {
        const navLinks = document.querySelectorAll('.main-nav a');
        
        navLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const viewName = link.getAttribute('data-view');
                this.navigateToView(viewName);
            });
        });
        
        // Also handle footer navigation links
        const footerLinks = document.querySelectorAll('.footer-links a[data-view]');
        footerLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const viewName = link.getAttribute('data-view');
                this.navigateToView(viewName);
            });
        });
        
        // Handle "Create First Look" button in empty gallery
        const createFirstLookBtn = document.getElementById('create-first-look-btn');
        if (createFirstLookBtn) {
            createFirstLookBtn.addEventListener('click', () => {
                this.navigateToView('capture');
            });
        }
    }
    
    /**
     * Navigate to a specific view
     * @param {string} viewName - Name of the view to navigate to
     */
    navigateToView(viewName) {
        // Update active state in navigation
        document.querySelectorAll('.main-nav a').forEach(link => {
            if (link.getAttribute('data-view') === viewName) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
        });
        
        // Hide all views
        document.querySelectorAll('.app-view').forEach(view => {
            view.classList.remove('active');
        });
        
        // Show selected view
        const targetView = document.getElementById(`${viewName}-view`);
        if (targetView) {
            targetView.classList.add('active');
            this.currentView = viewName;
            
            // Perform any view-specific initialization
            this._handleViewSpecificActions(viewName);
        }
    }
    
    /**
     * Set up tab switching within views
     */
    setupTabs() {
        // Input method tabs (webcam/upload)
        const tabBtns = document.querySelectorAll('.tab-btn');
        
        tabBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const tabId = btn.getAttribute('data-tab');
                this.switchTab(tabId);
            });
        });
    }
    
    /**
     * Switch to a specific tab
     * @param {string} tabId - ID of the tab to switch to
     */
    switchTab(tabId) {
        // Update active tab button
        document.querySelectorAll('.tab-btn').forEach(btn => {
            if (btn.getAttribute('data-tab') === tabId) {
                btn.classList.add('active');
            } else {
                btn.classList.remove('active');
            }
        });
        
        // Hide all tab content
        document.querySelectorAll('.tab-pane').forEach(pane => {
            pane.classList.remove('active');
        });
        
        // Show selected tab content
        const tabPane = document.getElementById(tabId);
        if (tabPane) {
            tabPane.classList.add('active');
            this.currentTab = tabId;
            
            // Perform tab-specific actions
            if (tabId === 'webcam-tab' && window.cameraManager) {
                // Start the camera when switching to webcam tab
                window.cameraManager.startCamera();
            }
        }
    }
    
    /**
     * Set up modal dialogs
     */
    setupModals() {
        // Close buttons for all modals
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.closeAllModals();
            });
        });
        
        // Close on click outside
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAllModals();
                }
            });
        });
        
        // Close on escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                this.closeAllModals();
            }
        });
        
        // Cancel save button
        const cancelSaveBtn = document.getElementById('cancel-save-btn');
        if (cancelSaveBtn) {
            cancelSaveBtn.addEventListener('click', () => {
                this.closeAllModals();
            });
        }
    }
    
    /**
     * Show a specific modal
     * @param {string} modalId - ID of the modal to show
     */
    showModal(modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
        }
    }
    
    /**
     * Close all open modals
     */
    closeAllModals() {
        document.querySelectorAll('.modal').forEach(modal => {
            modal.classList.remove('active');
        });
    }
    
    /**
     * Set up file upload handling
     */
    setupFileUpload() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const previewContainer = document.getElementById('upload-preview');
        const previewImage = document.getElementById('preview-image');
        const changeImageBtn = document.getElementById('change-image-btn');
        
        if (uploadArea && fileInput) {
            // Drag and drop functionality
            uploadArea.addEventListener('dragover', (e) => {
                e.preventDefault();
                uploadArea.classList.add('drag-over');
            });
            
            uploadArea.addEventListener('dragleave', () => {
                uploadArea.classList.remove('drag-over');
            });
            
            uploadArea.addEventListener('drop', (e) => {
                e.preventDefault();
                uploadArea.classList.remove('drag-over');
                
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileUpload(files[0]);
                }
            });
            
            // Click to upload
            uploadArea.addEventListener('click', () => {
                fileInput.click();
            });
            
            fileInput.addEventListener('change', () => {
                if (fileInput.files.length > 0) {
                    this.handleFileUpload(fileInput.files[0]);
                }
            });
           
            // Change image button
            if (changeImageBtn) {
                changeImageBtn.addEventListener('click', () => {
                    if (previewContainer) previewContainer.style.display = 'none';
                    if (uploadArea) uploadArea.style.display = 'flex';
                    if (fileInput) fileInput.value = '';
                    
                    // Reset captured image
                    const capturedImage = document.getElementById('captured-image');
                    const capturePlaceholder = document.getElementById('capture-placeholder');
                    
                    if (capturedImage) {
                        capturedImage.src = '';
                        capturedImage.hidden = true;
                    }
                    
                    if (capturePlaceholder) {
                        capturePlaceholder.style.display = 'flex';
                    }
                    
                    // Disable the process button
                    const processBtn = document.getElementById('process-btn');
                    if (processBtn) {
                        processBtn.disabled = true;
                    }
                });
            }
        }
    }
    
    /**
     * Handle file upload for images
     * @param {File} file - File object to process
     */
    handleFileUpload(file) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
            utils.showToast('Please select an image file', 'error');
            return;
        }
        
        // Validate file size (max 10MB)
        if (file.size > 10 * 1024 * 1024) {
            utils.showToast('Image size should be less than 10MB', 'error');
            return;
        }
        
        // Create a URL for the file
        const fileURL = URL.createObjectURL(file);
        
        // Update preview
        const previewContainer = document.getElementById('upload-preview');
        const uploadArea = document.getElementById('upload-area');
        const previewImage = document.getElementById('preview-image');
        
        if (previewImage) {
            previewImage.src = fileURL;
            previewImage.onload = () => {
                // Show preview, hide upload area
                if (previewContainer) previewContainer.style.display = 'block';
                if (uploadArea) uploadArea.style.display = 'none';
                
                // Update captured image as well for processing
                const capturedImage = document.getElementById('captured-image');
                const capturePlaceholder = document.getElementById('capture-placeholder');
                
                if (capturedImage) {
                    capturedImage.src = fileURL;
                    capturedImage.hidden = false;
                    
                    if (capturePlaceholder) {
                        capturePlaceholder.style.display = 'none';
                    }
                    
                    // Enable the process button
                    const processBtn = document.getElementById('process-btn');
                    if (processBtn) {
                        processBtn.disabled = false;
                    }
                    
                    // Enable the retake button
                    const retakeBtn = document.getElementById('retake-btn');
                    if (retakeBtn) {
                        retakeBtn.disabled = false;
                    }
                }
            };
        }
    }
    
    /**
     * Set up category selection in the accessories view
     */
    setupCategorySelection() {
        const categoryTabs = document.querySelectorAll('.category-tab');
        
        categoryTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const category = tab.getAttribute('data-category');
                this.switchCategory(category);
            });
        });
    }
    
    /**
     * Switch to a specific accessory category
     * @param {string} category - Category to switch to
     */
    switchCategory(category) {
        // Update active category button
        document.querySelectorAll('.category-tab').forEach(tab => {
            if (tab.getAttribute('data-category') === category) {
                tab.classList.add('active');
            } else {
                tab.classList.remove('active');
            }
        });
        
        this.currentCategory = category;
        
        // Load accessories for this category
        this.loadAccessories(category);
    }
    
    /**
     * Load accessories for a specific category
     * @param {string} category - Category to load accessories for
     */
    loadAccessories(category) {
        const accessoriesGrid = document.getElementById('accessories-grid');
        if (!accessoriesGrid) return;
        
        // Clear current items
        accessoriesGrid.innerHTML = '<div class="loading-message"><div class="spinner"></div><p>Loading accessories...</p></div>';
        
        // In a real app, this would fetch from an API
        // For this demo, we'll use the sample data from the config
        setTimeout(() => {
            if (CONFIG.demoMode.enabled && CONFIG.demoMode.sampleAccessories[category]) {
                const accessories = CONFIG.demoMode.sampleAccessories[category];
                
                if (accessories.length === 0) {
                    accessoriesGrid.innerHTML = '<div class="empty-message">No accessories found in this category</div>';
                    return;
                }
                
                // Clear loading message
                accessoriesGrid.innerHTML = '';
                
                // Add each accessory
                accessories.forEach(accessory => {
                    const accessoryElement = document.createElement('div');
                    accessoryElement.className = 'accessory-item';
                    accessoryElement.dataset.id = accessory.id;
                    
                    accessoryElement.innerHTML = `
                        <img src="${accessory.image || 'assets/images/placeholder.png'}" alt="${accessory.name}">
                        <div class="accessory-name">${accessory.name}</div>
                    `;
                    
                    // Add click handler
                    accessoryElement.addEventListener('click', () => {
                        this.selectAccessory(category, accessory);
                    });
                    
                    accessoriesGrid.appendChild(accessoryElement);
                });
            } else {
                accessoriesGrid.innerHTML = '<div class="empty-message">No accessories found in this category</div>';
            }
        }, 500); // Simulate loading delay
    }
    
    /**
     * Set up process button for avatar generation
     */
    setupProcessButton() {
        const processBtn = document.getElementById('process-btn');
        if (processBtn) {
            processBtn.addEventListener('click', () => {
                this.processAvatar();
            });
        }
    }
    
    /**
     * Process the captured image and generate an avatar
     */
    async processAvatar() {
        const capturedImage = document.getElementById('captured-image');
        
        if (!capturedImage || !capturedImage.src) {
            utils.showToast('Please capture or upload an image first', 'error');
            return;
        }
        
        try {
            // Show the processing modal
            this.showModal('processing-modal');
            
            // Process the image to create an avatar
            // In a real app, this would use the SAM model
            if (window.avatarGenerator) {
                await window.avatarGenerator.generateAvatar(capturedImage.src);
                
                // Close modal
                this.closeAllModals();
                
                // Navigate to the fitting view
                this.navigateToView('fitting');
                
                // Show success message
                utils.showToast('Avatar created successfully!', 'success');
            }
        } catch (error) {
            console.error('Error processing avatar:', error);
            this.closeAllModals();
            utils.showToast('Error creating avatar: ' + error.message, 'error');
        }
    }
    
    /**
     * Set up accessory selection handling
     */
    setupAccessorySelection() {
        // This is handled dynamically when loading accessories
    }
    
    /**
     * Select an accessory and apply it to the avatar
     * @param {string} category - Category of the accessory
     * @param {Object} accessory - Accessory data
     */
    selectAccessory(category, accessory) {
        // Get all items in the current category
        const accessoryItems = document.querySelectorAll('.accessory-item');
        
        // Update selection status
        accessoryItems.forEach(item => {
            if (item.dataset.id === accessory.id) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });
        
        // Apply to avatar
        if (window.avatarGenerator) {
            window.avatarGenerator.applyAccessory(accessory, category)
                .then(success => {
                    if (success) {
                        // Update the selected accessories list
                        this.updateSelectedList(category, accessory);
                        
                        // Enable avatar controls
                        this.updateAvatarControlStates(true);
                    }
                });
        }
    }
    
    /**
     * Update the selected accessories list
     * @param {string} category - Category of the accessory
     * @param {Object} accessory - Accessory data
     */
    updateSelectedList(category, accessory) {
        const selectedList = document.getElementById('selected-list');
        if (!selectedList) return;
        
        // Clear the empty message if it exists
        const emptyMessage = selectedList.querySelector('.empty-message');
        if (emptyMessage) {
            emptyMessage.remove();
        }
        
        // Check if this category already has an item
        const existingItem = selectedList.querySelector(`[data-category="${category}"]`);
        if (existingItem) {
            existingItem.remove();
        }
        
        // Create the new list item
        const listItem = document.createElement('li');
        listItem.dataset.category = category;
        listItem.dataset.id = accessory.id;
        
        // Find the category icon
        const categoryInfo = CONFIG.accessoryCategories.find(cat => cat.id === category);
        const icon = categoryInfo ? categoryInfo.icon : 'fa-tag';
        
        listItem.innerHTML = `
            <span><i class="fas ${icon}"></i> ${accessory.name}</span>
            <button class="remove-accessory-btn" data-category="${category}">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        // Add click handler for the remove button
        listItem.querySelector('.remove-accessory-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeSelectedAccessory(category);
        });
        
        // Add to list
        selectedList.appendChild(listItem);
        
        // Enable clear button
        const clearButton = document.getElementById('clear-accessories-btn');
        if (clearButton) {
            clearButton.disabled = false;
        }
    }
    
    /**
     * Remove a selected accessory
     * @param {string} category - Category of the accessory to remove
     */
    removeSelectedAccessory(category) {
        // Remove from the selected list
        const selectedList = document.getElementById('selected-list');
        if (selectedList) {
            const item = selectedList.querySelector(`[data-category="${category}"]`);
            if (item) {
                item.remove();
            }
            
            // Add empty message if list is now empty
            if (selectedList.children.length === 0) {
                selectedList.innerHTML = '<li class="empty-message">No accessories selected</li>';
                
                // Disable clear button
                const clearButton = document.getElementById('clear-accessories-btn');
                if (clearButton) {
                    clearButton.disabled = true;
                }
            }
        }
        
        // Remove selection from the grid
        const currentItems = document.querySelectorAll('.accessory-item');
        currentItems.forEach(item => {
            if (this.currentCategory === category) {
                item.classList.remove('selected');
            }
        });
        
        // Reset the avatar for this category
        // In a real app, this would update the avatar with the removal
        if (window.avatarGenerator) {
            // For now, just reset to the original
            window.avatarGenerator.resetAvatar();
        }
    }
    
    /**
     * Set up avatar control buttons
     */
    setupAvatarControls() {
        // Reset button
        const resetButton = document.getElementById('reset-avatar-btn');
        if (resetButton) {
            resetButton.addEventListener('click', () => {
                this.resetAvatar();
            });
        }
        
        // Download button
        const downloadButton = document.getElementById('download-avatar-btn');
        if (downloadButton) {
            downloadButton.addEventListener('click', () => {
                this.downloadAvatar();
            });
        }
        
        // Clear accessories button
        const clearButton = document.getElementById('clear-accessories-btn');
        if (clearButton) {
            clearButton.addEventListener('click', () => {
                this.clearAllAccessories();
            });
        }
        
        // Disable buttons initially
        this.updateAvatarControlStates(false);
        
        // Load saved avatar if available
        if (window.avatarGenerator) {
            window.avatarGenerator.loadSavedAvatar();
        }
    }
    
    /**
     * Reset the avatar to its original state
     */
    resetAvatar() {
        if (window.avatarGenerator) {
            window.avatarGenerator.resetAvatar();
            
            // Clear the selected list
            const selectedList = document.getElementById('selected-list');
            if (selectedList) {
                selectedList.innerHTML = '<li class="empty-message">No accessories selected</li>';
            }
            
            // Remove all selections from accessories
            const accessoryItems = document.querySelectorAll('.accessory-item');
            accessoryItems.forEach(item => {
                item.classList.remove('selected');
            });
            
            // Disable clear button
            const clearButton = document.getElementById('clear-accessories-btn');
            if (clearButton) {
                clearButton.disabled = true;
            }
        }
    }
    
    /**
     * Download the current avatar
     */
    downloadAvatar() {
        if (window.avatarGenerator) {
            const dataURL = window.avatarGenerator.getAvatarDataURL();
            if (dataURL) {
                // Create a temporary link
                const a = document.createElement('a');
                a.href = dataURL;
                a.download = `avatar-${Date.now()}.png`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
            }
        }
    }
    
    /**
     * Clear all accessories from the avatar
     */
    clearAllAccessories() {
        // Reset the avatar
        this.resetAvatar();
    }
    
    /**
     * Set up save look functionality
     */
    setupSaveLook() {
        // Save look button
        const saveLookBtn = document.getElementById('save-look-btn');
        if (saveLookBtn) {
            saveLookBtn.addEventListener('click', () => {
                this.showSaveLookModal();
            });
        }
        
        // Confirm save button
        const confirmSaveBtn = document.getElementById('confirm-save-btn');
        if (confirmSaveBtn) {
            confirmSaveBtn.addEventListener('click', () => {
                this.saveLook();
            });
        }
    }
    
    /**
     * Show the save look modal
     */
    showSaveLookModal() {
        if (!window.avatarGenerator) return;
        
        const lookPreviewImg = document.getElementById('look-preview-img');
        if (lookPreviewImg) {
            lookPreviewImg.src = window.avatarGenerator.getAvatarDataURL() || '';
        }
        
        // Show the modal
        this.showModal('save-look-modal');
        
        // Focus on the name field
        setTimeout(() => {
            const nameInput = document.getElementById('look-name');
            if (nameInput) {
                nameInput.focus();
            }
        }, 100);
    }
    
    /**
     * Save the current look
     */
    saveLook() {
        const nameInput = document.getElementById('look-name');
        const notesInput = document.getElementById('look-notes');
        
        if (!nameInput || !nameInput.value.trim()) {
            utils.showToast('Please enter a name for this look', 'error');
            return;
        }
        
        if (!window.avatarGenerator) {
            this.closeAllModals();
            return;
        }
        
        // Get the avatar data URL
        const avatarDataURL = window.avatarGenerator.getAvatarDataURL();
        if (!avatarDataURL) {
            utils.showToast('No avatar available to save', 'error');
            return;
        }
        
        // Create the look object
        const look = {
            id: utils.generateId('look-'),
            name: nameInput.value.trim(),
            notes: notesInput ? notesInput.value.trim() : '',
            date: new Date().toISOString(),
            imageUrl: avatarDataURL
        };
        
        // Get existing looks from storage
        let savedLooks = JSON.parse(localStorage.getItem(CONFIG.storage.savedLooksKey) || '[]');
        
        // Add the new look
        savedLooks.push(look);
        
        // Save back to storage
        try {
            localStorage.setItem(CONFIG.storage.savedLooksKey, JSON.stringify(savedLooks));
            
            // Show success message
            utils.showToast('Look saved successfully', 'success');
            
            // Close the modal
            this.closeAllModals();
            
            // Navigate to the gallery
            this.navigateToView('gallery');
        } catch (error) {
            console.error('Error saving look:', error);
            utils.showToast('Error saving look', 'error');
            this.closeAllModals();
        }
    }
    
    /**
     * Toggle between light and dark themes
     * @param {boolean} isDark - Whether to enable dark mode
     */
    toggleTheme(isDark) {
        this.isDarkMode = isDark;
        this.applyTheme(isDark ? 'dark' : 'light');
        
        // Save preference
        localStorage.setItem(CONFIG.ui.theme.storageKey, isDark ? 'dark' : 'light');
    }
    
    /**
     * Apply a specific theme
     * @param {string} theme - Theme to apply ('light' or 'dark')
     */
    applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    }
    
    /**
     * Update the enabled state of avatar control buttons
     * @param {boolean} enabled - Whether controls should be enabled
     */
    updateAvatarControlStates(enabled) {
        const resetButton = document.getElementById('reset-avatar-btn');
        const downloadButton = document.getElementById('download-avatar-btn');
        const clearButton = document.getElementById('clear-accessories-btn');
        const saveButton = document.getElementById('save-look-btn');
        
        if (resetButton) resetButton.disabled = !enabled;
        if (downloadButton) downloadButton.disabled = !enabled;
        if (clearButton) clearButton.disabled = !enabled;
        if (saveButton) saveButton.disabled = !enabled;
    }
    
    /**
     * Check URL parameters for navigation instructions
     */
    checkURLParameters() {
        const view = utils.getQueryParam('view');
        if (view) {
            this.navigateToView(view);
        }
    }
    
    /**
     * Handle specific actions when switching views
     * @param {string} viewName - Name of the view being switched to
     * @private
     */
    _handleViewSpecificActions(viewName) {
        switch (viewName) {
            case 'capture':
                // Start camera if on webcam tab
                if (this.currentTab === 'webcam-tab' && window.cameraManager) {
                    window.cameraManager.startCamera();
                }
                break;
                
            case 'fitting':
                // Load accessories for the current category
                this.loadAccessories(this.currentCategory);
                break;
                
            case 'gallery':
                // Load saved looks
                this.loadSavedLooks();
                break;
        }
    }
    
    /**
     * Load saved looks from localStorage for the gallery view
     */
    loadSavedLooks() {
        const galleryGrid = document.getElementById('gallery-grid');
        const emptyGallery = document.getElementById('empty-gallery');
        
        if (!galleryGrid || !emptyGallery) return;
        
        // Get saved looks
        const savedLooks = JSON.parse(localStorage.getItem(CONFIG.storage.savedLooksKey) || '[]');
        
        if (savedLooks.length === 0) {
            // Show empty state
            emptyGallery.style.display = 'flex';
            return;
        }
        
        // Hide empty state
        emptyGallery.style.display = 'none';
        
        // Clear existing items
        galleryGrid.innerHTML = '';
        
        // Sort newest first by default
        savedLooks.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Add each look
        savedLooks.forEach(look => {
            const lookElement = document.createElement('div');
            lookElement.className = 'gallery-item';
            lookElement.dataset.id = look.id;
            
            lookElement.innerHTML = `
                <img src="${look.imageUrl}" alt="${look.name}" class="gallery-item-image">
                <div class="gallery-item-info">
                    <h4>${look.name}</h4>
                    <div class="gallery-item-date">${utils.formatDate(look.date)}</div>
                    <div class="gallery-item-notes">${look.notes || ''}</div>
                    <div class="gallery-item-actions">
                        <button class="btn secondary view-look-btn">View</button>
                        <button class="btn danger delete-look-btn">Delete</button>
                    </div>
                </div>
            `;
            
            // Add event listeners
            const viewBtn = lookElement.querySelector('.view-look-btn');
            const deleteBtn = lookElement.querySelector('.delete-look-btn');
            
            if (viewBtn) {
                viewBtn.addEventListener('click', () => this.viewLook(look.id));
            }
            
            if (deleteBtn) {
                deleteBtn.addEventListener('click', () => this.deleteLook(look.id));
            }
            
            // Add to gallery
            galleryGrid.appendChild(lookElement);
        });
    }
    
    /**
     * View a saved look
     * @param {string} lookId - ID of the look to view
     */
    viewLook(lookId) {
        // Get saved looks
        const savedLooks = JSON.parse(localStorage.getItem(CONFIG.storage.savedLooksKey) || '[]');
        const look = savedLooks.find(l => l.id === lookId);
        
        if (!look) return;
        
        // In a real app, we'd load this look into the avatar generator
        // For now, just show in a new tab
        const img = new Image();
        img.src = look.imageUrl;
        
        const w = window.open('');
        w.document.write(img.outerHTML);
        w.document.title = `Look: ${look.name}`;
    }
    
    /**
     * Delete a saved look
     * @param {string} lookId - ID of the look to delete
     */
    async deleteLook(lookId) {
        const confirmed = await utils.confirmAction('Are you sure you want to delete this look?');
        
        if (!confirmed) return;
        
        // Get saved looks
        let savedLooks = JSON.parse(localStorage.getItem(CONFIG.storage.savedLooksKey) || '[]');
        
        // Filter out the look to delete
        savedLooks = savedLooks.filter(look => look.id !== lookId);
        
        // Save back to storage
        localStorage.setItem(CONFIG.storage.savedLooksKey, JSON.stringify(savedLooks));
        
        // Reload the gallery
        this.loadSavedLooks();
        
        // Show success message
        utils.showToast('Look deleted successfully', 'success');
    }
}

// Create a global instance when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.uiManager = new UIManager();
});