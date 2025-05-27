/**
 * SAM Client - Integrates Segment Anything Model (SAM) for image segmentation
 * 
 * This module provides client-side image segmentation using ONNX Runtime
 * to run SAM directly in the browser.
 */
class SAMClient {
    constructor() {
        // Status tracking
        this.isInitialized = false;
        this.isLoading = false;
        this.progress = 0;
        
        // Model components
        this.session = null;
        this.encoderSession = null;
        
        // Current state
        this.currentEmbedding = null;
        this.currentImageData = null;
        this.currentMasks = null;
        
        // Constants
        this.MASK_THRESHOLD = 0.0;
        this.IMAGE_SIZE = 1024;
        this.INPUT_SIZE = 256; // Size for decoder input mask
        
        // Event handlers
        this.onProgress = null;
        this.onStatusChange = null;
    }
    
    /**
     * Initialize SAM model
     * @returns {Promise<boolean>} True if initialization was successful
     */
    async initialize() {
        if (this.isInitialized) return true;
        if (this.isLoading) return false;
        
        try {
            this.isLoading = true;
            this._updateStatus('Loading SAM model...');
            this._updateProgress(0);
            
            // Check for WebGPU support if configured
            if (CONFIG.sam.useWebGPU && 'gpu' in navigator) {
                CONFIG.sam.executionProvider = 'webgpu';
            }
            
            // Initialize ONNX Runtime session
            if (!ort) {
                throw new Error('ONNX Runtime not found. Please include ort.js in your project.');
            }
            
            // Set execution providers
            const sessionOptions = {
                executionProviders: [CONFIG.sam.executionProvider],
                graphOptimizationLevel: 'all'
            };

            // Load the encoder model first (used for image embeddings)
            this._updateStatus('Loading encoder model...');
            this._updateProgress(20);
            this.encoderSession = await ort.InferenceSession.create(
                CONFIG.sam.encoderUrl,
                sessionOptions
            );
            
            // Load the decoder model (used for mask generation)
            this._updateStatus('Loading decoder model...');
            this._updateProgress(60);
            this.session = await ort.InferenceSession.create(
                CONFIG.sam.modelUrl,
                sessionOptions
            );
            
            this._updateProgress(100);
            this._updateStatus('SAM model loaded successfully');
            
            this.isInitialized = true;
            this.isLoading = false;
            
            return true;
        } catch (error) {
            this._updateStatus(`Error loading SAM model: ${error.message}`);
            console.error('SAM Initialization Error:', error);
            
            this.isInitialized = false;
            this.isLoading = false;
            
            return false;
        }
    }
    
    /**
     * Generate an embedding for the input image
     * @param {HTMLImageElement|ImageData} image - Input image
     * @returns {Promise<Float32Array>} Image embedding tensor
     */
    async generateEmbedding(image) {
        if (!this.isInitialized) {
            await this.initialize();
        }
        
        try {
            this._updateStatus('Generating image embedding...');
            this._updateProgress(0);
            
            // Prepare image for the model
            const imageData = this._prepareImage(image);
            this.currentImageData = imageData;
            
            // Create tensor
            const imageTensor = new ort.Tensor(
                'float32',
                new Float32Array(imageData.data),
                [1, 3, this.IMAGE_SIZE, this.IMAGE_SIZE]
            );
            
            this._updateProgress(30);
            
            // Run encoder inference
            const encoderInputs = { image: imageTensor };
            const encoderOutputs = await this.encoderSession.run(encoderInputs);
            
            // Store the embedding for later use
            const embedding = encoderOutputs.embedding;
            this.currentEmbedding = embedding;
            
            this._updateProgress(100);
            this._updateStatus('Image embedding generated successfully');
            
            return embedding;
        } catch (error) {
            this._updateStatus(`Error generating embedding: ${error.message}`);
            console.error('SAM Embedding Error:', error);
            throw error;
        }
    }
    
