/**
 * Avatar Generator - Handles creation and manipulation of virtual avatars
 * 
 * This module uses the SAM segmentation to create and manipulate avatars
 * for virtual try-on purposes.
 */
class AvatarGenerator {
    constructor() {
        // Avatar state
        this.avatarData = null;
        this.segmentationMask = null;
        this.originalImage = null;
        this.cutoutImage = null;
        
        // Canvas references
        this.canvas = document.getElementById('avatar-canvas');
        this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
        
        // Processing state
        this.isProcessing = false;
        
        // Event callbacks
        this.onProgress = null;
        this.onStatusChange = null;
        this.onAvatarGenerated = null;
    }
    
    /**
     * Generate avatar from an image using SAM segmentation
     * @param {HTMLImageElement|string} image - Image element or data URL
     * @returns {Promise<Object>} Avatar data
     */
    async generateAvatar(image) {
        try {
            if (this.isProcessing) {
                throw new Error('Avatar generation already in progress');
            }
            
            this.isProcessing = true;
            this._updateStatus('Starting avatar generation...');
            this._updateProgress(0);
            
            // Convert string URL to image if needed
            let imgElement = image;
            if (typeof image === 'string') {
                imgElement = await this._loadImage(image);
            }
            
            // Store the original image
            this.originalImage = imgElement;
            
            // Initialize SAM if needed
            if (!window.samClient.isInitialized) {
                this._updateStatus('Initializing segmentation model...');
                await window.samClient.initialize();
            }
            
            // Update progress handlers
            window.samClient.onProgress = (progress) => {
                this._updateProgress(progress * 0.6); // 0-60% for segmentation
            };
            
            window.samClient.onStatusChange = (status) => {
                this._updateStatus(status);
            };
            
            // Perform automatic human segmentation
            this._updateStatus('Segmenting human figure...');
            this.segmentationMask = await window.samClient.autoSegmentHuman(imgElement);
            
            this._updateProgress(70);
            this._updateStatus('Creating cutout image...');
            
            // Generate cutout using the mask
            this.cutoutImage = window.samClient.applyMaskToImage('cutout', 'rgba(0,0,0,0)');
            
            this._updateProgress(80);
            this._updateStatus('Processing avatar details...');
            
            // Create the final avatar data
            this.avatarData = await this._processAvatarDetails();
            
            this._updateProgress(95);
            this._updateStatus('Finalizing avatar...');
            
            // Draw the avatar to canvas
            this._drawAvatarToCanvas();
            
            this._updateProgress(100);
            this._updateStatus('Avatar generated successfully');
            
            // Save avatar data to storage
            this._saveAvatarToStorage();
            
            // Notify completion
            if (this.onAvatarGenerated) {
                this.onAvatarGenerated(this.avatarData);
            }
            
            this.isProcessing = false;
            return this.avatarData;
            
        } catch (error) {
            this._updateStatus(`Error generating avatar: ${error.message}`);
            console.error('Avatar Generation Error:', error);
            this.isProcessing = false;
            throw error;
        }
    }
    
    /**
     * Apply an accessory to the avatar
     * @param {Object} accessory - Accessory data with image URL
     * @param {string} category - Category of accessory (clothing, hat, etc.)
     * @returns {Promise<boolean>} Success status
     */
    async applyAccessory(accessory, category) {
        if (!this.avatarData || !this.canvas) {
            throw new Error('No avatar available');
        }
        
        try {
            this._updateStatus(`Applying ${category}...`);
            
            // Load the accessory image
            const accessoryImg = await this._loadImage(accessory.image);
            
            // Determine placement based on category
            let placement = {};
            switch (category) {
                case 'clothing':
                    placement = this._getClothingPlacement();
                    break;
                case 'hats':
                    placement = this._getHatPlacement();
                    break;
                case 'glasses':
                    placement = this._getGlassesPlacement();
                    break;
                case 'jewelry':
                    placement = this._getJewelryPlacement();
                    break;
                default:
                    placement = this._getCenterPlacement();
            }
            
            // Draw accessory on canvas
            this._drawAccessory(accessoryImg, placement);
            
            // Update avatar data with new canvas state
            this.avatarData.withAccessories = true;
            this.avatarData.lastModified = new Date().toISOString();
            
            // Store the updated avatar
            this._saveAvatarToStorage();
            
            this._updateStatus(`${accessory.name} applied successfully`);
            return true;
            
        } catch (error) {
            this._updateStatus(`Error applying accessory: ${error.message}`);
            console.error('Apply Accessory Error:', error);
            return false;
        }
    }
    
