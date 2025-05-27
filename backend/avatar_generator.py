import cv2
import numpy as np
import logging
import time
from PIL import Image
import mediapipe as mp

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class AvatarGenerator:
    """
    Generate avatars from segmented images using advanced image processing
    """
    
    def __init__(self):
        """Initialize the avatar generator with required models and settings"""
        self.mp_face_mesh = mp.solutions.face_mesh
        self.mp_pose = mp.solutions.pose
        self.mp_drawing = mp.solutions.drawing_utils
        
        # Initialize face mesh and pose detection models
        self.face_mesh = self.mp_face_mesh.FaceMesh(
            static_image_mode=True,
            max_num_faces=1,
            min_detection_confidence=0.5,
            refine_landmarks=True
        )
        
        self.pose = self.mp_pose.Pose(
            static_image_mode=True,
            model_complexity=2,
            enable_segmentation=True,
            min_detection_confidence=0.5
        )
        
        logger.info("Avatar generator initialized")
    
    def generate(self, segmented_image):
        """
        Generate an avatar from a segmented image
        
        Args:
            segmented_image: Input image with transparent background (RGBA)
            
        Returns:
            dict: Avatar data including the image and landmarks
        """
        logger.info("Generating avatar from segmented image")
        start_time = time.time()
        
        # Make sure the image has 4 channels (RGBA)
        if segmented_image.shape[2] != 4:
            logger.warning("Image does not have an alpha channel, adding one")
            if segmented_image.shape[2] == 3:
                # Add alpha channel (fully opaque)
                alpha = np.ones((segmented_image.shape[0], segmented_image.shape[1]), dtype=np.uint8) * 255
                segmented_image = np.dstack((segmented_image, alpha))
            else:
                raise ValueError("Unexpected image format, expected RGB or RGBA")
        
        # Process the image to detect landmarks and create avatar data
        avatar_image = segmented_image.copy()
        
        # Extract RGB image for landmark detection
        rgb_image = cv2.cvtColor(segmented_image[:, :, :3], cv2.COLOR_BGR2RGB)
        
        # Detect facial landmarks
        face_landmarks = self._detect_face_landmarks(rgb_image)
        
        # Detect body landmarks (pose)
        pose_landmarks = self._detect_pose_landmarks(rgb_image)
        
        # Combine the landmarks
        landmarks = {
            'face': face_landmarks,
            'pose': pose_landmarks
        }
        
        # Apply any necessary enhancements or post-processing
        enhanced_image = self._enhance_image(avatar_image)
        
        logger.info(f"Avatar generation completed in {time.time() - start_time:.2f} seconds")
        
        return {
            'image': enhanced_image,
            'landmarks': landmarks
        }
    
    def apply_mask(self, image, mask):
        """
        Apply a binary mask to an image, creating an RGBA image
        
        Args:
            image: Input RGB image
            mask: Binary mask
            
        Returns:
            RGBA image with background made transparent
        """
        # Create an RGBA image
        rgba = np.zeros((image.shape[0], image.shape[1], 4), dtype=np.uint8)
        
        # Copy the RGB channels
        rgba[:, :, :3] = image[:, :, :3]
        
        # Set the alpha channel based on the mask
        rgba[:, :, 3] = mask.astype(np.uint8) * 255
        
        return rgba
    
    def _detect_face_landmarks(self, image):
        """
        Detect facial landmarks in an image
        
        Args:
            image: RGB image
            
        Returns:
            dict: Detected landmarks or None if detection fails
        """
        try:
            # Detect face landmarks using MediaPipe
            results = self.face_mesh.process(image)
            
            if not results.multi_face_landmarks:
                logger.warning("No face detected in the image")
                return None
            
            # Get the first face
            face = results.multi_face_landmarks[0]
            
            # Convert landmarks to a more convenient format
            landmarks = {}
            h, w = image.shape[:2]
            
            # Extract key facial landmarks
            for idx, landmark in enumerate(face.landmark):
                x = landmark.x * w
                y = landmark.y * h
                z = landmark.z  # Relative depth
                
                landmarks[idx] = {
                    'x': x,
                    'y': y,
                    'z': z
                }
            
            # Extract common facial features for easier reference
            # Using indices from MediaPipe Face Mesh
            features = {
                'left_eye': self._get_eye_landmarks(landmarks, 'left'),
                'right_eye': self._get_eye_landmarks(landmarks, 'right'),
                'nose': {
                    'tip': landmarks.get(4, None),
                    'bottom': landmarks.get(94, None),
                    'bridge': landmarks.get(6, None)
                },
                'mouth': {
                    'left_corner': landmarks.get(61, None),
                    'right_corner': landmarks.get(291, None),
                    'top': landmarks.get(13, None),
                    'bottom': landmarks.get(14, None)
                },
                'face_oval': self._get_face_oval_landmarks(landmarks)
            }
            
            return {
                'landmarks': landmarks,
                'features': features
            }
            
        except Exception as e:
            logger.error(f"Error detecting face landmarks: {e}")
            return None
    
    def _get_eye_landmarks(self, landmarks, side):
        """Extract eye landmarks"""
        if side == 'left':
            return {
                'center': landmarks.get(468, None),
                'left_corner': landmarks.get(263, None),
                'right_corner': landmarks.get(362, None),
                'top': landmarks.get(386, None),
                'bottom': landmarks.get(374, None),
                'iris': landmarks.get(473, None)
            }
        else:  # right
            return {
                'center': landmarks.get(473, None),
                'left_corner': landmarks.get(133, None),
                'right_corner': landmarks.get(33, None),
                'top': landmarks.get(159, None),
                'bottom': landmarks.get(145, None),
                'iris': landmarks.get(468, None)
            }
    
    def _get_face_oval_landmarks(self, landmarks):
        """Extract face contour landmarks"""
        # Indices for the face oval in MediaPipe Face Mesh
        oval_indices = [
            10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288,
            397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136,
            172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109
        ]
        
        oval = {}
        for i, idx in enumerate(oval_indices):
            if idx in landmarks:
                oval[i] = landmarks[idx]
        
        return oval
    
    def _detect_pose_landmarks(self, image):
        """
        Detect body pose landmarks in an image
        
        Args:
            image: RGB image
            
        Returns:
            dict: Detected landmarks or None if detection fails
        """
        try:
            # Detect pose landmarks using MediaPipe
            results = self.pose.process(image)
            
            if not results.pose_landmarks:
                logger.warning("No pose detected in the image")
                return None
            
            # Convert landmarks to a more convenient format
            landmarks = {}
            h, w = image.shape[:2]
            
            # Extract key pose landmarks
            for idx, landmark in enumerate(results.pose_landmarks.landmark):
                x = landmark.x * w
                y = landmark.y * h
                z = landmark.z
                visibility = landmark.visibility
                
                landmarks[idx] = {
                    'x': x,
                    'y': y,
                    'z': z,
                    'visibility': visibility
                }
            
            # Extract common body parts for easier reference
            features = {
                'shoulders': {
                    'left': landmarks.get(mp.solutions.pose.PoseLandmark.LEFT_SHOULDER.value, None),
                    'right': landmarks.get(mp.solutions.pose.PoseLandmark.RIGHT_SHOULDER.value, None)
                },
                'wrists': {
                    'left': landmarks.get(mp.solutions.pose.PoseLandmark.LEFT_WRIST.value, None),
                    'right': landmarks.get(mp.solutions.pose.PoseLandmark.RIGHT_WRIST.value, None)
                },
                'hips': {
                    'left': landmarks.get(mp.solutions.pose.PoseLandmark.LEFT_HIP.value, None),
                    'right': landmarks.get(mp.solutions.pose.PoseLandmark.RIGHT_HIP.value, None)
                },
                'neck': self._calculate_neck_position(landmarks)
            }
            
            return {
                'landmarks': landmarks,
                'features': features
            }
            
        except Exception as e:
            logger.error(f"Error detecting pose landmarks: {e}")
            return None
    
    def _calculate_neck_position(self, landmarks):
        """Calculate approximate neck position from pose landmarks"""
        # Neck is typically between the shoulders and slightly up
        left_shoulder = landmarks.get(mp.solutions.pose.PoseLandmark.LEFT_SHOULDER.value)
        right_shoulder = landmarks.get(mp.solutions.pose.PoseLandmark.RIGHT_SHOULDER.value)
        
        if left_shoulder and right_shoulder:
            neck_x = (left_shoulder['x'] + right_shoulder['x']) / 2
            neck_y = (left_shoulder['y'] + right_shoulder['y']) / 2 - 10  # Slightly above shoulders
            neck_z = (left_shoulder['z'] + right_shoulder['z']) / 2
            
            return {
                'x': neck_x,
                'y': neck_y,
                'z': neck_z
            }
        
        return None
    
    def _enhance_image(self, image):
        """
        Apply enhancements to the avatar image
        
        Args:
            image: RGBA image
            
        Returns:
            Enhanced RGBA image
        """
        # Create a copy to avoid modifying the original
        enhanced = image.copy()
        
        # Separate the alpha channel
        rgb = enhanced[:, :, :3]
        alpha = enhanced[:, :, 3]
        
        # Apply slight contrast enhancement
        lab = cv2.cvtColor(rgb, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        
        # Apply CLAHE to L channel
        clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
        cl = clahe.apply(l)
        
        # Merge channels back
        updated_lab = cv2.merge((cl, a, b))
        enhanced_rgb = cv2.cvtColor(updated_lab, cv2.COLOR_LAB2BGR)
        
        # Combine with original alpha channel
        enhanced = np.dstack((enhanced_rgb, alpha))
        
        return enhanced