    /**
     * Generate a mask from a point prompt
     * @param {Array} point - [x, y] coordinates (0-1 range)
     * @param {number} pointLabel - 1 for foreground, 0 for background
     * @returns {Promise<ImageData>} Segmentation mask
     */
    async generateMaskFromPoint(point, pointLabel = 1) {
        if (!this.currentEmbedding) {
            throw new Error('No image embedding available. Call generateEmbedding first.');
        }
        
        try {
            this._updateStatus('Generating segmentation mask...');
            this._updateProgress(0);
            
            // Scale point to image coordinates
            const scaledPoint = [
                point[0] * this.IMAGE_SIZE,
                point[1] * this.IMAGE_SIZE
            ];
            
            // Prepare inputs for the model
            const pointCoords = new ort.Tensor(
                'float32',
                new Float32Array([scaledPoint[0], scaledPoint[1]]),
                [1, 1, 2]
            );
            
            const pointLabels = new ort.Tensor(
                'float32',
                new Float32Array([pointLabel]),
                [1, 1]
            );
            
            // Create an empty mask input
            const maskInput = new ort.Tensor(
                'float32',
                new Float32Array(this.INPUT_SIZE * this.INPUT_SIZE).fill(0),
                [1, 1, this.INPUT_SIZE, this.INPUT_SIZE]
            );
            
            // Whether this is the first mask
            const hasPromptMask = new ort.Tensor('float32', new Float32Array([0]), [1]);
            
            // Make a default box with the entire image
            const onnxBox = new ort.Tensor(
                'float32', 
                new Float32Array([0, 0, 1024, 1024]), 
                [1, 4]
            );
            
            this._updateProgress(30);
            
            // Run the segmentation model
            const inputs = {
                image_embeddings: this.currentEmbedding,
                point_coords: pointCoords,
                point_labels: pointLabels,
                mask_input: maskInput,
                has_mask_input: hasPromptMask,
                orig_im_size: new ort.Tensor('float32', new Float32Array([this.IMAGE_SIZE, this.IMAGE_SIZE]), [2]),
                onnx_box: onnxBox
            };
            
            this._updateProgress(60);
            
            // Run the model
            const outputs = await this.session.run(inputs);
            
            // Process the mask output
            const masks = outputs.masks.data;
            const scores = outputs.iou_predictions.data;
            
            this._updateProgress(90);
            
            // Convert the highest-scoring mask to image data
            let highestScore = -Infinity;
            let bestMaskIndex = 0;
            
            for (let i = 0; i < scores.length; i++) {
                if (scores[i] > highestScore) {
                    highestScore = scores[i];
                    bestMaskIndex = i;
                }
            }
            
            const maskData = this._createMaskImageData(
                masks, 
                bestMaskIndex, 
                this.INPUT_SIZE
            );
            
            this.currentMasks = { data: masks, scores: scores };
            
            this._updateProgress(100);
            this._updateStatus('Mask generated successfully');
            
            return maskData;
        } catch (error) {
            this._updateStatus(`Error generating mask: ${error.message}`);
            console.error('SAM Mask Error:', error);
            throw error;
        }
    }
    