    /**
     * Reset the avatar to its original state without accessories
     */
    resetAvatar() {
        if (!this.avatarData) {
            return false;
        }
        
        try {
            // Redraw the original cutout image
            this._drawAvatarToCanvas();
            
            // Update avatar data
            this.avatarData.withAccessories = false;
            this.avatarData.lastModified = new Date().toISOString();
            
            // Save updated state
            this._saveAvatarToStorage();
            
            return true;
        } catch (error) {
            console.error('Reset Avatar Error:', error);
            return false;
        }
    }
    
    /**
     * Get the current avatar as a data URL
     * @returns {string} Data URL of current avatar state
     */
    getAvatarDataURL() {
        if (!this.canvas) {
            return null;
        }
        
        return this.canvas.toDataURL('image/png');
    }
    
    /**
     * Load a previously saved avatar
     * @returns {boolean} Success status
     */
    loadSavedAvatar() {
        try {
            const savedAvatar = localStorage.getItem(CONFIG.storage.avatarKey);
            if (!savedAvatar) {
                return false;
            }
            
            const avatarData = JSON.parse(savedAvatar);
            
            // Load the base64 image
            this._loadImage(avatarData.dataUrl).then(img => {
                // Set up canvas if needed
                if (this.canvas) {
                    this.canvas.width = img.width;
                    this.canvas.height = img.height;
                    this.canvas.style.display = 'block';
                    
                    // Draw the image to canvas
                    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                    this.ctx.drawImage(img, 0, 0);
                    
                    // Update avatar data
                    this.avatarData = avatarData;
                    
                    // Hide placeholder if it exists
                    const placeholder = document.getElementById('avatar-placeholder');
                    if (placeholder) {
                        placeholder.style.display = 'none';
                    }
                    
                    // Enable relevant controls
                    this._updateControlStates(true);
                }
            });
            
            return true;
        } catch (error) {
            console.error('Load Avatar Error:', error);
            return false;
        }
    }
    
    /**
     * Process additional details for the avatar
     * @returns {Promise<Object>} Processed avatar data
     * @private
     */
    async _processAvatarDetails() {
        // Create the avatar data object
        const avatarData = {
            id: Date.now().toString(),
            created: new Date().toISOString(),
            lastModified: new Date().toISOString(),
            withAccessories: false,
            dataUrl: null, // Will be set after drawing to canvas
            dimensions: {
                width: this.cutoutImage.width,
                height: this.cutoutImage.height
            }
        };
        
        // In a more advanced implementation, this could include:
        // - Face landmark detection
        // - Body pose estimation
        // - Color analysis
        // - etc.
        
        return avatarData;
    }
    
    /**
     * Draw the current avatar to the canvas
     * @private
     */
    _drawAvatarToCanvas() {
        if (!this.canvas || !this.cutoutImage) {
            return;
        }
        
        // Set up the canvas
        this.canvas.width = this.cutoutImage.width;
        this.canvas.height = this.cutoutImage.height;
        this.canvas.style.display = 'block';
        
        // Clear the canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw the cutout image
        this.ctx.putImageData(this.cutoutImage, 0, 0);
        
        // Update the data URL in avatar data
        if (this.avatarData) {
            this.avatarData.dataUrl = this.canvas.toDataURL('image/png');
        }
        
        // Hide placeholder if it exists
        const placeholder = document.getElementById('avatar-placeholder');
        if (placeholder) {
            placeholder.style.display = 'none';
        }
        
        // Enable relevant controls
        this._updateControlStates(true);
    }
    
    /**
     * Draw an accessory on the canvas
     * @param {HTMLImageElement} accessoryImg - The accessory image
     * @param {Object} placement - Placement data {x, y, width, height, rotation}
     * @private
     */
    _drawAccessory(accessoryImg, placement) {
        if (!this.canvas || !this.ctx) {
            return;
        }
        
        // Save current state
        this.ctx.save();
        
        // Apply transformations
        this.ctx.translate(placement.x, placement.y);
        if (placement.rotation) {
            this.ctx.rotate(placement.rotation * Math.PI / 180);
        }
        
        // Draw the accessory
        this.ctx.drawImage(
            accessoryImg, 
            -placement.width / 2, 
            -placement.height / 2, 
            placement.width, 
            placement.height
        );
        
        // Restore context
        this.ctx.restore();
        
        // Update the data URL
        if (this.avatarData) {
            this.avatarData.dataUrl = this.canvas.toDataURL('image/png');
        }
    }
    
