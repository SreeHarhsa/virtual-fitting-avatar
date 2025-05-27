import os
import time
import base64
import logging
import tempfile
from io import BytesIO
from PIL import Image
import numpy as np
import cv2
import json

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

# Local imports
from sam_processor import SAMProcessor
from avatar_generator import AvatarGenerator
from virtual_fitting import VirtualFitter

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Initialize Flask app
app = Flask(__name__, static_folder='../frontend')
CORS(app)  # Enable CORS for all routes

# Initialize processors
sam_processor = None
avatar_generator = None
virtual_fitter = None

# In-memory cache for avatars and accessories
avatars_cache = {}
accessories_cache = {}

# Constants
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB max file size

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.before_first_request
def initialize_models():
    global sam_processor, avatar_generator, virtual_fitter
    try:
        logger.info("Initializing SAM processor...")
        sam_processor = SAMProcessor()
        
        logger.info("Initializing avatar generator...")
        avatar_generator = AvatarGenerator()
        
        logger.info("Initializing virtual fitter...")
        virtual_fitter = VirtualFitter()
        
        logger.info("All models initialized successfully")
    except Exception as e:
        logger.error(f"Error initializing models: {e}")
        # Continue anyway, so API endpoints can return appropriate errors

@app.route('/')
def index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory(app.static_folder, path)

