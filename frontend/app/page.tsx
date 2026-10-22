"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent } from "react";
import { calculateAccuracy, compareWords, type AccuracyResult } from "../lib/accuracy";

type BackendStatus = "checking" | "connected" | "offline";

type EvaluationRow = {
  sample: string;
  original_cer: number;
  original_wer: number;
  enhanced_cer: number;
  enhanced_wer: number;
};

function MetricBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="text-slate-300">{label}</span>
        <span className="font-semibold tabular-nums">{value.toFixed(2)}%</span>
      </div>
      <div className="h-3 overflow-hidden rounded-full bg-slate-800">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </div>
    </div>
  );
}

type UploadResponse = {
  message: string;
  filename: string;
  width: number;
  height: number;
  size_bytes: number;
  ocr_status: string;
  extracted_text: string;
  lines_detected: number;
  enhancement_applied: boolean;
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
  const [translatedText, setTranslatedText] = useState("");
  const [translationSource, setTranslationSource] = useState("");
  const [translating, setTranslating] = useState(false);
  const [translationError, setTranslationError] = useState("");
  const [referenceText, setReferenceText] = useState("");
  const [liveResult, setLiveResult] = useState<(AccuracyResult & { reference: string; prediction: string }) | null>(null);
  const [copied, setCopied] = useState(false);
  const [zoom, setZoom] = useState(100);
  const [enhance, setEnhance] = useState(false);
  const [evaluationRows, setEvaluationRows] = useState<EvaluationRow[]>([]);
  const [evaluationError, setEvaluationError] = useState("");

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

  useEffect(() => {
    const controller = new AbortController();
    async function loadEvaluation() {
      try {
        const response = await fetch("/evaluation/batch_results.csv", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Evaluation CSV not found.");
        const csv = (await response.text()).replace(/^\uFEFF/, "").trim();
        const lines = csv.split(/\r?\n/).filter(Boolean);
        const headers = lines[0]?.split(",").map((item) => item.trim());
        const expected = ["sample", "original_cer", "original_wer", "enhanced_cer", "enhanced_wer"];
        if (!headers || !expected.every((key) => headers.includes(key))) {
          throw new Error("Evaluation CSV has unexpected columns.");
        }
        const rows = lines.slice(1).map((line) => {
          const cells = line.split(",");
          const get = (key: string) => cells[headers.indexOf(key)]?.trim() ?? "";
          return {
            sample: get("sample"),
            original_cer: Number(get("original_cer")),
            original_wer: Number(get("original_wer")),
            enhanced_cer: Number(get("enhanced_cer")),
            enhanced_wer: Number(get("enhanced_wer")),
          };
        });
        if (!rows.length || rows.some((row) => !row.sample ||
          [row.original_cer, row.original_wer, row.enhanced_cer, row.enhanced_wer]
            .some((value) => !Number.isFinite(value) || value < 0))) {
          throw new Error("Evaluation CSV contains no valid results.");
        }
        setEvaluationRows(rows);
        setEvaluationError("");
      } catch (error) {
        if (!controller.signal.aborted) {
          setEvaluationError(error instanceof Error ? error.message : "Could not load evaluation data.");
        }
      }
    }
    void loadEvaluation();
    return () => controller.abort();
  }, []);

  const average = (key: keyof Omit<EvaluationRow, "sample">) =>
    evaluationRows.reduce((sum, row) => sum + row[key], 0) / (evaluationRows.length || 1);

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
    setLiveResult(null);
    setTranslatedText("");
    setTranslationError("");
    setCopied(false);
    setZoom(100);
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
    setLiveResult(null);
    setTranslatedText("");
    setTranslationError("");
    setUploadResult(null);
    setUploadError("");
    setEditedText("");
    setCopied(false);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `http://127.0.0.1:8000/upload?enhance=${enhance}`,
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

  async function translateToEnglish() {
    const source = editedText.trim();
    if (!source || translating) return;
    setTranslating(true);
    setTranslationError("");
    setTranslatedText("");
    try {
      const response = await fetch("http://127.0.0.1:8000/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: source }),
      });
      const data: { translated_text?: string; detail?: string } = await response.json();
      if (!response.ok || !data.translated_text) {
        throw new Error(data.detail || "Translation failed.");
      }
      setTranslatedText(data.translated_text);
      setTranslationSource(source);
    } catch (error) {
      setTranslationError(error instanceof Error ? error.message : "Translation failed.");
    } finally {
      setTranslating(false);
    }
  }

  function downloadTranslation() {
    if (!translatedText) return;
    const url = URL.createObjectURL(new Blob([translatedText], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "ScriptSage_English_Translation.txt";
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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

    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
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
    setLiveResult(null);
    setTranslatedText("");
    setTranslationError("");
    setFile(null);
    setUploadResult(null);
    setUploadError("");
    setEditedText("");
    setCopied(false);
    setZoom(100);

    const input = document.getElementById(
      "manuscript-image"
    ) as HTMLInputElement | null;

    if (input) {
      input.value = "";
    }
  }

  function changeZoom(amount: number) {
    setZoom((current) =>
      Math.max(50, Math.min(300, current + amount))
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-5 py-10 text-slate-100 sm:px-10">
      <div className="mx-auto max-w-7xl">

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

        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <h2 className="text-xl font-semibold">
            Upload Manuscript
          </h2>

          <p className="mt-2 text-sm text-slate-400">
            Select a manuscript image to begin OCR transcription.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <label
              htmlFor="manuscript-image"
              className="cursor-pointer rounded-lg border border-slate-600 px-5 py-3 text-sm font-semibold hover:border-emerald-400"
            >
              Choose Manuscript Image
            </label>

            <input
              id="manuscript-image"
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFileChange}
              disabled={uploading}
              className="sr-only"
            />

            <button
              type="button"
              onClick={uploadImage}
              disabled={
                !file ||
                uploading ||
                backendStatus !== "connected"
              }
              className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {uploading
                ? "Processing Manuscript..."
                : "Extract Devanagari Text"}
            </button>

            {file && (
              <button
                type="button"
                onClick={removeImage}
                disabled={uploading}
                className="rounded-lg border border-slate-700 px-4 py-3 text-sm hover:border-rose-400 disabled:opacity-50"
              >
                Remove Image
              </button>
            )}
          </div>

          <label className="mt-5 flex cursor-pointer items-center gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              checked={enhance}
              onChange={(event) => setEnhance(event.target.checked)}
              disabled={uploading}
              className="h-4 w-4 accent-emerald-500"
            />
            Enhance image before OCR (contrast and noise reduction)
          </label>
          <p className="mt-2 text-xs text-slate-400">
            Enhancement is experimental and may not improve every image.
            Re-extract text to apply a changed setting.
          </p>

          {file && (
            <p className="mt-4 break-all text-sm text-slate-300">
              Selected: {file.name} · {imageSize} ·{" "}
              {(file.size / (1024 * 1024)).toFixed(2)} MB
            </p>
          )}

          {uploading && (
            <p role="status" className="mt-3 text-sm text-amber-300">
              AI is analyzing the manuscript. Please wait...
            </p>
          )}

          {uploadError && (
            <p role="alert" className="mt-4 rounded-lg border border-rose-900 bg-rose-950/40 p-3 text-sm text-rose-300">
              {uploadError}
            </p>
          )}
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">

          {/* LEFT: MANUSCRIPT VIEWER */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
            <p className="text-sm font-semibold text-emerald-400">
              MANUSCRIPT VIEWER
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              Original Manuscript
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Zoom in to inspect individual characters while
              reviewing the transcription.
            </p>

            {preview ? (
              <div className="mt-5">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => changeZoom(-25)}
                    disabled={zoom <= 50}
                    className="rounded-lg border border-slate-600 px-4 py-2 text-sm disabled:opacity-40"
                  >
                    − Zoom
                  </button>

                  <span className="text-sm text-slate-300">
                    {zoom}%
                  </span>

                  <button
                    type="button"
                    onClick={() => changeZoom(25)}
                    disabled={zoom >= 300}
                    className="rounded-lg border border-slate-600 px-4 py-2 text-sm disabled:opacity-40"
                  >
                    + Zoom
                  </button>

                  <button
                    type="button"
                    onClick={() => setZoom(100)}
                    className="rounded-lg border border-slate-600 px-4 py-2 text-sm"
                  >
                    Reset Zoom
                  </button>
                </div>

                <div className="mt-4 h-[520px] overflow-auto rounded-xl border border-slate-700 bg-slate-950 p-3">
                  <div
                    className="flex min-h-full items-start justify-center"
                    style={{
                      minWidth: `${zoom}%`,
                    }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={preview}
                      alt="Original manuscript"
                      className="block h-auto max-w-none"
                      style={{
                        width: `${zoom}%`,
                      }}
                    />
                  </div>
                </div>

                <p className="mt-3 text-xs text-slate-400">
                  Scroll inside the viewer to inspect the image.
                  Zoom range: 50%–300%.
                </p>
              </div>
            ) : (
              <div className="mt-5 flex h-[520px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center">
                <span className="text-4xl" aria-hidden="true">
                  📜
                </span>

                <p className="mt-4 font-medium">
                  No manuscript selected
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Upload an image to view it here.
                </p>
              </div>
            )}

            {uploadResult && (
              <div className="mt-4 rounded-lg border border-emerald-900 bg-emerald-950/30 p-4">
                <p className="font-semibold text-emerald-400">
                  Manuscript Processed!
                </p>

                <p className="mt-2 text-sm text-slate-300">
                  OCR Status: {uploadResult.ocr_status}
                </p>

                <p className="mt-1 text-sm text-slate-300">
                  Grouped Lines: {uploadResult.lines_detected}
                </p>

                <p className="mt-1 text-sm text-slate-300">
                  OCR Mode: {uploadResult.enhancement_applied ? "Enhanced" : "Original"}
                </p>
              </div>
            )}
          </div>

          {/* RIGHT: TRANSCRIPTION EDITOR */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
            <p className="text-sm font-semibold text-emerald-400">
              AI TRANSCRIPTION
            </p>

            <h2 className="mt-3 text-2xl font-semibold">
              Editable Devanagari Text
            </h2>

            <p className="mt-3 text-sm leading-6 text-slate-400">
              Compare the text with the manuscript, correct
              OCR mistakes, and download the final result.
            </p>

            {uploadResult ? (
              <div className="mt-5">
                <p className="text-sm text-emerald-400">
                  {uploadResult.lines_detected} grouped lines
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
                  className="mt-3 h-[520px] w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-5 text-lg leading-9 text-slate-100 outline-none focus:border-emerald-400"
                  placeholder="Your OCR transcription will appear here..."
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
                    className="rounded-lg border border-slate-600 px-4 py-3 text-sm hover:border-amber-400"
                  >
                    Reset Text
                  </button>
                </div>

                <p className="mt-4 text-xs leading-6 text-amber-300">
                  OCR output is a draft. Verify all words against
                  the original manuscript. Edits are not saved
                  automatically.
                </p>
              </div>
            ) : (
              <div className="mt-5 flex h-[520px] flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950 p-6 text-center">
                <span className="text-4xl" aria-hidden="true">
                  ✍️
                </span>

                <p className="mt-4 font-medium">
                  Transcription will appear here
                </p>

                <p className="mt-2 text-sm text-slate-400">
                  Extract text from an uploaded manuscript
                  to start reviewing.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <p className="text-sm font-semibold text-emerald-400">AI TRANSLATION</p>
          <h2 className="mt-3 text-2xl font-semibold">Hindi to English Translation</h2>
          <p className="mt-2 text-sm text-slate-400">Translate the current edited Devanagari transcription. Historical language and unclear OCR may need human review.</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <button type="button" onClick={translateToEnglish} disabled={!uploadResult || !editedText.trim() || translating}
              className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 disabled:opacity-50">
              {translating ? "Translating..." : "Translate to English"}
            </button>
            <button type="button" disabled={!translatedText} onClick={() => void navigator.clipboard.writeText(translatedText)}
              className="rounded-lg border border-slate-600 px-4 py-3 text-sm disabled:opacity-50">Copy English</button>
            <button type="button" disabled={!translatedText} onClick={downloadTranslation}
              className="rounded-lg border border-slate-600 px-4 py-3 text-sm disabled:opacity-50">Download English TXT</button>
          </div>
          {translationError && <p role="alert" className="mt-4 text-sm text-rose-300">{translationError}</p>}
          {translatedText && (
            <div className="mt-5">
              {translationSource !== editedText.trim() && <p className="mb-3 text-sm text-amber-300">The transcription changed. Translate again to refresh the English text.</p>}
              <label htmlFor="english-translation" className="mb-2 block text-sm text-slate-300">English translation</label>
              <textarea id="english-translation" lang="en" readOnly value={translatedText}
                className="h-56 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 leading-7 text-slate-100" />
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <p className="text-sm font-semibold text-emerald-400">LIVE OCR EVALUATION</p>
          <h2 className="mt-3 text-2xl font-semibold">Calculate OCR Error Rates</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">
            Paste a verified reference transcription to compare against the current editable OCR text.
            Lower CER and WER are better. This is a separate evaluation from the saved dashboard below.
          </p>
          <label htmlFor="reference-transcription" className="mt-5 block text-sm font-medium text-slate-200">
            Verified reference transcription
          </label>
          <textarea
            id="reference-transcription"
            lang="hi"
            spellCheck={false}
            value={referenceText}
            onChange={(event) => setReferenceText(event.target.value)}
            placeholder="Paste the correct Devanagari transcription here..."
            className="mt-2 h-40 w-full resize-y rounded-xl border border-slate-700 bg-slate-950 p-4 text-base leading-7 text-slate-100 outline-none focus:border-emerald-400"
          />
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <button
              type="button"
              disabled={!referenceText.trim() || !editedText.trim() || !uploadResult}
              onClick={() => setLiveResult({
                ...calculateAccuracy(referenceText, editedText),
                reference: referenceText,
                prediction: editedText,
              })}
              className="rounded-lg bg-emerald-500 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Calculate Accuracy
            </button>
            {!uploadResult && <p className="text-sm text-amber-300">Extract a manuscript first to enable evaluation.</p>}
          </div>
          {liveResult && (
            <div className="mt-6 space-y-4" aria-live="polite">
              {(liveResult.reference !== referenceText || liveResult.prediction !== editedText) && (
                <p className="rounded-lg border border-amber-800 bg-amber-950/30 p-3 text-sm text-amber-200">
                  Text has changed since this calculation. Click Calculate Accuracy to update the results.
                </p>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
                  <p className="text-sm text-slate-400">Character Error Rate (CER)</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-400">{liveResult.cer.toFixed(2)}%</p>
                  <p className="mt-2 text-xs text-slate-400">{liveResult.characterErrors} edits / {liveResult.referenceCharacters} reference characters</p>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
                  <p className="text-sm text-slate-400">Word Error Rate (WER)</p>
                  <p className="mt-2 text-3xl font-bold tabular-nums text-blue-400">{liveResult.wer.toFixed(2)}%</p>
                  <p className="mt-2 text-xs text-slate-400">{liveResult.wordErrors} edits / {liveResult.referenceWords} reference words</p>
                </div>
              </div>
              <p className="text-xs leading-5 text-slate-400">
                Whitespace is normalized before comparison. Character errors use Unicode code points;
                word errors use whitespace-separated tokens. Error rates may exceed 100%.
                For measuring raw OCR performance, evaluate before manually correcting the OCR text.
              </p>
              <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
                <h3 className="text-lg font-semibold text-white">OCR Error Highlighting</h3>
                <p className="mt-2 text-sm text-slate-400">
                  Compare the evaluated OCR transcription with the verified reference.
                </p>
                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span className="rounded-md bg-slate-800 px-3 py-1 text-slate-200">Correct</span>
                  <span className="rounded-md bg-red-900/50 px-3 py-1 text-red-300">Substitution</span>
                  <span className="rounded-md bg-amber-900/50 px-3 py-1 text-amber-300">Insertion</span>
                  <span className="rounded-md bg-blue-900/50 px-3 py-1 text-blue-300">Deletion</span>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 rounded-lg border border-slate-800 bg-slate-900 p-4 leading-8" lang="hi">
                  {compareWords(liveResult.reference, liveResult.prediction).map((difference, index) => {
                    const styles = {
                      correct: "bg-slate-800 text-slate-200",
                      substitution: "border border-red-700 bg-red-900/50 text-red-300",
                      insertion: "border border-amber-700 bg-amber-900/50 text-amber-300",
                      deletion: "border border-blue-700 bg-blue-900/50 text-blue-300",
                    };
                    const label = difference.type === "deletion"
                      ? `Missing: ${difference.reference}`
                      : difference.predicted;
                    const tooltip = difference.type === "substitution"
                      ? `Expected: ${difference.reference}`
                      : difference.type === "insertion"
                        ? "Extra word in OCR"
                        : difference.type === "deletion"
                          ? "Word missing from OCR"
                          : "Correct word";
                    return (
                      <span
                        key={index}
                        title={tooltip}
                        className={`rounded-md px-2 py-1 text-sm ${styles[difference.type]}`}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
                <p className="mt-3 text-xs text-slate-400">
                  Hover over a highlighted word for details. Results reflect the last calculation.
                </p>
              </div>
            </div>
          )}
        </section>

        <section className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-5 sm:p-7">
          <p className="text-sm font-semibold text-emerald-400">OCR EVALUATION</p>
          <h2 className="mt-3 text-2xl font-semibold">Accuracy Comparison Dashboard</h2>
          <p className="mt-2 text-sm text-slate-400">
            Results from saved reference transcriptions. Lower error rates are better.
          </p>
          {evaluationError && (
            <p role="status" className="mt-5 rounded-lg border border-amber-800 bg-amber-950/30 p-4 text-sm text-amber-200">
              Dashboard data unavailable: {evaluationError} Copy the generated CSV to
              frontend/public/evaluation/batch_results.csv and refresh the page.
            </p>
          )}
          {evaluationRows.length > 0 && (
            <div className="mt-6 space-y-6">
              <p className="text-sm text-slate-300">
                Evaluated samples: <strong className="text-emerald-400">{evaluationRows.length}</strong>
              </p>
              <div className="grid gap-5 lg:grid-cols-2">
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
                  <h3 className="mb-5 font-semibold">Character Error Rate (CER)</h3>
                  <div className="space-y-5">
                    <MetricBar label="Original OCR" value={average("original_cer")} color="bg-blue-500" />
                    <MetricBar label="Enhanced OCR" value={average("enhanced_cer")} color="bg-emerald-500" />
                  </div>
                </div>
                <div className="rounded-xl border border-slate-700 bg-slate-950 p-5">
                  <h3 className="mb-5 font-semibold">Word Error Rate (WER)</h3>
                  <div className="space-y-5">
                    <MetricBar label="Original OCR" value={average("original_wer")} color="bg-blue-500" />
                    <MetricBar label="Enhanced OCR" value={average("enhanced_wer")} color="bg-emerald-500" />
                  </div>
                </div>
              </div>
              <p className="text-xs leading-5 text-slate-400">
                Values are arithmetic averages of per-sample error rates from the saved CSV,
                not a live score for the currently uploaded image. Bars are capped at 100% visually;
                error rates can exceed 100%.
              </p>
              <div className="overflow-x-auto rounded-xl border border-slate-700">
                <table className="w-full min-w-[580px] text-left text-sm">
                  <thead className="bg-slate-800 text-slate-200">
                    <tr>
                      <th className="p-3">Sample</th><th className="p-3">Original CER</th>
                      <th className="p-3">Enhanced CER</th><th className="p-3">Original WER</th>
                      <th className="p-3">Enhanced WER</th>
                    </tr>
                  </thead>
                  <tbody>
                    {evaluationRows.map((row) => (
                      <tr key={row.sample} className="border-t border-slate-800">
                        <td className="p-3">{row.sample}</td>
                        <td className="p-3">{row.original_cer.toFixed(2)}%</td>
                        <td className="p-3">{row.enhanced_cer.toFixed(2)}%</td>
                        <td className="p-3">{row.original_wer.toFixed(2)}%</td>
                        <td className="p-3">{row.enhanced_wer.toFixed(2)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>

        <footer className="mt-10 border-t border-slate-800 pt-5 text-sm text-slate-500">
          ScriptSage AI · Historical Manuscript Preservation Workspace
        </footer>
      </div>
    </main>
  );
}
