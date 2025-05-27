#!/bin/bash

# Virtual Fitting Avatar Setup Script
echo "Setting up Virtual Fitting Avatar application..."

# Create virtual environment
echo "Creating Python virtual environment..."
python -m venv venv

# Activate virtual environment
if [ -d "venv/bin" ]; then
    source venv/bin/activate
else
    source venv/Scripts/activate
fi

# Install requirements
echo "Installing Python dependencies..."
pip install -r backend/requirements.txt

# Download models
echo "Downloading SAM model... (this may take a while)"
python backend/download_models.py --model vit_h

# Create necessary directories
echo "Creating directory structure..."
mkdir -p models
mkdir -p backend/accessories/clothing
mkdir -p backend/accessories/jewelry
mkdir -p backend/accessories/hats
mkdir -p backend/accessories/glasses
mkdir -p backend/accessories/watches

# Generate sample accessories (placeholders)
echo "Generating sample accessories..."
python -c "
import cv2
import numpy as np
import os

def generate_accessory(size, color, name, category):
    img = np.zeros((size[0], size[1], 4), dtype=np.uint8)
    cv2.rectangle(img, (10, 10), (size[0]-10, size[1]-10), color, -1)
    cv2.putText(img, name, (size[0]//4, size[0]//2), cv2.FONT_HERSHEY_SIMPLEX, 1, (255,255,255,255), 2)
    
    path = f'backend/accessories/{category}/{name.lower()}.png'
    thumb_path = f'frontend/assets/accessories/{category}/{name.lower()}_thumb.png'
    
    # Create directory if it doesn't exist
    os.makedirs(f'frontend/assets/accessories/{category}', exist_ok=True)
    
    cv2.imwrite(path, img)
    cv2.imwrite(thumb_path, img)

# Generate clothing
generate_accessory((300, 400), (0, 0, 255, 180), 'Tshirt', 'clothing')
generate_accessory((300, 400), (255, 0, 0, 180), 'Jacket', 'clothing')
generate_accessory((300, 400), (0, 255, 0, 180), 'Dress', 'clothing')
generate_accessory((300, 400), (128, 0, 128, 180), 'Hoodie', 'clothing')
generate_accessory((300, 400), (0, 128, 128, 180), 'Suit', 'clothing')

# Generate jewelry
generate_accessory((200, 100), (255, 215, 0, 180), 'Necklace', 'jewelry')
generate_accessory((100, 100), (192, 192, 192, 180), 'Earrings', 'jewelry')
generate_accessory((100, 100), (255, 255, 255, 180), 'Bracelet', 'jewelry')

# Generate hats
generate_accessory((200, 100), (50, 50, 255, 180), 'Baseball', 'hats')
generate_accessory((200, 100), (50, 255, 50, 180), 'Beanie', 'hats')
generate_accessory((250, 150), (255, 50, 50, 180), 'Sunhat', 'hats')

# Generate glasses
generate_accessory((200, 60), (10, 10, 10, 180), 'Sunglasses', 'glasses')
generate_accessory((200, 60), (100, 100, 100, 180), 'Reading', 'glasses')
generate_accessory((200, 60), (50, 50, 100, 180), 'Fashion', 'glasses')

# Generate watches
generate_accessory((100, 100), (0, 0, 0, 180), 'Smart', 'watches')
generate_accessory((100, 100), (100, 70, 0, 180), 'Luxury', 'watches')
"

echo "Setup complete!"
echo ""
echo "To start the application:"
echo "------------------------"
echo "1. Activate the virtual environment:"
echo "   source venv/bin/activate (Linux/Mac)"
echo "   venv\\Scripts\\activate (Windows)"
echo ""
echo "2. Start the Flask server:"
echo "   python backend/server.py"
echo ""
echo "3. Open in your browser:"
echo "   http://localhost:5000"
echo ""
echo "Enjoy your Virtual Fitting Avatar!"