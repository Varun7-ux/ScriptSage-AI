# 📜 ScriptSage AI

### AI-Powered Devanagari Manuscript Digitization

ScriptSage AI is a web application that uses Artificial Intelligence and Optical Character Recognition (OCR) to assist with the digitization of historical Devanagari manuscripts.

The application allows users to upload manuscript images, extract text, review and correct OCR results, and download editable transcriptions.

## 🎯 Problem Statement

India has a rich collection of historical manuscripts containing valuable cultural, literary, and linguistic knowledge.

Many manuscripts are difficult to digitize because of:

- Historical handwriting variations
- Damaged or faded paper
- Complex Devanagari characters
- Inconsistent text spacing
- Limitations of conventional OCR systems

ScriptSage AI aims to make manuscript transcription more accessible through AI-assisted OCR and human review.

## ✨ Features

- **Manuscript Upload:** Upload JPG, PNG, and WebP images.
- **Devanagari OCR:** Extract text using PaddleOCR.
- **Image Preprocessing:** Experiment with cropping and image enhancement.
- **Reading Order:** Reconstruct OCR text in a more readable sequence.
- **Manuscript Viewer:** Preview the uploaded manuscript.
- **Zoom Controls:** Inspect manuscript details.
- **Editable Transcription:** Manually correct OCR errors.
- **Copy Text:** Copy extracted text to the clipboard.
- **Download TXT:** Export the transcription as a text file.
- **Backend Integration:** Connect the Next.js frontend with FastAPI.

## 🛠️ Technology Stack

### Frontend
- Next.js
- React
- TypeScript
- Tailwind CSS

### Backend
- Python 3.12
- FastAPI
- Uvicorn

### AI and Image Processing
- PaddleOCR 3.7.0
- PaddlePaddle 3.2.0
- OpenCV
- Pillow
- NumPy

### Development Tools
- Visual Studio Code
- Git
- GitHub

## 📁 Project Structure

```text
ScriptSage-AI/
├── backend/
│   ├── main.py
│   ├── preprocess.py
│   ├── crop_image.py
│   ├── test_ocr.py
│   └── samples/
├── frontend/
│   ├── app/
│   ├── public/
│   └── package.json
├── .gitignore
└── README.md
```

The `backend/samples/` directory contains local test images and is excluded from Git tracking.

## 🚀 Installation and Setup

### Prerequisites

Make sure the following are installed:

- Python 3.12
- Node.js and npm
- Git

### Step 1: Clone the Repository

```powershell
git clone https://github.com/Varun7-ux/ScriptSage-AI.git
cd ScriptSage-AI
```

### Step 2: Create a Virtual Environment

```powershell
python -m venv .venv
```

Activate it in Windows PowerShell:

```powershell
.\.venv\Scripts\Activate.ps1
```

### Step 3: Install Backend Dependencies

```powershell
python -m pip install fastapi uvicorn python-multipart pillow numpy opencv-contrib-python setuptools
```

Install PaddlePaddle CPU:

```powershell
python -m pip install paddlepaddle==3.2.0 -i https://www.paddlepaddle.org.cn/packages/stable/cpu/
```

Install PaddleOCR:

```powershell
python -m pip install paddleocr==3.7.0
```

### Step 4: Start the Backend

From the project root:

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Backend API:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

**Note:** The first OCR request may require downloading model files.

### Step 5: Start the Frontend

Open another terminal in the project root.

```powershell
cd frontend
npm install
npm run dev
```

Open the application:

http://localhost:3000

## 📖 How to Use

1. Start the backend and frontend servers.
2. Open ScriptSage AI in your browser.
3. Upload a Devanagari manuscript image.
4. Run OCR to extract the text.
5. Review the manuscript alongside the generated transcription.
6. Use zoom controls to inspect unclear characters.
7. Edit and correct the transcription.
8. Copy the text or download it as a TXT file.

## ⚙️ How It Works

```text
Manuscript Image
       |
       v
Image Upload
       |
       v
FastAPI Backend
       |
       v
PaddleOCR
       |
       v
Text Detection and Recognition
       |
       v
Reading Order Reconstruction
       |
       v
Editable Transcription
       |
       v
TXT Export
```

## 📊 Development Status

### Completed

- [x] Project initialization
- [x] Next.js frontend setup
- [x] FastAPI backend setup
- [x] Image upload and validation
- [x] PaddleOCR integration
- [x] Devanagari text extraction
- [x] OCR reading-order improvements
- [x] Manuscript preview
- [x] Zoom controls
- [x] Editable transcription
- [x] Copy and TXT download
- [x] GitHub repository integration

### Future Improvements

- [ ] Improve recognition of historical handwriting
- [ ] Evaluate OCR accuracy using benchmark datasets
- [ ] Improve processing of damaged manuscripts
- [ ] Add additional export formats
- [ ] Support more historical scripts
- [ ] Deploy the application online

## ⚠️ Known Limitations

OCR accuracy depends on manuscript quality, handwriting style, character clarity, and image resolution.

Historical handwritten manuscripts may produce substantial recognition errors.

The current application is a prototype intended to assist transcription rather than replace expert review.

Image preprocessing utilities are experimental and are not automatically applied to every upload.

## 🌍 Project Vision

ScriptSage AI aims to support the preservation of India's written heritage by making manuscript digitization and transcription more accessible through AI-assisted tools.

---

**ScriptSage AI — Preserving History Through Technology.**