@app.route('/api/segment', methods=['POST'])
def segment_image():
    if not sam_processor:
        return jsonify({'error': 'SAM processor not initialized'}), 500
    
    try:
        # Get image data from request
        if 'image' in request.files:
            # Handle file upload
            file = request.files['image']
            if not allowed_file(file.filename):
                return jsonify({'error': 'File type not allowed'}), 400
            
            # Read the image
            img = Image.open(file)
            img_array = np.array(img)
        elif request.json and 'image_data' in request.json:
            # Handle base64 encoded image
            image_data = request.json['image_data']
            if image_data.startswith('data:image'):
                # Remove the data URL prefix
                image_data = image_data.split(',')[1]
            
            image_binary = base64.b64decode(image_data)
            img = Image.open(BytesIO(image_binary))
            img_array = np.array(img)
        else:
            return jsonify({'error': 'No image provided'}), 400
        
        # Get optional parameters
        auto_mode = request.json.get('auto_mode', True) if request.json else True
        point = request.json.get('point') if request.json else None
        box = request.json.get('box') if request.json else None
        
        # Process the image with SAM
        if auto_mode:
            mask, masked_img = sam_processor.auto_segment_person(img_array)
        elif point:
            mask, masked_img = sam_processor.segment_from_point(img_array, point)
        elif box:
            mask, masked_img = sam_processor.segment_from_box(img_array, box)
        else:
            return jsonify({'error': 'Must provide point, box, or enable auto_mode'}), 400
        
        # Convert results to base64 for sending back to client
        mask_pil = Image.fromarray((mask * 255).astype(np.uint8))
        masked_img_pil = Image.fromarray(masked_img)
        
        # Save to temporary buffers
        mask_buffer = BytesIO()
        masked_img_buffer = BytesIO()
        
        mask_pil.save(mask_buffer, format='PNG')
        masked_img_pil.save(masked_img_buffer, format='PNG')
        
        # Convert to base64
        mask_base64 = base64.b64encode(mask_buffer.getvalue()).decode('utf-8')
        masked_img_base64 = base64.b64encode(masked_img_buffer.getvalue()).decode('utf-8')
        
        # Generate a unique ID for this segmentation
        segment_id = f"segment_{int(time.time() * 1000)}"
        
        return jsonify({
            'success': True,
            'segment_id': segment_id,
            'mask': f"data:image/png;base64,{mask_base64}",
            'masked_image': f"data:image/png;base64,{masked_img_base64}"
        })
    except Exception as e:
        logger.error(f"Error in segmentation: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/generate-avatar', methods=['POST'])
def generate_avatar():
    if not avatar_generator:
        return jsonify({'error': 'Avatar generator not initialized'}), 500
    
    try:
        # Check if we received the segmented image
        if request.json and 'masked_image' in request.json:
            # Base64 image
            masked_image_data = request.json['masked_image']
            if masked_image_data.startswith('data:image'):
                # Remove the data URL prefix
                masked_image_data = masked_image_data.split(',')[1]
            
            image_binary = base64.b64decode(masked_image_data)
            masked_img = Image.open(BytesIO(image_binary))
            
            # Convert to numpy array
            masked_img_array = np.array(masked_img)
            
        elif 'image' in request.files and 'mask' in request.files:
            # File uploads
            image_file = request.files['image']
            mask_file = request.files['mask']
            
            if not (allowed_file(image_file.filename) and allowed_file(mask_file.filename)):
                return jsonify({'error': 'File type not allowed'}), 400
            
            # Read the images
            image = np.array(Image.open(image_file))
            mask = np.array(Image.open(mask_file).convert('L')) > 0
            
            # Apply the mask
            masked_img_array = avatar_generator.apply_mask(image, mask)
        else:
            return jsonify({'error': 'No image provided'}), 400
        
        # Generate the avatar
        avatar_data = avatar_generator.generate(masked_img_array)
        
        # Generate a unique ID for this avatar
        avatar_id = f"avatar_{int(time.time() * 1000)}"
        
        # Store in cache
        avatars_cache[avatar_id] = avatar_data
        
        # Convert to base64
        avatar_pil = Image.fromarray(avatar_data['image'])
        avatar_buffer = BytesIO()
        avatar_pil.save(avatar_buffer, format='PNG')
        avatar_base64 = base64.b64encode(avatar_buffer.getvalue()).decode('utf-8')
        
        return jsonify({
            'success': True,
            'avatar_id': avatar_id,
            'avatar_image': f"data:image/png;base64,{avatar_base64}",
            'landmarks': avatar_data.get('landmarks', None)
        })
    except Exception as e:
        logger.error(f"Error generating avatar: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/try-on', methods=['POST'])
def try_on_accessory():
    if not virtual_fitter:
        return jsonify({'error': 'Virtual fitter not initialized'}), 500
    
    try:
        data = request.json
        if not data:
            return jsonify({'error': 'No JSON data provided'}), 400
            
        # Get required parameters
        avatar_id = data.get('avatar_id')
        accessory_id = data.get('accessory_id')
        category = data.get('category')
        
        if not all([avatar_id, accessory_id, category]):
            return jsonify({'error': 'Missing required parameters'}), 400
        
        # Check if avatar exists in cache
        if avatar_id not in avatars_cache:
            return jsonify({'error': 'Avatar not found'}), 404
        
        # Get the accessory
        # In a real app, this would fetch from a database
        accessory = get_accessory_by_id(accessory_id, category)
        if not accessory:
            return jsonify({'error': 'Accessory not found'}), 404
        
        # Apply the accessory to the avatar
        avatar_data = avatars_cache[avatar_id]
        result_image = virtual_fitter.apply_accessory(
            avatar_data['image'],
            accessory,
            category,
            avatar_data.get('landmarks')
        )
        
        # Convert to base64
        result_pil = Image.fromarray(result_image)
        result_buffer = BytesIO()
        result_pil.save(result_buffer, format='PNG')
        result_base64 = base64.b64encode(result_buffer.getvalue()).decode('utf-8')
        
        # Update the avatar in cache
        avatar_data['image'] = result_image
        avatars_cache[avatar_id] = avatar_data
        
        return jsonify({
            'success': True,
            'avatar_id': avatar_id,
            'result_image': f"data:image/png;base64,{result_base64}"
        })
    except Exception as e:
        logger.error(f"Error applying accessory: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/accessories', methods=['GET'])
def get_accessories():
    category = request.args.get('category', 'all')
    
    try:
        # In a real app, this would fetch from a database
        if category == 'all':
            accessories = get_all_accessories()
        else:
            accessories = get_accessories_by_category(category)
            
        return jsonify({
            'success': True,
            'accessories': accessories
        })
    except Exception as e:
        logger.error(f"Error getting accessories: {e}")
        return jsonify({'error': str(e)}), 500

# Utility functions

def get_accessory_by_id(accessory_id, category):
    """Get accessory by ID from a specific category"""
    # In a real app, this would fetch from a database
    # For now, return a dummy accessory
    accessory_path = os.path.join('accessories', category, f"{accessory_id}.png")
    
    return {
        'id': accessory_id,
        'name': f"{category.title()} {accessory_id}",
        'category': category,
        'path': accessory_path,
        'image': np.zeros((100, 100, 4), dtype=np.uint8)  # Placeholder image
    }

def get_accessories_by_category(category):
    """Get all accessories for a category"""
    # In a real app, this would fetch from a database
    # For now, return dummy accessories
    return [
        {
            'id': f"{category}1",
            'name': f"{category.title()} 1",
            'category': category,
            'thumbnail': f"/assets/accessories/{category}/{category}1_thumb.png"
        },
        {
            'id': f"{category}2",
            'name': f"{category.title()} 2",
            'category': category,
            'thumbnail': f"/assets/accessories/{category}/{category}2_thumb.png"
        },
        {
            'id': f"{category}3",
            'name': f"{category.title()} 3",
            'category': category,
            'thumbnail': f"/assets/accessories/{category}/{category}3_thumb.png"
        }
    ]

def get_all_accessories():
    """Get all accessories"""
    # Combine accessories from all categories
    categories = ['clothing', 'jewelry', 'hats', 'glasses']
    all_accessories = []
    
    for category in categories:
        all_accessories.extend(get_accessories_by_category(category))
        
    return all_accessories

if __name__ == '__main__':
    # Initialize models on startup
    initialize_models()
    
    debug_mode = os.environ.get('DEBUG', 'False').lower() == 'true'
    host = os.environ.get('HOST', '0.0.0.0')
    port = int(os.environ.get('PORT', 5000))
    
    logger.info(f"Starting server on {host}:{port} (debug: {debug_mode})")
    app.run(host=host, port=port, debug=debug_mode)