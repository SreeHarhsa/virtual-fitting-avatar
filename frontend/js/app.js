/**
 * Main Application - Coordinates all components of the Virtual Fitting Avatar
 */
class VirtualFittingApp {
    constructor() {
        // App state
        this.isInitialized = false;
        this.appMode = 'standalone'; // 'standalone' or 'api'
        
        // Component references (set by initialize)
        this.ui = null;
        this.camera = null;
        this.avatarGenerator = null;
        this.samClient = null;
        
        // Initialize the app
        this.initialize();
    }
    
    /**
     * Initialize the application and all its components
     */
    async initialize() {
        if (this.isInitialized) return;
        
        console.log('Initializing Virtual Fitting Avatar Application...');
        
        try {
            // Set up error handling
            this._setupErrorHandling();
            
            // Determine application mode
            this._determineAppMode();
            
            // Get component references
            this.ui = window.uiManager;
            this.camera = window.cameraManager;
            this.avatarGenerator = window.avatarGenerator;
            this.samClient = window.samClient;
            
            // Validate that all required components exist
            if (this._validateComponents()) {
                // Initialize camera
                await this.camera.initialize();
                
                // Setup component communication
                this._connectComponents();
                
                // Check for WebGL support
                this._checkWebGLSupport();
                
                // Preload models if in standalone mode
                if (this.appMode === 'standalone') {
                    this._preloadModels();
                }
                
                this.isInitialized = true;
                console.log('Application initialization complete');
            }
        } catch (error) {
            console.error('Error initializing application:', error);
            this._showErrorMessage('Initialization Error', error.message);
        }
    }
    
    /**
     * Set up global error handling
     * @private
     */
    _setupErrorHandling() {
        window.addEventListener('error', (event) => {
            console.error('Unhandled error:', event.error);
            
            // Show user-friendly error message for critical errors
            if (!this.isInitialized) {
                this._showErrorMessage('Application Error', 
                    'An error occurred while initializing the application. Please refresh the page and try again.');
            }
        });
        
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
        });
    }
    
    /**
     * Determine whether to run in standalone or API mode
     * @private
     */
    _determineAppMode() {
        // Check if we should use the API
        const apiAvailable = this._isApiAvailable();
        this.appMode = apiAvailable ? 'api' : 'standalone';
        
        console.log(`Running in ${this.appMode} mode`);
    }
    
    /**
     * Check if the API is available
     * @returns {boolean} True if API is available
     * @private
     */
    _isApiAvailable() {
        // For now, we'll just use the configuration setting
        // In a real app, this would do a quick ping to the API endpoint
        return false;
    }
    
    /**
     * Validate that all required components exist
     * @returns {boolean} True if all components are available
     * @private
     */
    _validateComponents() {
        if (!this.ui) {
            this._showErrorMessage('Missing Component', 'UI Manager is not available');
            return false;
        }
        
        if (!this.camera) {
            console.error('Camera Manager is not available');
            // This isn't critical, we can still use file upload
        }
        
        if (!this.avatarGenerator) {
            this._showErrorMessage('Missing Component', 'Avatar Generator is not available');
            return false;
        }
        
        if (!this.samClient && this.appMode === 'standalone') {
            this._showErrorMessage('Missing Component', 'SAM Client is not available');
            return false;
        }
        
        return true;
    }
    
    /**
     * Connect components for communication
     * @private
     */
    _connectComponents() {
        // Connect avatar generator to UI progress indicators
        if (this.avatarGenerator) {
            // Pass progress updates to UI
            this.avatarGenerator.onProgress = (value) => {
                const progressBar = document.getElementById('progress-indicator');
                if (progressBar) {
                    progressBar.style.width = `${value}%`;
                }
            };
            
            // Pass status updates to UI
            this.avatarGenerator.onStatusChange = (message) => {
                const statusElement = document.getElementById('progress-status');
                if (statusElement) {
                    statusElement.textContent = message;
                }
            };
            
            // Handle avatar generation completion
            this.avatarGenerator.onAvatarGenerated = () => {
                // Close any open modals
                if (this.ui) {
                    this.ui.closeAllModals();
                }
                
                // Navigate to fitting view
                if (this.ui && this.ui.navigateToView) {
                    this.ui.navigateToView('fitting');
                }
            };
        }
        
        // Connect camera to UI
        if (this.camera) {
            // Handle camera errors
            this.camera.onCameraError = (message) => {
                utils.showToast(message, 'error');
            };
        }
    }
    
    /**
     * Check if WebGL is supported for optimal performance
     * @private
     */
    _checkWebGLSupport() {
        const hasWebGL = utils.detectWebGL();
        
        if (!hasWebGL && this.appMode === 'standalone') {
            console.warn('WebGL is not available. Performance may be degraded.');
            utils.showToast(
                'WebGL is not available in your browser. Performance may be limited.',
                'warning',
                8000
            );
        }
    }
    
    /**
     * Preload models in the background
     * @private
     */
    _preloadModels() {
        // Start preloading SAM model
        if (this.samClient) {
            console.log('Preloading SAM model...');
            
            // Initialize in the background
            setTimeout(() => {
                this.samClient.initialize()
                    .then(success => {
                        if (success) {
                            console.log('SAM model preloaded successfully');
                        } else {
                            console.warn('Failed to preload SAM model');
                        }
                    })
                    .catch(error => {
                        console.error('Error preloading SAM model:', error);
                    });
            }, 1000);
        }
    }
    
    /**
     * Show an error message to the user
     * @param {string} title - Error title
     * @param {string} message - Error message
     * @private
     */
    _showErrorMessage(title, message) {
        utils.showToast(`${title}: ${message}`, 'error', 8000);
        console.error(`${title}: ${message}`);
    }
}

// Create the application when the page is loaded
window.addEventListener('load', () => {
    window.virtualFittingApp = new VirtualFittingApp();
});