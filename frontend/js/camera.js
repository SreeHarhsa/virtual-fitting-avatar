/**
 * Camera Manager - Handles webcam access and image capture
 */
class CameraManager {
    constructor() {
        // DOM elements
        this.videoElement = document.getElementById('webcam');
        this.canvasOverlay = document.getElementById('webcam-overlay');
        
        // Stream and device info
        this.stream = null;
        this.currentFacingMode = CONFIG.camera.facingMode;
        this.availableDevices = [];
        
        // State
        this.isActive = false;
        this.hasPermission = false;
        this.isSupported = 'mediaDevices' in navigator;
        this.isLoading = false;
        
        // Event callbacks
        this.onCameraStart = null;
        this.onCameraStop = null;
        this.onCameraError = null;
        this.onCapture = null;
    }
    
    /**
     * Initialize camera and check for support/permissions
     * @returns {Promise<boolean>} Success status
     */
    async initialize() {
        if (!this.isSupported) {
            this._handleError('Camera access is not supported in your browser.');
            return false;
        }
        
        // Set up event listeners for camera buttons
        this._setupEventListeners();
        
        try {
            // Get list of available devices
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableDevices = devices.filter(device => device.kind === 'videoinput');
            
            // For debugging
            if (CONFIG.debug.enabled) {
                console.log('Available video devices:', this.availableDevices);
            }
            
            return true;
        } catch (error) {
            this._handleError('Error initializing camera: ' + error.message);
            return false;
        }
    }
    
    /**
     * Start the camera
     * @returns {Promise<boolean>} Success status
     */
    async startCamera() {
        if (!this.isSupported) {
            this._handleError('Camera access is not supported in your browser.');
            return false;
        }
        
        if (this.isActive) {
            return true; // Already running
        }
        
        try {
            this.isLoading = true;
            
            // Stop any existing stream
            if (this.stream) {
                this.stopCamera();
            }
            
            // Set up camera constraints
            const constraints = {
                video: {
                    facingMode: this.currentFacingMode,
                    width: { ideal: CONFIG.camera.width },
                    height: { ideal: CONFIG.camera.height },
                    aspectRatio: { ideal: CONFIG.camera.aspectRatio }
                },
                audio: false
            };
            
            // Get the user media stream
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            
            // Connect the stream to the video element
            if (this.videoElement) {
                this.videoElement.srcObject = this.stream;
                
                // Wait for the video to be ready
                await new Promise(resolve => {
                    this.videoElement.onloadedmetadata = () => {
                        this.videoElement.play().then(resolve);
                    };
                });
                
                // Set up the overlay canvas
                if (this.canvasOverlay) {
                    this.canvasOverlay.width = this.videoElement.videoWidth;
                    this.canvasOverlay.height = this.videoElement.videoHeight;
                    
                    // Draw face guide on canvas
                    this._drawFaceGuide();
                }
            }
            
            this.isActive = true;
            this.hasPermission = true;
            this.isLoading = false;
            
            // Call the callback if defined
            if (this.onCameraStart) {
                this.onCameraStart();
            }
            
            // Enable the capture button
            const captureBtn = document.getElementById('capture-btn');
            if (captureBtn) {
                captureBtn.disabled = false;
            }
            
            return true;
        } catch (error) {
            this.isLoading = false;
            
            if (error.name === 'NotAllowedError') {
                this._handleError('Camera access was denied. Please grant camera permissions.');
            } else if (error.name === 'NotFoundError') {
                this._handleError('No camera found. Please connect a camera and try again.');
            } else {
                this._handleError('Error starting camera: ' + error.message);
            }
            
            return false;
        }
    }
    
    /**
     * Stop the camera
     */
    stopCamera() {
        if (this.stream) {
            const tracks = this.stream.getTracks();
            tracks.forEach(track => track.stop());
            this.stream = null;
        }
        
        if (this.videoElement) {
            this.videoElement.srcObject = null;
        }
        
        this.isActive = false;
        
        // Call the callback if defined
        if (this.onCameraStop) {
            this.onCameraStop();
        }
    }
    
