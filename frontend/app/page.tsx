
"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";

type BackendStatus = "checking" | "connected" | "offline";

type UploadResponse = {
  message: string;
  filename: string;
  width: number;
  height: number;
  size_bytes: number;
  ocr_status: string;
  extracted_text: string;
  lines_detected: number;
};

export default function Home() {
  const [backendStatus, setBackendStatus] =
    useState<BackendStatus>("checking");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [imageSize, setImageSize] = useState("");

  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] =
    useState<UploadResponse | null>(null);
  const [uploadError, setUploadError] = useState("");

  const [editedText, setEditedText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function checkBackend() {
      try {
        const response = await fetch(
          "http://127.0.0.1:8000/health",
          {
            signal: controller.signal,
            cache: "no-store",
          }
        );

        if (!response.ok) {
          throw new Error("Backend unavailable");
        }

        const data: { status: string } = await response.json();

        setBackendStatus(
          data.status === "healthy" ? "connected" : "offline"
        );
      } catch {
        if (!controller.signal.aborted) {
          setBackendStatus("offline");
        }
      }
    }

    void checkBackend();

    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      setImageSize("");
      return;
    }

    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      setImageSize(
        `${image.naturalWidth} × ${image.naturalHeight} pixels`
      );
    };

    image.src = url;
    setPreview(url);

    return () => URL.revokeObjectURL(url);
  }, [file]);

  const statusText = {
    checking: "Checking backend...",
    connected: "Backend connected",
    offline: "Backend offline",
  }[backendStatus];

  function handleFileChange(
    event: ChangeEvent<HTMLInputElement>
  ) {
    const selected = event.target.files?.[0];

    if (!selected) return;

    setUploadResult(null);
    setUploadError("");
    setEditedText("");
    setCopied(false);
    setFile(null);

    if (
      !["image/png", "image/jpeg", "image/webp"].includes(
        selected.type
      )
    ) {
      setUploadError("Please choose a PNG, JPG, or WebP image.");
      event.target.value = "";
      return;
    }

    if (selected.size > 10 * 1024 * 1024) {
      setUploadError("Image must be smaller than 10 MB.");
      event.target.value = "";
      return;
    }

    setFile(selected);
  }

  async function uploadImage() {
    if (!file) {
      setUploadError("Please select an image first.");
      return;
    }

    setUploading(true);
    setUploadResult(null);
    setUploadError("");
    setEditedText("");
    setCopied(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        "http://127.0.0.1:8000/upload",
        {
          method: "POST",
          body: formData,
        }
      );

      const data: UploadResponse | { detail?: string } =
        await response.json();

      if (!response.ok) {
        throw new Error(
          "detail" in data
            ? data.detail || "OCR processing failed."
            : "OCR processing failed."
        );
      }

      const result = data as UploadResponse;

      if (
        typeof result.extracted_text !== "string" ||
        typeof result.lines_detected !== "number"
      ) {
        throw new Error(
          "Backend did not return OCR text. Check backend/main.py."
        );
      }

      setUploadResult(result);
      setEditedText(result.extracted_text);
    } catch (error) {
      setUploadError(
        error instanceof Error
          ? error.message
          : "Unable to process manuscript."
      );
    } finally {
      setUploading(false);
    }
  }

  async function copyTranscription() {
    if (!editedText) return;

    try {
      await navigator.clipboard.writeText(editedText);
      setCopied(true);
    } catch {
      setUploadError("Could not copy the transcription.");
    }
  }

  function downloadTranscription() {
    if (!editedText) return;

    const blob = new Blob([editedText], {
      type: "text/plain;charset=utf-8",
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "ScriptSage_Transcription.txt";

    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    URL.revokeObjectURL(url);
  }

  function resetTranscription() {
    if (!uploadResult) return;

    const confirmed = window.confirm(
      "Reset all edits and restore the original OCR text?"
    );

    if (confirmed) {
      setEditedText(uploadResult.extracted_text);
      setCopied(false);
    }
  }

  function removeImage() {
    setFile(null);
    setUploadResult(null);
    setUploadError("");
    setEditedText("");
    setCopied(false);

    const input = document.getElementById(
      "manuscript-image"
    ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-6xl">

        <header className="flex flex-col gap-5 border-b border-slate-800 pb-8 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-emerald-400">
              Digital Heritage · AI Research
            </p>

            <h1 className="mt-3 text-4xl font-bold tracking-tight sm:text-5xl">
              ScriptSage <span className="text-emerald-400">AI</span>
            </h1>

            <p className="mt-3 max-w-xl text-slate-400">
              Preserve historical Devanagari manuscripts
              through AI-powered digital transcription.
            </p>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900 px-5 py-4">
            <p className="text-xs uppercase tracking-wider text-slate-400">
              System Status
            </p>

            <p
              className={`mt-2 text-sm font-semibold ${
                backendStatus === "connected"
                  ? "text-emerald-400"
                  : backendStatus === "offline"
                    ? "text-rose-400"
                    : "text-amber-300"
              }`}
            >
              ● {statusText}
            </p>
          </div>
        </header>

        <section className="mt-10 grid gap-6 lg:grid-cols-2">

          {/* UPLOAD PANEL */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-7">
            <p className="text-sm font-semibold text-emerald-400">
              WORKSPACE
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              Manuscript Transcription
            </h2>

            <p className="mt-3 leading-7 text-slate-400">
              Upload a manuscript image to extract Devanagari
              text using PaddleOCR.
            </p>

            <div className="mt-6 rounded-xl border border-dashed border-slate-700 bg-slate-950 p-5">
              <label
                htmlFor="manuscript-image"
                className="block cursor-pointer rounded-lg border border-slate-700 p-6 text-center transition hover:border-emerald-400"
              >
                <span className="block text-3xl" aria-hidden="true">
                  ↑
                </span>

                <span className="mt-3 block font-semibold">
                  Choose Manuscript Image
                </span>

                <span className="mt-2 block text-sm text-slate-400">
                  PNG, JPG or WebP · Maximum 10 MB
                </span>
              </label>

              <input
                id="manuscript-image"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                disabled={uploading}
                className="sr-only"
              />

              {preview && file && (
                <div className="mt-5">
                  <div className="overflow-hidden rounded-lg border border-slate-800 bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="Manuscript preview"
                      className="max-h-80 w-full object-contain"
                    />
                  </div>

                  <p className="mt-3 break-all text-sm font-medium">
                    {file.name}
                  </p>

                  <p className="mt-1 text-sm text-slate-400">
                    {imageSize} ·{" "}
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </p>

                  <button
                    type="button"
                    onClick={removeImage}
                    disabled={uploading}
                    className="mt-4 rounded-lg border border-slate-700 px-4 py-2 text-sm hover:border-rose-400 disabled:opacity-50"
                  >
                    Remove Image
                  </button>

                  <button
                    type="button"
                    onClick={uploadImage}
                    disabled={
                      uploading ||
                      backendStatus !== "connected"
                    }
                    className="mt-4 w-full rounded-lg bg-emerald-500 px-5 py-3 font-semibold text-slate-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {uploading
                      ? "Processing Manuscript..."
                      : "Extract Devanagari Text"}
                  </button>

                  {uploading && (
                    <p
                      role="status"
                      className="mt-3 text-center text-sm text-amber-300"
                    >
                      AI is analyzing the manuscript.
                      Please wait...
                    </p>
                  )}

                  {backendStatus !== "connected" && (
                    <p className="mt-3 text-sm text-amber-300">
                      Waiting for backend connection.
                    </p>
                  )}
                </div>
              )}

              {uploadResult && (
                <div className="mt-5 rounded-lg border border-emerald-800 bg-emerald-950/40 p-4">
                  <p className="font-semibold text-emerald-400">
                    Manuscript Processed!
                  </p>

                  <p className="mt-2 break-all text-sm">
                    {uploadResult.filename}
                  </p>

                  <p className="mt-2 text-sm text-slate-300">
                    Dimensions: {uploadResult.width} ×{" "}
                    {uploadResult.height} pixels
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    File Size:{" "}
                    {(
                      uploadResult.size_bytes /
                      (1024 * 1024)
                    ).toFixed(2)}{" "}
                    MB
                  </p>

                  <p className="mt-3 text-sm text-emerald-400">
                    OCR Status: {uploadResult.ocr_status}
                  </p>

                  <p className="mt-1 text-sm text-slate-300">
                    Lines Detected: {uploadResult.lines_detected}
                  </p>
                </div>
              )}

              {uploadError && (
                <p
                  role="alert"
                  className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-300"
                >
                  {uploadError}
                </p>
              )}
            </div>

            <div className="mt-5 rounded-xl border border-slate-800 p-4">
              <p className="font-medium">
                OCR Processing
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                PaddleOCR recognizes Devanagari text from
                uploaded images. Historical handwriting may
                require manual correction.
              </p>
            </div>
          </div>

          {/* EDITABLE TRANSCRIPTION PANEL */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-7">
            <p className="text-sm font-semibold text-emerald-400">
              AI TRANSCRIPTION
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              Editable Devanagari Text
            </h2>

            <p className="mt-3 leading-7 text-slate-400">
              Review and manually correct the OCR transcription,
              then copy or download the corrected text.
            </p>

            {uploadResult ? (
              <div className="mt-6">
                <p className="text-sm text-emerald-400">
                  {uploadResult.lines_detected} OCR lines detected
                </p>

                <label
                  htmlFor="editable-transcription"
                  className="mt-4 block text-sm font-medium text-slate-300"
                >
                  Edit transcription
                </label>

                <textarea
                  id="editable-transcription"
                  lang="hi"
                  spellCheck={false}
                  value={editedText}
                  onChange={(event) => {
                    setEditedText(event.target.value);
                    setCopied(false);
                  }}
                  className="mt-3 min-h-80 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-5 text-lg leading-9 text-slate-100 outline-none focus:border-emerald-400"
                  placeholder="Your transcription will appear here..."
                />

                <div className="mt-4 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={copyTranscription}
                    disabled={!editedText}
                    className="rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50"
                  >
                    {copied ? "Copied!" : "Copy Text"}
                  </button>

                  <button
                    type="button"
                    onClick={downloadTranscription}
                    disabled={!editedText}
                    className="rounded-lg bg-blue-500 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-400 disabled:opacity-50"
                  >
                    Download TXT
                  </button>

                  <button
                    type="button"
                    onClick={resetTranscription}
                    className="rounded-lg border border-slate-600 px-4 py-3 text-sm font-semibold hover:border-amber-400"
                  >
                    Reset Text
                  </button>
                </div>

                <p className="mt-4 text-xs leading-6 text-amber-300">
                  OCR results may contain errors. Correct the text
                  before using it as a historical transcription.
                  Edits are not saved automatically.
                </p>
              </div>
            ) : (
              <div className="mt-6 flex min-h-64 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center">
                <span className="text-4xl" aria-hidden="true">
                  📜
                </span>

                <p className="mt-4 font-medium">
                  Your editable transcription will appear here
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Choose a manuscript image and click
                  Extract Devanagari Text.
                </p>
              </div>
            )}

            <div className="mt-6 rounded-xl border border-slate-800 p-4">
              <p className="font-medium">
                Project Components
              </p>

              <div className="mt-4 space-y-3 text-sm text-emerald-400">
                <p>✓ Next.js Frontend</p>
                <p>✓ FastAPI Backend</p>
                <p>✓ Manuscript Image Upload</p>
                <p>✓ Devanagari OCR Integration</p>
                <p>✓ Editable Transcription</p>
                <p>✓ TXT Download</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-6 rounded-lg border border-slate-700 px-5 py-3 text-sm font-semibold hover:border-emerald-400"
            >
              Refresh Connection Status
            </button>
          </div>
        </section>

        <footer className="mt-10 border-t border-slate-800 pt-5 text-sm text-slate-500">
          ScriptSage AI · Historical Manuscript Preservation Workspace
        </footer>
      </div>
    </main>
  );
}