    /**
     * Calculate placement for clothing items
     * @returns {Object} Placement data
     * @private
     */
    _getClothingPlacement() {
        const { width, height } = this.canvas;
        const bodyHeight = height * 0.4; // 40% of image height
        
        return {
            x: width / 2,
            y: height * 0.55, // Centered in the lower half
            width: width * 0.85,
            height: bodyHeight,
            rotation: 0
        };
    }
    
    /**
     * Calculate placement for hat items
     * @returns {Object} Placement data
     * @private
     */
    _getHatPlacement() {
        const { width, height } = this.canvas;
        
        return {
            x: width / 2,
            y: height * 0.15, // Top area of image
            width: width * 0.6,
            height: height * 0.25,
            rotation: 0
        };
    }
    
    /**
     * Calculate placement for glasses items
     * @returns {Object} Placement data
     * @private
     */
    _getGlassesPlacement() {
        const { width, height } = this.canvas;
        
        return {
            x: width / 2,
            y: height * 0.28, // Eye level (approx)
            width: width * 0.5,
            height: height * 0.15,
            rotation: 0
        };
    }
    
    /**
     * Calculate placement for jewelry items
     * @returns {Object} Placement data
     * @private
     */
    _getJewelryPlacement() {
        const { width, height } = this.canvas;
        
        return {
            x: width / 2,
            y: height * 0.35, // Neck area
            width: width * 0.4,
            height: height * 0.2,
            rotation: 0
        };
    }
    
    /**
     * Calculate center placement for general items
     * @returns {Object} Placement data
     * @private
     */
    _getCenterPlacement() {
        const { width, height } = this.canvas;
        
        return {
            x: width / 2,
            y: height / 2,
            width: width * 0.5,
            height: height * 0.5,
            rotation: 0
        };
    }
    
    /**
     * Save current avatar to local storage
     * @private
     */
    _saveAvatarToStorage() {
        if (!this.avatarData) {
            return;
        }
        
        try {
            localStorage.setItem(
                CONFIG.storage.avatarKey,
                JSON.stringify(this.avatarData)
            );
        } catch (error) {
            console.error('Error saving avatar to storage:', error);
            
            // If local storage is full, show a warning
            if (error.name === 'QuotaExceededError') {
                this._updateStatus('Warning: Local storage is full. Your avatar will not be saved.');
            }
        }
    }
    
    /**
     * Load an image from a URL
     * @param {string} url - Image URL or data URL
     * @returns {Promise<HTMLImageElement>} Loaded image
     * @private
     */
    _loadImage(url) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = (error) => reject(error);
            img.src = url;
        });
    }
    
    /**
     * Update control states based on avatar availability
     * @param {boolean} hasAvatar - Whether an avatar is available
     * @private
     */
    _updateControlStates(hasAvatar) {
        // Enable/disable buttons based on avatar availability
        const resetButton = document.getElementById('reset-avatar-btn');
        const downloadButton = document.getElementById('download-avatar-btn');
        const clearButton = document.getElementById('clear-accessories-btn');
        const saveButton = document.getElementById('save-look-btn');
        
        if (resetButton) resetButton.disabled = !hasAvatar;
        if (downloadButton) downloadButton.disabled = !hasAvatar;
        if (clearButton) clearButton.disabled = !hasAvatar;
        if (saveButton) saveButton.disabled = !hasAvatar;
    }
    
    /**
     * Update progress with a percentage value
     * @param {number} value - Progress percentage (0-100)
     * @private
     */
    _updateProgress(value) {
        if (this.onProgress) {
            this.onProgress(value);
        }
        
        // Update UI progress element if it exists
        const progressIndicator = document.getElementById('progress-indicator');
        if (progressIndicator) {
            progressIndicator.style.width = `${value}%`;
        }
    }
    
    /**
     * Update status with a message
     * @param {string} message - Status message
     * @private
     */
    _updateStatus(message) {
        if (this.onStatusChange) {
            this.onStatusChange(message);
        }
        
        // Update UI status element if it exists
        const progressStatus = document.getElementById('progress-status');
        if (progressStatus) {
            progressStatus.textContent = message;
        }
        
        if (CONFIG.debug.enabled) {
            console.log(`Avatar Generator: ${message}`);
        }
    }
}

// Create a global instance
window.avatarGenerator = new AvatarGenerator();