    /**
     * Generate a mask from a bounding box
     * @param {Array} box - [x1, y1, x2, y2] coordinates (0-1 range)
     * @returns {Promise<ImageData>} Segmentation mask
     */
    async generateMaskFromBox(box) {
        if (!this.currentEmbedding) {
            throw new Error('No image embedding available. Call generateEmbedding first.');
        }
        
        try {
            this._updateStatus('Generating segmentation mask from box...');
            this._updateProgress(0);
            
            // Scale box to image coordinates
            const scaledBox = [
                box[0] * this.IMAGE_SIZE,
                box[1] * this.IMAGE_SIZE,
                box[2] * this.IMAGE_SIZE,
                box[3] * this.IMAGE_SIZE,
            ];
            
            // Prepare point coordinates (empty for box-only prompts)
            const pointCoords = new ort.Tensor(
                'float32',
                new Float32Array([0, 0]),
                [1, 1, 2]
            );
            
            // Empty point labels
            const pointLabels = new ort.Tensor(
                'float32',
                new Float32Array([0]),
                [1, 1]
            );
            
            // Create an empty mask input
            const maskInput = new ort.Tensor(
                'float32',
                new Float32Array(this.INPUT_SIZE * this.INPUT_SIZE).fill(0),
                [1, 1, this.INPUT_SIZE, this.INPUT_SIZE]
            );
            
            // Whether this is the first mask
            const hasPromptMask = new ort.Tensor('float32', new Float32Array([0]), [1]);
            
            // Create onnx box input tensor
            const onnxBox = new ort.Tensor(
                'float32', 
                new Float32Array(scaledBox), 
                [1, 4]
            );
            
            this._updateProgress(30);
            
            // Run the segmentation model
            const inputs = {
                image_embeddings: this.currentEmbedding,
                point_coords: pointCoords,
                point_labels: pointLabels,
                mask_input: maskInput,
                has_mask_input: hasPromptMask,
                orig_im_size: new ort.Tensor('float32', new Float32Array([this.IMAGE_SIZE, this.IMAGE_SIZE]), [2]),
                onnx_box: onnxBox
            };
            
            this._updateProgress(60);
            
            // Run the model
            const outputs = await this.session.run(inputs);
            
            // Process the mask output
            const masks = outputs.masks.data;
            const scores = outputs.iou_predictions.data;
            
            this._updateProgress(90);
            
            // Convert the highest-scoring mask to image data
            let highestScore = -Infinity;
            let bestMaskIndex = 0;
            
            for (let i = 0; i < scores.length; i++) {
                if (scores[i] > highestScore) {
                    highestScore = scores[i];
                    bestMaskIndex = i;
                }
            }
            
            const maskData = this._createMaskImageData(
                masks, 
                bestMaskIndex, 
                this.INPUT_SIZE
            );
            
            this.currentMasks = { data: masks, scores: scores };
            
            this._updateProgress(100);
            this._updateStatus('Mask generated successfully');
            
            return maskData;
        } catch (error) {
            this._updateStatus(`Error generating mask from box: ${error.message}`);
            console.error('SAM Box Mask Error:', error);
            throw error;
        }
    }
    
    /**
     * Apply a human-focused auto segmentation using a combination of techniques
     * @param {HTMLImageElement|ImageData} image - Input image
     * @returns {Promise<ImageData>} Human segmentation mask
     */
    async autoSegmentHuman(image) {
        try {
            // First generate the embedding
            await this.generateEmbedding(image);
            
            // For human segmentation, we'll use a box in the center of the image
            // This is a simple heuristic but works well for portrait photos
            const centerBox = [0.1, 0.1, 0.9, 0.95]; // [x1, y1, x2, y2] in 0-1 range
            
            // Generate mask from this box
            const maskData = await this.generateMaskFromBox(centerBox);
            
            return maskData;
        } catch (error) {
            this._updateStatus(`Error with auto segmentation: ${error.message}`);
            console.error('SAM Auto Segmentation Error:', error);
            throw error;
        }
    }
    
