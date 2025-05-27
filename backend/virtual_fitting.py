import cv2
import numpy as np
import logging
import os
import json
from enum import Enum
from PIL import Image

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AccessoryType(Enum):
    """Types of accessories for virtual fitting"""
    CLOTHING = "clothing"
    JEWELRY = "jewelry"
    GLASSES = "glasses"
    HATS = "hats"
    WATCHES = "watches"
    OTHER = "other"

class VirtualFitter:
    """
    Apply accessories to avatars using image processing and landmarks
    """
    
    def __init__(self, accessories_dir="accessories"):
        """
        Initialize virtual fitter
        
        Args:
            accessories_dir: Directory containing accessory images
        """
        self.accessories_dir = accessories_dir
        self.accessory_cache = {}
        
        # Create accessories directory if it doesn't exist
        os.makedirs(accessories_dir, exist_ok=True)
        for category in [a.value for a in AccessoryType]:
            os.makedirs(os.path.join(accessories_dir, category), exist_ok=True)
        
        logger.info("Virtual fitter initialized")
    
    def apply_accessory(self, avatar_image, accessory, category, landmarks=None):
        """
        Apply an accessory to an avatar
        
        Args:
            avatar_image: RGBA avatar image
            accessory: Accessory data or image
            category: Category of the accessory
            landmarks: Avatar face and body landmarks
            
        Returns:
            RGBA image with accessory applied
        """
        logger.info(f"Applying {category} accessory to avatar")
        
        # Make sure inputs are valid
        if avatar_image is None:
            raise ValueError("Avatar image is required")
        
        if accessory is None:
            raise ValueError("Accessory data is required")
        
        try:
            category_enum = AccessoryType(category)
        except:
            logger.warning(f"Unknown accessory category: {category}, using OTHER")
            category_enum = AccessoryType.OTHER
        
        # Get accessory image
        accessory_image = self._get_accessory_image(accessory)
        
        # Apply accessory based on category
        if category_enum == AccessoryType.CLOTHING:
            return self._apply_clothing(avatar_image, accessory_image, landmarks)
        elif category_enum == AccessoryType.JEWELRY:
            return self._apply_jewelry(avatar_image, accessory_image, landmarks)
        elif category_enum == AccessoryType.GLASSES:
            return self._apply_glasses(avatar_image, accessory_image, landmarks)
        elif category_enum == AccessoryType.HATS:
            return self._apply_hat(avatar_image, accessory_image, landmarks)
        elif category_enum == AccessoryType.WATCHES:
            return self._apply_watch(avatar_image, accessory_image, landmarks)
        else:
            # Generic placement
            return self._apply_generic_accessory(avatar_image, accessory_image)
    
    def _get_accessory_image(self, accessory):
        """
        Get accessory image from accessory data
        
        Args:
            accessory: Accessory data or image
            
        Returns:
            RGBA accessory image
        """
        # Check if accessory is already an image
        if isinstance(accessory, np.ndarray):
            accessory_image = accessory
        # Check if accessory has a path
        elif isinstance(accessory, dict) and 'path' in accessory:
            path = accessory['path']
            
            # Check if image is cached
            if path in self.accessory_cache:
                return self.accessory_cache[path]
            
            # Load image from path
            if os.path.exists(path):
                accessory_image = cv2.imread(path, cv2.IMREAD_UNCHANGED)
            else:
                # Use placeholder
                accessory_image = self._create_placeholder_accessory()
        # Check if accessory has an image
        elif isinstance(accessory, dict) and 'image' in accessory:
            accessory_image = accessory['image']
        else:
            # Use placeholder
            accessory_image = self._create_placeholder_accessory()
        
        # Ensure the image has an alpha channel
        if accessory_image.shape[2] == 3:
            # Add alpha channel (fully opaque)
            alpha = np.ones((accessory_image.shape[0], accessory_image.shape[1]), dtype=np.uint8) * 255
            accessory_image = np.dstack((accessory_image, alpha))
        
        return accessory_image
    
    def _create_placeholder_accessory(self, size=(100, 100)):
        """
        Create a placeholder accessory image
        
        Args:
            size: Size of the placeholder image (width, height)
            
        Returns:
            RGBA placeholder image
        """
        # Create a transparent image with a colored rectangle
        placeholder = np.zeros((size[1], size[0], 4), dtype=np.uint8)
        
        # Draw a colored rectangle
        color = (255, 0, 255, 128)  # Purple, semi-transparent
        cv2.rectangle(placeholder, (10, 10), (size[0]-10, size[1]-10), color, -1)
        
        # Add a border
        border_color = (255, 255, 255, 200)  # White, mostly opaque
        cv2.rectangle(placeholder, (10, 10), (size[0]-10, size[1]-10), border_color, 2)
        
        return placeholder
    
    def _apply_clothing(self, avatar_image, clothing_image, landmarks=None):
        """
        Apply clothing to an avatar
        
        Args:
            avatar_image: RGBA avatar image
            clothing_image: RGBA clothing image
            landmarks: Avatar landmarks
            
        Returns:
            RGBA image with clothing applied
        """
        # Create a copy of the avatar image
        result = avatar_image.copy()
        
        # If we have landmarks, get clothing placement based on body landmarks
        placement = None
        if landmarks and 'pose' in landmarks and landmarks['pose']:
            placement = self._get_clothing_placement(avatar_image, landmarks['pose'])
        
        # If no valid placement, use default positioning
        if not placement:
            placement = self._get_default_placement(avatar_image, clothing_image, 'torso')
        
        # Resize and position clothing
        result = self._place_accessory(
            result, 
            clothing_image, 
            placement['x'], 
            placement['y'], 
            placement['width'], 
            placement['height'],
            placement.get('rotation', 0)
        )
        
        return result
    
    def _apply_jewelry(self, avatar_image, jewelry_image, landmarks=None):
        """Apply jewelry to an avatar"""
        # Create a copy of the avatar image
        result = avatar_image.copy()
        
        # If we have landmarks, get jewelry placement based on face/body landmarks
        placement = None
        if landmarks and 'pose' in landmarks and landmarks['pose']:
            # For necklaces, place on the neck area
            placement = self._get_jewelry_placement(avatar_image, landmarks['pose'])
        
        # If no valid placement, use default neck positioning
        if not placement:
            placement = self._get_default_placement(avatar_image, jewelry_image, 'neck')
        
        # Resize and position jewelry
        result = self._place_accessory(
            result, 
            jewelry_image, 
            placement['x'], 
            placement['y'], 
            placement['width'], 
            placement['height'],
            placement.get('rotation', 0)
        )
        
        return result
    
    def _apply_glasses(self, avatar_image, glasses_image, landmarks=None):
        """Apply glasses to an avatar"""
        # Create a copy of the avatar image
        result = avatar_image.copy()
        
        # If we have landmarks, get glasses placement based on face landmarks
        placement = None
        if landmarks and 'face' in landmarks and landmarks['face']:
            placement = self._get_glasses_placement(avatar_image, landmarks['face'])
        
        # If no valid placement, use default face positioning
        if not placement:
            placement = self._get_default_placement(avatar_image, glasses_image, 'face')
        
        # Resize and position glasses
        result = self._place_accessory(
            result, 
            glasses_image, 
            placement['x'], 
            placement['y'], 
            placement['width'], 
            placement['height'],
            placement.get('rotation', 0)
        )
        
        return result
    
    def _apply_hat(self, avatar_image, hat_image, landmarks=None):
        """Apply a hat to an avatar"""
        # Create a copy of the avatar image
        result = avatar_image.copy()
        
        # If we have landmarks, get hat placement based on face landmarks
        placement = None
        if landmarks and 'face' in landmarks and landmarks['face']:
            placement = self._get_hat_placement(avatar_image, landmarks['face'])
        
        # If no valid placement, use default head positioning
        if not placement:
            placement = self._get_default_placement(avatar_image, hat_image, 'head')
        
        # Resize and position hat
        result = self._place_accessory(
            result, 
            hat_image, 
            placement['x'], 
            placement['y'], 
            placement['width'], 
            placement['height'],
            placement.get('rotation', 0)
        )
        
        return result
    
    def _apply_watch(self, avatar_image, watch_image, landmarks=None):
        """Apply a watch to an avatar"""
        # Create a copy of the avatar image
        result = avatar_image.copy()
        
        # If we have landmarks, get watch placement based on pose landmarks
        placement = None
        if landmarks and 'pose' in landmarks and landmarks['pose']:
            placement = self._get_watch_placement(avatar_image, landmarks['pose'])
        
        # If no valid placement, use default wrist positioning
        if not placement:
            placement = self._get_default_placement(avatar_image, watch_image, 'wrist')
        
        # Resize and position watch
        result = self._place_accessory(
            result, 
            watch_image, 
            placement['x'], 
            placement['y'], 
            placement['width'], 
            placement['height'],
            placement.get('rotation', 0)
        )
        
        return result
    
    def _apply_generic_accessory(self, avatar_image, accessory_image):
        """Apply a generic accessory to an avatar"""
        # Create a copy of the avatar image
        result = avatar_image.copy()
        
        # Place in center by default
        placement = self._get_default_placement(avatar_image, accessory_image, 'center')
        
        # Resize and position accessory
        result = self._place_accessory(
            result, 
            accessory_image, 
            placement['x'], 
            placement['y'], 
            placement['width'], 
            placement['height'],
            placement.get('rotation', 0)
        )
        
        return result
    
    def _get_clothing_placement(self, image, landmarks):
        """
        Get placement for clothing based on pose landmarks
        
        Args:
            image: Avatar image
            landmarks: Pose landmarks from avatar generator
            
        Returns:
            Placement data (x, y, width, height, rotation)
        """
        h, w = image.shape[:2]
        
        # Get relevant landmarks
        features = landmarks.get('features', {})
        shoulders = features.get('shoulders', {})
        hips = features.get('hips', {})
        
        left_shoulder = shoulders.get('left')
        right_shoulder = shoulders.get('right')
        left_hip = hips.get('left')
        right_hip = hips.get('right')
        
        # Check if we have the necessary landmarks
        if not (left_shoulder and right_shoulder):
            return None
        
        # Calculate center position
        center_x = (left_shoulder['x'] + right_shoulder['x']) / 2
        center_y = (left_shoulder['y'] + right_shoulder['y']) / 2
        
        if left_hip and right_hip:
            # Calculate torso height for more accurate positioning
            hip_center_y = (left_hip['y'] + right_hip['y']) / 2
            center_y = (center_y + hip_center_y) / 2  # Middle of torso
        else:
            # Move down a bit if we don't have hip landmarks
            center_y += h * 0.1
        
        # Calculate width based on shoulder width
        width = abs(right_shoulder['x'] - left_shoulder['x']) * 2
        
        # Calculate height
        height = h * 0.5  # 50% of image height as default
        if left_hip and right_hip:
            # If we have hip landmarks, use the distance from shoulders to hips
            torso_height = (hip_center_y - center_y) * 2
            height = max(torso_height, h * 0.3)  # Ensure minimum height
        
        # Calculate rotation (if shoulders are not level)
        rotation = 0
        if left_shoulder and right_shoulder:
            dy = right_shoulder['y'] - left_shoulder['y']
            dx = right_shoulder['x'] - left_shoulder['x']
            if dx != 0:
                angle = np.arctan(dy / dx)
                rotation = np.degrees(angle)
        
        return {
            'x': center_x,
            'y': center_y,
            'width': width,
            'height': height,
            'rotation': rotation
        }
    
    def _get_jewelry_placement(self, image, landmarks):
        """Get placement for jewelry based on pose landmarks"""
        h, w = image.shape[:2]
        
        # Get relevant landmarks
        features = landmarks.get('features', {})
        neck = features.get('neck')
        shoulders = features.get('shoulders', {})
        
        # Fallback if no neck landmark
        if not neck:
            left_shoulder = shoulders.get('left')
            right_shoulder = shoulders.get('right')
            
            if left_shoulder and right_shoulder:
                # Approximate neck position from shoulders
                center_x = (left_shoulder['x'] + right_shoulder['x']) / 2
                center_y = (left_shoulder['y'] + right_shoulder['y']) / 2 - h * 0.05
                
                shoulder_width = abs(right_shoulder['x'] - left_shoulder['x'])
                
                return {
                    'x': center_x,
                    'y': center_y,
                    'width': shoulder_width * 0.6,
                    'height': shoulder_width * 0.3,
                    'rotation': 0
                }
            
            return None
        
        # Use neck landmark for positioning
        return {
            'x': neck['x'],
            'y': neck['y'],
            'width': w * 0.2,
            'height': h * 0.1,
            'rotation': 0
        }
    
    def _get_glasses_placement(self, image, landmarks):
        """Get placement for glasses based on face landmarks"""
        h, w = image.shape[:2]
        
        # Get relevant landmarks
        features = landmarks.get('features', {})
        left_eye = features.get('left_eye', {})
        right_eye = features.get('right_eye', {})
        
        # Check if we have the necessary landmarks
        if not (left_eye and right_eye and 'center' in left_eye and 'center' in right_eye):
            return None
        
        left_eye_center = left_eye['center']
        right_eye_center = right_eye['center']
        
        # Calculate center position between eyes
        center_x = (left_eye_center['x'] + right_eye_center['x']) / 2
        center_y = (left_eye_center['y'] + right_eye_center['y']) / 2
        
        # Calculate width based on eye distance
        eye_distance = abs(right_eye_center['x'] - left_eye_center['x'])
        width = eye_distance * 2.2  # Make glasses wider than eye distance
        
        # Height based on width ratio (common eyeglasses aspect ratio)
        height = width * 0.4
        
        # Calculate rotation based on eye positions
        rotation = 0
        if left_eye_center and right_eye_center:
            dy = right_eye_center['y'] - left_eye_center['y']
            dx = right_eye_center['x'] - left_eye_center['x']
            if dx != 0:
                angle = np.arctan(dy / dx)
                rotation = np.degrees(angle)
        
        return {
            'x': center_x,
            'y': center_y,
            'width': width,
            'height': height,
            'rotation': rotation
        }
    
    def _get_hat_placement(self, image, landmarks):
        """Get placement for hat based on face landmarks"""
        h, w = image.shape[:2]
        
        # Get relevant landmarks
        features = landmarks.get('features', {})
        face_oval = features.get('face_oval', {})
        
        # Try to find top of head and sides of face
        top = None
        left = None
        right = None
        
        # Look for top of head from face oval
        for _, landmark in face_oval.items():
            if top is None or landmark['y'] < top['y']:
                top = landmark
                
            if left is None or landmark['x'] < left['x']:
                left = landmark
                
            if right is None or landmark['x'] > right['x']:
                right = landmark
        
        if not (top and left and right):
            return None
        
        # Calculate width based on face width
        face_width = abs(right['x'] - left['x'])
        width = face_width * 1.5  # Make hat wider than face
        
        # Position above the head
        center_x = (left['x'] + right['x']) / 2
        center_y = top['y'] - (width * 0.2)  # Adjust based on hat height
        
        # Height based on width ratio
        height = width * 0.6
        
        return {
            'x': center_x,
            'y': center_y,
            'width': width,
            'height': height,
            'rotation': 0
        }
    
    def _get_watch_placement(self, image, landmarks):
        """Get placement for watch based on pose landmarks"""
        h, w = image.shape[:2]
        
        # Get relevant landmarks
        features = landmarks.get('features', {})
        wrists = features.get('wrists', {})
        left_wrist = wrists.get('left')
        
        # For watch, default to left wrist if available
        if left_wrist and left_wrist['visibility'] > 0.5:
            wrist_size = w * 0.1  # Approximate wrist size
            
            return {
                'x': left_wrist['x'],
                'y': left_wrist['y'],
                'width': wrist_size,
                'height': wrist_size,
                'rotation': 0
            }
        
        return None
    
    def _get_default_placement(self, image, accessory, position_type):
        """
        Get default placement for an accessory when landmarks aren't available
        
        Args:
            image: Avatar image
            accessory: Accessory image
            position_type: Where to position ('head', 'face', 'neck', 'torso', 'wrist', 'center')
            
        Returns:
            Placement data (x, y, width, height, rotation)
        """
        h, w = image.shape[:2]
        
        if position_type == 'head':
            return {
                'x': w // 2,
                'y': h * 0.15,
                'width': w * 0.5,
                'height': h * 0.2,
                'rotation': 0
            }
        elif position_type == 'face':
            return {
                'x': w // 2,
                'y': h * 0.25,
                'width': w * 0.4,
                'height': h * 0.1,
                'rotation': 0
            }
        elif position_type == 'neck':
            return {
                'x': w // 2,
                'y': h * 0.35,
                'width': w * 0.3,
                'height': h * 0.1,
                'rotation': 0
            }
        elif position_type == 'torso':
            return {
                'x': w // 2,
                'y': h * 0.5,
                'width': w * 0.7,
                'height': h * 0.4,
                'rotation': 0
            }
        elif position_type == 'wrist':
            return {
                'x': w * 0.7,
                'y': h * 0.6,
                'width': w * 0.15,
                'height': w * 0.15,
                'rotation': 0
            }
        else:  # center
            return {
                'x': w // 2,
                'y': h // 2,
                'width': w * 0.5,
                'height': h * 0.3,
                'rotation': 0
            }
    
    def _place_accessory(self, base_image, accessory_image, x, y, width, height, rotation=0):
        """
        Place an accessory on an image at specified coordinates and size
        
        Args:
            base_image: Base RGBA image
            accessory_image: Accessory RGBA image
            x, y: Center coordinates for placement
            width, height: Size to resize accessory to
            rotation: Rotation angle in degrees
            
        Returns:
            RGBA image with accessory placed
        """
        # Make sure inputs are valid
        if accessory_image is None or base_image is None:
            return base_image
        
        # Create a copy of the base image
        result = base_image.copy()
        
        try:
            # Resize accessory
            resized_accessory = cv2.resize(
                accessory_image, 
                (int(width), int(height)), 
                interpolation=cv2.INTER_AREA
            )
            
            # Apply rotation if needed
            if rotation != 0:
                # Get the center of the resized accessory
                center = (resized_accessory.shape[1] // 2, resized_accessory.shape[0] // 2)
                
                # Create rotation matrix
                rotation_matrix = cv2.getRotationMatrix2D(center, rotation, 1.0)
                
                # Apply rotation
                resized_accessory = cv2.warpAffine(
                    resized_accessory, 
                    rotation_matrix, 
                    (resized_accessory.shape[1], resized_accessory.shape[0]),
                    flags=cv2.INTER_LINEAR,
                    borderMode=cv2.BORDER_TRANSPARENT
                )
            
            # Calculate placement coordinates (top-left corner)
            x_offset = int(x - width // 2)
            y_offset = int(y - height // 2)
            
            # Check if the accessory would be out of bounds
            if x_offset < 0 or y_offset < 0 or \
               x_offset + resized_accessory.shape[1] > result.shape[1] or \
               y_offset + resized_accessory.shape[0] > result.shape[0]:
                
                # Adjust offsets to stay within bounds
                x_offset = max(0, min(result.shape[1] - resized_accessory.shape[1], x_offset))
                y_offset = max(0, min(result.shape[0] - resized_accessory.shape[0], y_offset))
            
            # Define the region of interest (ROI)
            roi_width = min(resized_accessory.shape[1], result.shape[1] - x_offset)
            roi_height = min(resized_accessory.shape[0], result.shape[0] - y_offset)
            
            # Get the ROI
            roi = result[y_offset:y_offset + roi_height, x_offset:x_offset + roi_width]
            
            # Get the alpha channel of the accessory
            accessory_alpha = resized_accessory[:roi_height, :roi_width, 3] / 255.0
            
            # Blend using the alpha channel
            for c in range(3):
                roi[:, :, c] = (1.0 - accessory_alpha) * roi[:, :, c] + accessory_alpha * resized_accessory[:roi_height, :roi_width, c]
            
            # Update the result with the blended ROI
            result[y_offset:y_offset + roi_height, x_offset:x_offset + roi_width] = roi
            
            return result
            
        except Exception as e:
            logger.error(f"Error placing accessory: {e}")
            return base_image