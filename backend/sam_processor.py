import numpy as np
import cv2
import torch
import logging
import os
import requests
from PIL import Image
from io import BytesIO
from segment_anything import sam_model_registry, SamPredictor

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class SAMProcessor:
    """
    Processor for segmentation using the Segment Anything Model (SAM)
    """
    
    def __init__(self, model_type="vit_h", checkpoint_dir="models"):
        """
        Initialize SAM processor
        
        Args:
            model_type: Type of SAM model to use ("vit_h", "vit_l", "vit_b")
            checkpoint_dir: Directory to store model checkpoints
        """
        self.model_type = model_type
        self.checkpoint_dir = checkpoint_dir
        self.device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
        self.predictor = None
        
        logger.info(f"Initializing SAM with model {model_type} on {self.device}")
        
        # Create checkpoint directory if it doesn't exist
        os.makedirs(checkpoint_dir, exist_ok=True)
        
        # Download and load model
        self._initialize_model()
    
    def _initialize_model(self):
        """Load and initialize the SAM model"""
        model_filename = {
            "vit_h": "sam_vit_h_4b8939.pth",
            "vit_l": "sam_vit_l_0b3195.pth",
            "vit_b": "sam_vit_b_01ec64.pth"
        }[self.model_type]
        
        checkpoint_path = os.path.join(self.checkpoint_dir, model_filename)
        
        # Download the model if it doesn't exist
        if not os.path.exists(checkpoint_path):
            self._download_model(model_filename, checkpoint_path)
        
        try:
            # Initialize the model
            sam = sam_model_registry[self.model_type](checkpoint=checkpoint_path)
            sam.to(device=self.device)
            
            # Create predictor
            self.predictor = SamPredictor(sam)
            logger.info("SAM model loaded successfully")
        except Exception as e:
            logger.error(f"Error loading SAM model: {e}")
            raise
    
    def _download_model(self, model_filename, checkpoint_path):
        """
        Download the SAM model checkpoint
        
        Args:
            model_filename: Name of the model file
            checkpoint_path: Path to save the checkpoint
        """
        base_url = "https://dl.fbaipublicfiles.com/segment_anything/"
        model_url = base_url + model_filename
        
        try:
            logger.info(f"Downloading SAM model from {model_url}")
            response = requests.get(model_url, stream=True)
            response.raise_for_status()
            
            total_size = int(response.headers.get('content-length', 0))
            block_size = 1024 * 1024  # 1MB
            
            with open(checkpoint_path, 'wb') as f:
                for i, chunk in enumerate(response.iter_content(chunk_size=block_size)):
                    if chunk:
                        f.write(chunk)
                    
                    # Log progress every 20MB
                    if i % 20 == 0 and i > 0:
                        mb_downloaded = i * block_size / (1024 * 1024)
                        mb_total = total_size / (1024 * 1024)
                        logger.info(f"Downloaded {mb_downloaded:.1f}MB / {mb_total:.1f}MB")
            
            logger.info(f"Model downloaded successfully to {checkpoint_path}")
        except Exception as e:
            logger.error(f"Error downloading model: {e}")
            # Remove partially downloaded file
            if os.path.exists(checkpoint_path):
                os.remove(checkpoint_path)
            raise
    
    def segment_from_point(self, image, point, point_label=1):
        """
        Generate segmentation from a point prompt
        
        Args:
            image: Input image (numpy array)
            point: [x, y] coordinates (normalized 0-1 or pixel coordinates)
            point_label: 1 for foreground, 0 for background
            
        Returns:
            mask: Binary segmentation mask
            masked_image: Input image with background removed
        """
        if self.predictor is None:
            raise ValueError("Model not initialized")
        
        # Convert image to RGB if needed
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        elif image.shape[2] == 4:
            # Remove alpha channel
            image = image[:, :, :3]
        
        # Set the image in the predictor
        self.predictor.set_image(image)
        
        # Convert normalized coordinates to pixel coordinates if needed
        h, w = image.shape[:2]
        if 0 <= point[0] <= 1 and 0 <= point[1] <= 1:
            x = int(point[0] * w)
            y = int(point[1] * h)
        else:
            x, y = point
        
        # Create input points
        input_point = np.array([[x, y]])
        input_label = np.array([point_label])
        
        # Generate masks
        masks, scores, logits = self.predictor.predict(
            point_coords=input_point,
            point_labels=input_label,
            multimask_output=True
        )
        
        # Get the best mask (highest score)
        best_mask_idx = np.argmax(scores)
        mask = masks[best_mask_idx]
        
        # Create masked image
        masked_image = self._apply_mask_to_image(image, mask)
        
        return mask, masked_image
    
    def segment_from_box(self, image, box):
        """
        Generate segmentation from a bounding box prompt
        
        Args:
            image: Input image (numpy array)
            box: [x1, y1, x2, y2] coordinates (normalized 0-1 or pixel coordinates)
            
        Returns:
            mask: Binary segmentation mask
            masked_image: Input image with background removed
        """
        if self.predictor is None:
            raise ValueError("Model not initialized")
        
        # Convert image to RGB if needed
        if len(image.shape) == 2:
            image = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
        elif image.shape[2] == 4:
            # Remove alpha channel
            image = image[:, :, :3]
        
        # Set the image in the predictor
        self.predictor.set_image(image)
        
        # Convert normalized coordinates to pixel coordinates if needed
        h, w = image.shape[:2]
        if all(0 <= coord <= 1 for coord in box):
            x1, y1, x2, y2 = [
                int(box[0] * w),
                int(box[1] * h),
                int(box[2] * w),
                int(box[3] * h)
            ]
        else:
            x1, y1, x2, y2 = box
        
        # Create input box
        input_box = np.array([x1, y1, x2, y2])
        
        # Generate masks
        masks, scores, logits = self.predictor.predict(
            box=input_box,
            multimask_output=True
        )
        
        # Get the best mask (highest score)
        best_mask_idx = np.argmax(scores)
        mask = masks[best_mask_idx]
        
        # Create masked image
        masked_image = self._apply_mask_to_image(image, mask)
        
        return mask, masked_image
    
    def auto_segment_person(self, image):
        """
        Automatically segment a person in the image
        
        Args:
            image: Input image (numpy array)
            
        Returns:
            mask: Binary segmentation mask
            masked_image: Input image with background removed
        """
        # For a person in a portrait photo, we can use a heuristic approach:
        # Assume the person is centered in the image, create a central box
        h, w = image.shape[:2]
        
        # Create a box around the center of the image
        # This is a heuristic that works well for portrait photos
        center_x, center_y = w // 2, h // 2
        
        # Box size should be about 60% of the image dimensions
        box_w, box_h = int(w * 0.6), int(h * 0.8)
        
        # Calculate box coordinates
        x1 = max(0, center_x - box_w // 2)
        y1 = max(0, center_y - box_h // 2)
        x2 = min(w, center_x + box_w // 2)
        y2 = min(h, center_y + box_h // 2)
        
        # Generate segmentation from the box
        return self.segment_from_box(image, [x1, y1, x2, y2])
    
    def _apply_mask_to_image(self, image, mask, background_color=None):
        """
        Apply a mask to an image, setting the background to transparent
        
        Args:
            image: Input image (numpy array)
            mask: Binary mask (numpy array)
            background_color: Optional background color, if None use transparent
            
        Returns:
            masked_image: Image with background removed
        """
        # Create a copy of the input image
        if background_color is None:
            # Create an RGBA image with transparent background
            masked_image = np.zeros((image.shape[0], image.shape[1], 4), dtype=np.uint8)
            # Copy RGB channels
            masked_image[:, :, :3] = image
            # Set alpha channel based on mask
            masked_image[:, :, 3] = mask.astype(np.uint8) * 255
        else:
            # Create an RGB image with specified background color
            masked_image = np.zeros_like(image)
            # Set background to specified color
            if not isinstance(background_color, (list, tuple, np.ndarray)):
                background_color = [background_color] * 3
            
            # Create background
            for c in range(3):
                masked_image[:, :, c] = background_color[c]
            
            # Apply foreground
            for c in range(3):
                masked_image[:, :, c] = mask * image[:, :, c] + ~mask * masked_image[:, :, c]
        
        return masked_image
    
    def __del__(self):
        """
        Clean up resources
        """
        # Release CUDA memory if using GPU
        if self.predictor is not None:
            try:
                if hasattr(self.predictor, 'model'):
                    del self.predictor.model
                del self.predictor
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception as e:
                logger.error(f"Error cleaning up SAM resources: {e}")