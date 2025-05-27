#!/usr/bin/env python
"""
Download required models for the Virtual Fitting Avatar application
"""

import os
import requests
import logging
from tqdm import tqdm
import argparse
import sys

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Model URLs and file paths
MODELS = {
    'vit_h': {
        'url': 'https://dl.fbaipublicfiles.com/segment_anything/sam_vit_h_4b8939.pth',
        'path': 'models/sam_vit_h_4b8939.pth',
        'description': 'SAM ViT-H model (2.6GB)'
    },
    'vit_l': {
        'url': 'https://dl.fbaipublicfiles.com/segment_anything/sam_vit_l_0b3195.pth', 
        'path': 'models/sam_vit_l_0b3195.pth',
        'description': 'SAM ViT-L model (1.2GB)'
    },
    'vit_b': {
        'url': 'https://dl.fbaipublicfiles.com/segment_anything/sam_vit_b_01ec64.pth',
        'path': 'models/sam_vit_b_01ec64.pth',
        'description': 'SAM ViT-B model (375MB)'
    }
}

def download_file(url, destination, description=None):
    """
    Download a file with progress tracking
    
    Args:
        url: URL to download from
        destination: Path to save file to
        description: Description of the file for display
        
    Returns:
        bool: True if download was successful, False otherwise
    """
    try:
        # Create directory if it doesn't exist
        os.makedirs(os.path.dirname(destination), exist_ok=True)
        
        # Check if file already exists
        if os.path.exists(destination):
            logger.info(f"File already exists: {destination}")
            return True
        
        # Download the file
        logger.info(f"Downloading {description or url} to {destination}")
        
        response = requests.get(url, stream=True)
        response.raise_for_status()
        
        # Get file size for progress tracking
        total_size = int(response.headers.get('content-length', 0))
        block_size = 1024  # 1 KB
        
        # Create progress bar
        progress_bar = tqdm(
            total=total_size,
            unit='iB',
            unit_scale=True,
            desc=os.path.basename(destination)
        )
        
        # Download the file with progress tracking
        with open(destination, 'wb') as f:
            for chunk in response.iter_content(chunk_size=block_size):
                if chunk:
                    progress_bar.update(len(chunk))
                    f.write(chunk)
        
        progress_bar.close()
        
        # Verify file size
        if total_size != 0 and progress_bar.n != total_size:
            logger.error("Downloaded file size doesn't match expected size")
            return False
        
        logger.info(f"Download complete: {destination}")
        return True
        
    except Exception as e:
        logger.error(f"Error downloading file: {e}")
        # Remove partially downloaded file
        if os.path.exists(destination):
            try:
                os.remove(destination)
            except:
                pass
        return False

def main():
    parser = argparse.ArgumentParser(description='Download models for Virtual Fitting Avatar')
    parser.add_argument('--model', choices=['vit_h', 'vit_l', 'vit_b', 'all'], default='vit_h',
                        help='Model type to download (default: vit_h)')
    args = parser.parse_args()
    
    models_to_download = []
    
    if args.model == 'all':
        models_to_download = list(MODELS.keys())
    else:
        models_to_download = [args.model]
    
    success = True
    
    for model in models_to_download:
        if model not in MODELS:
            logger.error(f"Unknown model: {model}")
            continue
        
        model_info = MODELS[model]
        logger.info(f"Downloading {model_info['description']}")
        
        result = download_file(
            model_info['url'], 
            model_info['path'],
            model_info['description']
        )
        
        if not result:
            logger.error(f"Failed to download {model}")
            success = False
    
    if success:
        logger.info("All models downloaded successfully")
        return 0
    else:
        logger.error("Some models failed to download")
        return 1

if __name__ == '__main__':
    sys.exit(main())