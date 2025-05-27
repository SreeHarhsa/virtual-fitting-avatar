/**
 * Utility functions for Virtual Fitting Avatar
 * 
 * This module provides helper functions used across the application.
 */

/**
 * Utility for debouncing function calls
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @param {boolean} immediate - Whether to call immediately
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300, immediate = false) {
    let timeout;
    return function() {
        const context = this;
        const args = arguments;
        
        const later = function() {
            timeout = null;
            if (!immediate) func.apply(context, args);
        };
        
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        
        if (callNow) func.apply(context, args);
    };
}

/**
 * Utility for throttling function calls
 * @param {Function} func - Function to throttle
 * @param {number} limit - Minimum time between calls in milliseconds
 * @returns {Function} Throttled function
 */
function throttle(func, limit = 300) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Format a date into a human-readable string
 * @param {string|Date} date - Date to format
 * @param {Object} options - Intl.DateTimeFormat options
 * @returns {string} Formatted date string
 */
function formatDate(date, options = {}) {
    const defaultOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    };
    
    const finalOptions = { ...defaultOptions, ...options };
    return new Intl.DateTimeFormat('en-US', finalOptions).format(new Date(date));
}

/**
 * Generate a unique ID
 * @param {string} prefix - Optional prefix for the ID
 * @returns {string} Unique ID
 */
function generateId(prefix = '') {
    return `${prefix}${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Check if local storage is available and has space
 * @param {number} sizeEstimateBytes - Estimated size in bytes
 * @returns {boolean} True if storage is available with sufficient space
 */
function isStorageAvailable(sizeEstimateBytes = 0) {
    try {
        const test = 'test';
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        
        // Check for available space
        if (sizeEstimateBytes > 0) {
            // Calculate rough estimate of used space
            let usedSpace = 0;
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                usedSpace += localStorage.getItem(key).length * 2; // UTF-16 encoding
            }
            
            // Check if remaining space is sufficient
            const estimatedAvailable = CONFIG.storage.maxLocalStorageSize - usedSpace;
            return estimatedAvailable >= sizeEstimateBytes;
        }
        
        return true;
    } catch (e) {
        return false;
    }
}

/**
 * Load an image from a URL and return as HTMLImageElement
 * @param {string} url - Image URL or Data URL
 * @returns {Promise<HTMLImageElement>} Loaded image
 */
function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
        img.src = url;
    });
}

/**
 * Resize an image to fit within maximum dimensions while maintaining aspect ratio
 * @param {HTMLImageElement} img - Image to resize
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @returns {HTMLCanvasElement} Canvas with the resized image
 */
function resizeImage(img, maxWidth = 800, maxHeight = 800) {
    const canvas = document.createElement('canvas');
    let width = img.width;
    let height = img.height;
    
    // Calculate the new dimensions
    if (width > height) {
        if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
        }
    } else {
        if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
        }
    }
    
    // Set canvas dimensions
    canvas.width = width;
    canvas.height = height;
    
    // Draw the resized image
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, width, height);
    
    return canvas;
}

/**
 * Convert canvas to a Blob
 * @param {HTMLCanvasElement} canvas - Canvas to convert
 * @param {string} type - MIME type
 * @param {number} quality - Image quality (0-1)
 * @returns {Promise<Blob>} Image blob
 */
function canvasToBlob(canvas, type = 'image/jpeg', quality = 0.85) {
    return new Promise((resolve) => {
        canvas.toBlob((blob) => {
            resolve(blob);
        }, type, quality);
    });
}

/**
 * Convert a data URL to a Blob
 * @param {string} dataUrl - Data URL to convert
 * @returns {Blob} Converted blob
 */
function dataUrlToBlob(dataUrl) {
    const arr = dataUrl.split(',');
    const mime = arr[0].match(/:(.*?);/)[1];
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    
    return new Blob([u8arr], { type: mime });
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {string} type - Notification type ('success', 'error', 'info', 'warning')
 * @param {number} duration - Duration in milliseconds
 */
function showToast(message, type = 'info', duration = 3000) {
    // Remove any existing toast
    const existingToast = document.querySelector('.toast');
    if (existingToast) {
        existingToast.remove();
    }
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Append to body
    document.body.appendChild(toast);
    
    // Add visible class after a short delay (for animation)
    setTimeout(() => {
        toast.classList.add('visible');
    }, 10);
    
    // Remove after duration
    setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => {
            toast.remove();
        }, 300); // Match the CSS transition time
    }, duration);
}

/**
 * Show a confirmation dialog
 * @param {string} message - Message to display
 * @returns {Promise<boolean>} True if confirmed, false otherwise
 */
function confirmAction(message) {
    return new Promise((resolve) => {
        // For now, use the native confirm dialog
        const result = confirm(message);
        resolve(result);
        
        // In a real application, you might implement a custom modal here
    });
}

/**
 * Detect if WebGL is available
 * @returns {boolean} True if WebGL is supported
 */
function detectWebGL() {
    try {
        const canvas = document.createElement('canvas');
        return !!(window.WebGLRenderingContext && 
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
    } catch (e) {
        return false;
    }
}

/**
 * Get a parameter from the URL query string
 * @param {string} name - Parameter name
 * @returns {string|null} Parameter value or null if not found
 */
function getQueryParam(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

/**
 * Format file size into human readable string
 * @param {number} bytes - File size in bytes
 * @returns {string} Formatted file size
 */
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Detect mobile devices
 * @returns {boolean} True if the current device is mobile
 */
function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
}

// Export utilities to global scope
window.utils = {
    debounce,
    throttle,
    formatDate,
    generateId,
    isStorageAvailable,
    loadImage,
    resizeImage,
    canvasToBlob,
    dataUrlToBlob,
    showToast,
    confirmAction,
    detectWebGL,
    getQueryParam,
    formatFileSize,
    isMobileDevice
};