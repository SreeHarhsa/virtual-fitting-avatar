/**
 * Configuration settings for Virtual Fitting Avatar
 */
const CONFIG = {
    // API endpoints
    api: {
        baseUrl: 'http://localhost:5000/api',
        endpoints: {
            segment: '/segment',
            generateAvatar: '/generate-avatar',
            tryOn: '/try-on',
            accessories: '/accessories'
        }
    },
    
    // SAM model configuration
    sam: {
        modelUrl: './models/sam_vit_h_4b8939.onnx',
        encoderUrl: './models/sam_vit_h_4b8939_encoder.onnx',
        quantizedUrl: './models/sam_vit_h_4b8939_quantized.onnx', // Optional quantized version
        useWebGPU: false, // Set to true to use WebGPU when available
        executionProvider: 'wasm', // 'wasm', 'webgl', 'webgpu'
        maskColors: {
            person: [255, 0, 0, 127],
            background: [0, 0, 0, 0],
            uncertainty: [255, 165, 0, 127]
        }
    },
    
    // Camera settings
    camera: {
        width: 640,
        height: 480,
        facingMode: 'user', // 'user' or 'environment'
        aspectRatio: 4/3
    },
    
    // Image processing settings
    imageProcessing: {
        maxWidth: 1024,
        maxHeight: 1024,
        jpegQuality: 0.85,
        processingStages: [
            { name: 'Segmenting image with SAM...', percentage: 30 },
            { name: 'Extracting features...', percentage: 50 },
            { name: 'Generating avatar...', percentage: 70 },
            { name: 'Finalizing...', percentage: 90 },
            { name: 'Complete!', percentage: 100 }
        ]
    },
    
    // UI settings
    ui: {
        theme: {
            default: 'light',
            storageKey: 'vfa-theme-preference'
        },
        transitions: {
            duration: 300
        },
        debounceDelay: 250,
        loadingDelay: 500
    },
    
    // Storage settings
    storage: {
        avatarKey: 'vfa-current-avatar',
        savedLooksKey: 'vfa-saved-looks',
        settingsKey: 'vfa-user-settings',
        maxLocalStorageSize: 10 * 1024 * 1024 // 10 MB limit for localStorage
    },
    
    // Default accessory categories
    accessoryCategories: [
        { id: 'clothing', label: 'Clothing', icon: 'fa-tshirt' },
        { id: 'jewelry', label: 'Jewelry', icon: 'fa-gem' },
        { id: 'hats', label: 'Hats', icon: 'fa-hat-cowboy' },
        { id: 'glasses', label: 'Glasses', icon: 'fa-glasses' }
    ],
    
    // Demo mode settings (used when backend is not available)
    demoMode: {
        enabled: true,
        sampleAccessories: {
            clothing: [
                { id: 'c1', name: 'T-Shirt', image: './assets/accessories/clothing/tshirt.png' },
                { id: 'c2', name: 'Jacket', image: './assets/accessories/clothing/jacket.png' },
                { id: 'c3', name: 'Dress', image: './assets/accessories/clothing/dress.png' },
                { id: 'c4', name: 'Sweater', image: './assets/accessories/clothing/sweater.png' }
            ],
            jewelry: [
                { id: 'j1', name: 'Necklace', image: './assets/accessories/jewelry/necklace.png' },
                { id: 'j2', name: 'Earrings', image: './assets/accessories/jewelry/earrings.png' },
                { id: 'j3', name: 'Bracelet', image: './assets/accessories/jewelry/bracelet.png' }
            ],
            hats: [
                { id: 'h1', name: 'Baseball Cap', image: './assets/accessories/hats/baseball.png' },
                { id: 'h2', name: 'Beanie', image: './assets/accessories/hats/beanie.png' },
                { id: 'h3', name: 'Sun Hat', image: './assets/accessories/hats/sunhat.png' }
            ],
            glasses: [
                { id: 'g1', name: 'Sunglasses', image: './assets/accessories/glasses/sunglasses.png' },
                { id: 'g2', name: 'Reading', image: './assets/accessories/glasses/reading.png' },
                { id: 'g3', name: 'Fashion', image: './assets/accessories/glasses/fashion.png' }
            ]
        }
    },
    
    // Debug settings
    debug: {
        enabled: true,                  // Set to false in production
        logLevel: 'info',               // 'debug', 'info', 'warn', 'error'
        showFps: false,                 // Show FPS counter when using WebGL/canvas
        simulateSlowNetwork: false,     // Add artificial delay to API calls
        simulateNetworkDelay: 1000      // Delay in milliseconds
    }
};