    /**
     * Switch between front and back cameras
     * @returns {Promise<boolean>} Success status
     */
    async switchCamera() {
        // Toggle facing mode
        this.currentFacingMode = this.currentFacingMode === 'user' ? 'environment' : 'user';
        
        // Restart the camera
        return await this.startCamera();
    }
    
    /**
     * Capture a still image from the camera
     * @returns {string|null} Data URL of the captured image or null on failure
     */
    captureImage() {
        if (!this.isActive || !this.videoElement) {
            this._handleError('Camera is not active.');
            return null;
        }
        
        try {
            // Create a temporary canvas
            const canvas = document.createElement('canvas');
            const width = this.videoElement.videoWidth;
            const height = this.videoElement.videoHeight;
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw the current video frame on the canvas
            const ctx = canvas.getContext('2d');
            ctx.drawImage(this.videoElement,
                0, 0, width, height,
                0, 0, width, height
            );
            
            // Convert to a data URL
            const dataUrl = canvas.toDataURL('image/png');
            
            // Display the captured image
            const capturedImage = document.getElementById('captured-image');
            const capturePlaceholder = document.getElementById('capture-placeholder');
            
            if (capturedImage) {
                capturedImage.src = dataUrl;
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
            
            // Call the callback if defined
            if (this.onCapture) {
                this.onCapture(dataUrl);
            }
            
            return dataUrl;
        } catch (error) {
            this._handleError('Error capturing image: ' + error.message);
            return null;
        }
    }
    
    /**
     * Draw a face guide on the canvas overlay
     * @private
     */
    _drawFaceGuide() {
        if (!this.canvasOverlay) return;
        
        const canvas = this.canvasOverlay;
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw an oval face guide in the center
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radiusX = canvas.width * 0.25;
        const radiusY = canvas.height * 0.35;
        
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();
        
        // Add text guidance
        ctx.font = '16px Arial';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.textAlign = 'center';
        ctx.fillText('Position your face within the oval', centerX, canvas.height - 30);
    }
    
    /**
     * Set up event listeners for camera buttons
     * @private
     */
    _setupEventListeners() {
        // Capture button
        const captureBtn = document.getElementById('capture-btn');
        if (captureBtn) {
            captureBtn.addEventListener('click', () => {
                this.captureImage();
            });
        }
        
        // Switch camera button
        const switchBtn = document.getElementById('switch-camera-btn');
        if (switchBtn) {
            switchBtn.addEventListener('click', () => {
                this.switchCamera();
            });
            
            // Hide switch button if there's only one camera
            if (this.availableDevices.length <= 1) {
                switchBtn.style.display = 'none';
            }
        }
        
        // Retake button
        const retakeBtn = document.getElementById('retake-btn');
        if (retakeBtn) {
            retakeBtn.addEventListener('click', () => {
                const capturedImage = document.getElementById('captured-image');
                const capturePlaceholder = document.getElementById('capture-placeholder');
                
                if (capturedImage) {
                    capturedImage.src = '';
                    capturedImage.hidden = true;
                }
                
                if (capturePlaceholder) {
                    capturePlaceholder.style.display = 'flex';
                }
                
                retakeBtn.disabled = true;
                
                // Disable the process button
                const processBtn = document.getElementById('process-btn');
                if (processBtn) {
                    processBtn.disabled = true;
                }
            });
        }
    }
    
    /**
     * Handle camera errors
     * @param {string} message - Error message
     * @private
     */
    _handleError(message) {
        console.error(message);
        
        if (this.onCameraError) {
            this.onCameraError(message);
        }
    }
    
    /**
     * Check if the device has a camera
     * @returns {Promise<boolean>} True if the device has a camera
     */
    static async hasCamera() {
        if (!('mediaDevices' in navigator) || !('enumerateDevices' in navigator.mediaDevices)) {
            return false;
        }
        
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            return devices.some(device => device.kind === 'videoinput');
        } catch (error) {
            console.error('Error checking for camera:', error);
            return false;
        }
    }
}

// Create a global instance
window.cameraManager = new CameraManager();