flowchart TD
    A[Historical Manuscript Image] --> B[Next.js Frontend]
    B --> C[FastAPI Backend]
    C --> D[Image Validation and Preprocessing]
    D --> E[PaddleOCR]
    E --> F[Devanagari Text Recognition]
    F --> G[Reading Order Reconstruction]
    G --> H[Editable Transcription]

    H --> I[Human Review]
    H --> J[Cloudflare Workers AI]
    J --> K[English Translation]

    I --> L[Digital Output]
    K --> L
    L --> M[Copy / TXT Export]