    /**
     * Apply the current mask to the original image
     * @param {string} mode - 'cutout', 'highlight', 'background'
     * @param {string} backgroundColor - CSS color for the background if mode is 'cutout'
     * @returns {ImageData} Processed image with mask applied
     */
    applyMaskToImage(mode = 'cutout', backgroundColor = 'rgba(0,0,0,0)') {
        if (!this.currentImageData || !this.currentMasks) {
            throw new Error('No image or mask available');
        }
        
        const { data, width, height } = this.currentImageData;
        const masks = this.currentMasks.data;
        const bestMaskIndex = 0; // We use the first mask by default
        
        // Create a new ImageData for the result
        const resultData = new Uint8ClampedArray(width * height * 4);
        
        // Parse background color
        let bgRed = 0, bgGreen = 0, bgBlue = 0, bgAlpha = 0;
        
        if (mode === 'cutout') {
            // Parse CSS color to RGBA
            const tempCanvas = document.createElement('canvas');
            const tempCtx = tempCanvas.getContext('2d');
            tempCtx.fillStyle = backgroundColor;
            tempCtx.fillRect(0, 0, 1, 1);
            const bgColor = tempCtx.getImageData(0, 0, 1, 1).data;
            [bgRed, bgGreen, bgBlue, bgAlpha] = bgColor;
        }
        
        // Calculate the scaling factor between mask size and image size
        const maskSize = this.INPUT_SIZE;
        const scaleX = width / maskSize;
        const scaleY = height / maskSize;
        
        // Apply the mask to the image
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const imgIndex = (y * width + x) * 4;
                
                // Calculate corresponding position in the mask
                const maskX = Math.min(Math.floor(x / scaleX), maskSize - 1);
                const maskY = Math.min(Math.floor(y / scaleY), maskSize - 1);
                const maskIndex = maskY * maskSize + maskX;
                
                // Get mask value and check if it exceeds threshold
                const maskValue = masks[maskIndex + bestMaskIndex * maskSize * maskSize];
                const isMasked = maskValue > this.MASK_THRESHOLD;
                
                // Set pixel values based on mode
                if (mode === 'cutout') {
                    if (isMasked) {
                        // Keep the original image pixel
                        resultData[imgIndex] = data[imgIndex];
                        resultData[imgIndex + 1] = data[imgIndex + 1];
                        resultData[imgIndex + 2] = data[imgIndex + 2];
                        resultData[imgIndex + 3] = data[imgIndex + 3];
                    } else {
                        // Use background color
                        resultData[imgIndex] = bgRed;
                        resultData[imgIndex + 1] = bgGreen;
                        resultData[imgIndex + 2] = bgBlue;
                        resultData[imgIndex + 3] = bgAlpha;
                    }
                } else if (mode === 'highlight') {
                    // Copy original pixel
                    resultData[imgIndex] = data[imgIndex];
                    resultData[imgIndex + 1] = data[imgIndex + 1];
                    resultData[imgIndex + 2] = data[imgIndex + 2];
                    resultData[imgIndex + 3] = data[imgIndex + 3];
                    
                    // Highlight masked areas
                    if (isMasked) {
                        resultData[imgIndex] = Math.min(255, data[imgIndex] + 30);
                        resultData[imgIndex + 3] = 255; // Full opacity
                    } else {
                        // Dim non-masked areas
                        resultData[imgIndex] = data[imgIndex] * 0.6;
                        resultData[imgIndex + 1] = data[imgIndex + 1] * 0.6;
                        resultData[imgIndex + 2] = data[imgIndex + 2] * 0.6;
                    }
                } else if (mode === 'background') {
                    // Blur or modify the background
                    if (isMasked) {
                        // Keep foreground as is
                        resultData[imgIndex] = data[imgIndex];
                        resultData[imgIndex + 1] = data[imgIndex + 1];
                        resultData[imgIndex + 2] = data[imgIndex + 2];
                        resultData[imgIndex + 3] = data[imgIndex + 3];
                    } else {
                        // Dim and blue-tint the background
                        resultData[imgIndex] = data[imgIndex] * 0.3;
                        resultData[imgIndex + 1] = data[imgIndex + 1] * 0.3;
                        resultData[imgIndex + 2] = Math.min(255, data[imgIndex + 2] * 0.7 + 50);
                        resultData[imgIndex + 3] = data[imgIndex + 3];
                    }
                }
            }
        }
        
        return new ImageData(resultData, width, height);
    }
    
    /**
     * Get the current mask data
     * @returns {ImageData|null} The current mask as ImageData or null if none exists
     */
    getCurrentMask() {
        if (!this.currentMasks) return null;
        
        return this._createMaskImageData(
            this.currentMasks.data,
            0, // Best mask index
            this.INPUT_SIZE
        );
    }
    
    /**
     * Prepare image for SAM model
     * @param {HTMLImageElement|ImageData} image - Input image
     * @returns {ImageData} Processed image data
     */
    _prepareImage(image) {
        const canvas = document.createElement('canvas');
        canvas.width = this.IMAGE_SIZE;
        canvas.height = this.IMAGE_SIZE;
        const ctx = canvas.getContext('2d');
        
        // Draw and resize the image
        if (image instanceof HTMLImageElement) {
            // Calculate scaling to maintain aspect ratio
            const scale = Math.min(
                this.IMAGE_SIZE / image.width,
                this.IMAGE_SIZE / image.height
            );
            
            // Calculate dimensions
            const scaledWidth = image.width * scale;
            const scaledHeight = image.height * scale;
            
            // Center the image
            const offsetX = (this.IMAGE_SIZE - scaledWidth) / 2;
            const offsetY = (this.IMAGE_SIZE - scaledHeight) / 2;
            
            // Fill with black background
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, this.IMAGE_SIZE, this.IMAGE_SIZE);
            
            // Draw the image centered
            ctx.drawImage(image, offsetX, offsetY, scaledWidth, scaledHeight);
        } else {
            // If it's already ImageData, draw it directly
            ctx.putImageData(image, 0, 0);
        }
        
        const imageData = ctx.getImageData(0, 0, this.IMAGE_SIZE, this.IMAGE_SIZE);
        
        // Convert to RGB format with normalization expected by the model
        const { data } = imageData;
        const rgbData = new Float32Array(3 * this.IMAGE_SIZE * this.IMAGE_SIZE);
        
        // Normalize pixel values
        for (let i = 0; i < this.IMAGE_SIZE * this.IMAGE_SIZE; i++) {
            const pixelStart = i * 4;
            const rgbStart = i;
            
            // Re-order from RGBA to RGB and normalize to [0, 1]
            rgbData[rgbStart] = data[pixelStart] / 255.0;
            rgbData[rgbStart + this.IMAGE_SIZE * this.IMAGE_SIZE] = data[pixelStart + 1] / 255.0;
            rgbData[rgbStart + 2 * this.IMAGE_SIZE * this.IMAGE_SIZE] = data[pixelStart + 2] / 255.0;
        }
        
        // Return the original ImageData for reference
        const result = {
            data: rgbData,
            tensor: imageData,
            width: this.IMAGE_SIZE,
            height: this.IMAGE_SIZE,
            originalAspectRatio: image instanceof HTMLImageElement ? image.width / image.height : 1
        };
        
        return result;
    }
    
    /**
     * Create an ImageData object from mask output
     * @param {Float32Array} masks - Mask data from model output
     * @param {number} maskIndex - Index of the mask to use
     * @param {number} maskSize - Size of the mask
     * @returns {ImageData} Mask as ImageData
     */
    _createMaskImageData(masks, maskIndex, maskSize) {
        const rgba = new Uint8ClampedArray(maskSize * maskSize * 4);
        
        for (let i = 0; i < maskSize * maskSize; i++) {
            const maskValue = masks[i + maskIndex * maskSize * maskSize];
            const isMasked = maskValue > this.MASK_THRESHOLD;
            
            // Use the configured mask colors
            const color = isMasked ? CONFIG.sam.maskColors.person : CONFIG.sam.maskColors.background;
            
            const pixelStart = i * 4;
            rgba[pixelStart] = color[0];     // R
            rgba[pixelStart + 1] = color[1]; // G
            rgba[pixelStart + 2] = color[2]; // B
            rgba[pixelStart + 3] = color[3]; // A
        }
        
        return new ImageData(rgba, maskSize, maskSize);
    }
    
    /**
     * Update current progress
     * @param {number} value - Progress value (0-100)
     * @private
     */
    _updateProgress(value) {
        this.progress = value;
        if (this.onProgress) {
            this.onProgress(value);
        }
    }
    
    /**
     * Update status message
     * @param {string} message - Status message
     * @private
     */
    _updateStatus(message) {
        if (this.onStatusChange) {
            this.onStatusChange(message);
        }
        
        if (CONFIG.debug.enabled) {
            console.log(`SAM: ${message}`);
        }
    }
    
    /**
     * Clean up resources
     */
    dispose() {
        try {
            if (this.session) {
                this.session.release();
                this.session = null;
            }
            
            if (this.encoderSession) {
                this.encoderSession.release();
                this.encoderSession = null;
            }
            
            this.currentEmbedding = null;
            this.currentImageData = null;
            this.currentMasks = null;
            this.isInitialized = false;
            
            console.log('SAM resources released');
        } catch (error) {
            console.error('Error disposing SAM resources:', error);
        }
    }
}

// Create a global instance
window.samClient = new SAMClient();