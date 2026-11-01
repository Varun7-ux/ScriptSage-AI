# 📜 ScriptSage AI

### AI-Powered Devanagari Manuscript Digitization & Translation

**Preserving India's written heritage through AI-assisted digitization.**

ScriptSage AI is an AI-powered web application designed to make historical Devanagari manuscript digitization more accessible. It combines Optical Character Recognition (OCR), image preprocessing, reading-order reconstruction, and translation capabilities to help transform manuscript images into editable digital text.

Users can upload manuscript images, extract Devanagari text, review and correct OCR results, translate extracted text into English, and export their transcriptions.

---

## 🎯 The Problem

India has an enormous collection of historical manuscripts containing valuable cultural, literary, linguistic, and historical knowledge.

However, digitizing these manuscripts is challenging because of:

- Faded, damaged, or low-quality manuscript images.
- Complex Devanagari characters and ligatures.
- Variations in handwriting and historical writing styles.
- Irregular spacing and text layouts.
- Limitations of conventional OCR systems.
- The difficulty of making historical text accessible to a wider audience.

These challenges make manuscript preservation and digital accessibility difficult.

## 💡 Our Solution

ScriptSage AI provides an AI-assisted workflow for digitizing Devanagari manuscripts.

The system processes uploaded manuscript images using OCR, organizes the recognized text into a readable sequence, and provides an editable transcription interface.

Its translation integration also helps users access extracted Hindi text in English.

The goal is not to replace human expertise, but to reduce manual transcription effort and support the preservation of historical documents.

---

## ✨ Key Features

### 1. Manuscript Upload and Preview
- Upload JPG, PNG, and WebP manuscript images.
- Preview the original manuscript alongside extracted text.
- Inspect manuscript details using zoom controls.

### 2. Devanagari OCR
- Extract text using PaddleOCR.
- Recognize Devanagari text from uploaded images.
- Apply OCR-oriented image processing techniques.

### 3. Reading-Order Reconstruction
- Improve the sequence of recognized text.
- Organize OCR output into a more readable transcription.

### 4. AI-Assisted Translation
- Translate extracted Hindi text into English.
- Integrate Cloudflare Workers AI for translation.
- Keep the original transcription available for review.

### 5. Editable Transcription
- Review and manually correct OCR output.
- Compare extracted text with the original manuscript.
- Copy the corrected transcription.
- Download the transcription as a TXT file.

---

## 🛠️ Technology Stack

| Component | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | Python, FastAPI, Uvicorn |
| OCR Engine | PaddleOCR |
| Deep Learning Framework | PaddlePaddle |
| Image Processing | OpenCV, Pillow, NumPy |
| Translation | Cloudflare Workers AI |
| Version Control | Git, GitHub |

---

## 🏗️ System Architecture

```text
       Historical Manuscript
                |
                v
        Next.js Frontend
                |
         Image Upload
                |
                v
         FastAPI Backend
                |
                v
       Image Preprocessing
                |
                v
            PaddleOCR
                |
                v
       Text Recognition
                |
                v
      Reading-Order Logic
                |
                v
      Devanagari Transcription
                |
          +-----+-----+
          |           |
          v           v
    Human Review   Translation
          |           |
          |      Cloudflare
          |      Workers AI
          |           |
          +-----+-----+
                |
                v
       Editable Digital Text
                |
          +-----+-----+
          |           |
          v           v
       Copy Text   TXT Export
```

---

## 📁 Project Structure

```text
ScriptSage-AI/
│
├── backend/
│   ├── main.py
│   ├── preprocess.py
│   ├── crop_image.py
│   ├── local_translation.py
│   ├── evaluate_ocr.py
│   └── test_ocr.py
│
├── frontend/
│   ├── app/
│   ├── public/
│   └── package.json
│
├── requirements.txt
├── .gitignore
└── README.md
```

The repository excludes local test images, virtual environments, generated files, and environment secrets.

---

## 🚀 Installation and Setup

### Prerequisites

Install the following:

- Python 3.12
- Node.js and npm
- Git

### Step 1: Clone the Repository

```powershell
git clone https://github.com/Varun7-ux/ScriptSage-AI.git
cd ScriptSage-AI
```

### Step 2: Create a Python Virtual Environment

```powershell
python -m venv .venv
```

Activate it:

```powershell
.\.venv\Scripts\Activate.ps1
```

### Step 3: Install Backend Dependencies

Install the required packages:

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

### Step 4: Configure Translation Credentials

The translation integration requires Cloudflare Workers AI credentials.

Configure the following environment variables in the terminal used to start the backend:

```powershell
$env:CLOUDFLARE_ACCOUNT_ID="YOUR_CLOUDFLARE_ACCOUNT_ID"
$env:CLOUDFLARE_API_TOKEN="YOUR_CLOUDFLARE_API_TOKEN"
```

Obtain the required credentials from your Cloudflare account.

**Security:** Never commit actual API tokens or credentials to GitHub. Keep them in environment variables or an appropriately secured environment configuration.

### Step 5: Start the Backend

From the project root:

```powershell
cd backend
..\.venv\Scripts\python.exe -m uvicorn main:app --reload
```

Backend:

http://127.0.0.1:8000

API documentation:

http://127.0.0.1:8000/docs

The first OCR request may take longer because OCR model files may need to be downloaded.

### Step 6: Start the Frontend

Open another terminal in the project root:

```powershell
cd frontend
npm install
npm run dev
```

Open the application:

http://localhost:3000

---

## 📖 How to Use

1. Launch the backend and frontend.
2. Open ScriptSage AI in your browser.
3. Upload a Devanagari manuscript image.
4. Run OCR to extract the text.
5. Review the extracted transcription alongside the original image.
6. Zoom in to inspect unclear characters.
7. Correct OCR mistakes using the editable text area.
8. Use the translation functionality to obtain an English translation.
9. Copy or download the transcription.

---

## 📊 Development Status

### Implemented

- [x] Next.js frontend
- [x] FastAPI backend
- [x] Manuscript image upload and validation
- [x] PaddleOCR integration
- [x] Devanagari text extraction
- [x] OCR reading-order improvements
- [x] Image preprocessing utilities
- [x] Manuscript preview and zoom controls
- [x] Editable transcription
- [x] Copy and TXT export
- [x] Cloudflare Workers AI translation integration
- [x] GitHub source control

### Future Improvements

- [ ] Improve recognition of historical handwritten manuscripts.
- [ ] Build a larger benchmark dataset for OCR evaluation.
- [ ] Improve recognition of damaged and faded manuscripts.
- [ ] Add confidence-based OCR correction assistance.
- [ ] Support additional Indian scripts.
- [ ] Add PDF and other export formats.
- [ ] Expand multilingual translation support.
- [ ] Improve deployment scalability.

---

## ⚠️ Limitations

- OCR accuracy depends on image quality, handwriting style, resolution, and character clarity.
- Historical handwritten manuscripts may produce recognition errors.
- Translation quality depends on the extracted text and the translation model.
- Human review is recommended before using transcriptions for research or archival purposes.
- Image preprocessing utilities are experimental and may not be automatically applied to every upload.

ScriptSage AI is currently a prototype intended to assist manuscript digitization rather than replace expert transcription and verification.

---

## 🌍 Vision

Our vision is to make India's historical written heritage more accessible through artificial intelligence.

By combining OCR, image processing, translation, and human review, ScriptSage AI aims to support researchers, students, historians, and cultural preservation initiatives in converting historical manuscripts into accessible digital resources.

---

**ScriptSage AI — Preserving History Through Technology.**
