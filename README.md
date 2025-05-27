# Virtual Fitting Avatar

An AI-powered virtual avatar system that creates realistic digital twins from photos or webcam captures and allows users to try on various accessories.

## Key Technologies

- **Segment Anything Model (SAM)** - For precise segmentation of human subjects
- **JavaScript** - For the user interface and client-side processing
- **Python** - For backend processing and model integration
- **WebGL** - For realistic 3D rendering

## Features

- **Accurate Segmentation**: Uses Meta's SAM for precise human segmentation
- **Realistic Avatars**: Creates photorealistic digital twins
- **Virtual Try-On**: Allows users to try on clothing, jewelry, accessories
- **Multi-Source Input**: Works with webcam capture or image uploads
- **Responsive UI**: Modern interface that works across devices

## Project Structure

```
virtual-fitting-avatar/
├── frontend/                   # JavaScript UI
│   ├── index.html              # Main application page
│   ├── css/                    # Stylesheets
│   ├── js/                     # JavaScript modules 
│   └── assets/                 # Static resources
│
├── backend/                    # Python server and processing
│   ├── server.py               # Flask API server
│   ├── sam_processor.py        # SAM integration
│   ├── avatar_generator.py     # Avatar creation
│   └── virtual_fitting.py      # Try-on functionality
│
├── models/                     # Pre-trained models
│   ├── sam/                    # SAM model checkpoints
│   └── try_on/                 # Virtual try-on models
│
└── data/                       # Sample data and accessories
    ├── accessories/            # Categorized accessory images
    └── samples/                # Sample images for testing
```

## How It Works

1. **Image Acquisition**:
   - Capture from webcam or upload from device
   - Preprocess for optimal results

2. **Segmentation with SAM**:
   - Separate person from background
   - Identify body parts and landmarks

3. **Avatar Creation**:
   - Generate realistic avatar based on segmentation
   - Preserve user's appearance and features

4. **Virtual Try-On**:
   - Select accessories from catalog
   - Place accurately on avatar using SAM-generated masks
   - Render with realistic lighting and perspective

## SAM Integration Details

The Segment Anything Model (SAM) is a foundation model for image segmentation that enables:

- Zero-shot object segmentation
- Precise boundary detection
- Robust performance across diverse images

Our implementation uses SAM to:
1. Create detailed segmentation masks of the user
2. Identify specific body regions for accessory placement
3. Enable realistic blending of virtual accessories with the avatar

## Installation

### Prerequisites
- Python 3.8+
- Node.js 14+
- CUDA-compatible GPU (recommended)

### Backend Setup
```bash
# Clone the repository
git clone https://github.com/SreeHarhsa/virtual-fitting-avatar.git
cd virtual-fitting-avatar/backend

# Create and activate virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Download SAM model
python download_models.py

# Start the backend server
python server.py
```

### Frontend Setup
```bash
# Navigate to frontend directory
cd ../frontend

# Install dependencies
npm install

# Start development server
npm start
```

The application will be available at `http://localhost:3000`

## API Endpoints

- `POST /api/segment` - Process image with SAM
- `POST /api/generate-avatar` - Generate avatar from segmented image
- `POST /api/try-on` - Apply virtual accessories
- `GET /api/accessories` - Get list of available accessories

## Future Enhancements

- Real-time fitting in video streams
- Animated avatars with motion
- User accessory uploads
- Mobile application

## License

MIT License

## Acknowledgements

- [Segment Anything Model (SAM)](https://github.com/facebookresearch/segment-anything) by Meta Research
- [Virtual Try-On research community](https://github.com/topics/virtual-try-on)