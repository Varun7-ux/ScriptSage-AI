
"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:8000";

type OCRResult = {
  filename?: string;
  extracted_text?: string;
  lines_detected?: number;
  width?: number;
  height?: number;
  size_bytes?: number;
  enhancement_applied?: boolean;
  message?: string;
};

type EvaluationRow = Record<string, string>;

function getWordAccuracy(reference: string, predicted: string) {
  const expected = reference.trim().split(/\s+/).filter(Boolean);
  const actual = predicted.trim().split(/\s+/).filter(Boolean);

  if (!expected.length) {
    return { accuracy: 0, correct: 0, total: actual.length };
  }

  const previous = Array.from(
    { length: actual.length + 1 },
    (_, index) => index
  );

  for (let i = 1; i <= expected.length; i++) {
    const current = [i];

    for (let j = 1; j <= actual.length; j++) {
      current[j] =
        expected[i - 1] === actual[j - 1]
          ? previous[j - 1]
          : Math.min(previous[j - 1], previous[j], current[j - 1]) + 1;
    }

    previous.splice(0, previous.length, ...current);
  }

  const edits = previous[actual.length];
  const correct = Math.max(0, expected.length - edits);

  return {
    accuracy: Math.max(
      0,
      Math.min(100, (1 - edits / expected.length) * 100)
    ),
    correct,
    total: expected.length,
  };
}

function MetricCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{detail}</p>
    </div>
  );
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageUrlRef = useRef<string | null>(null);

  const [file, setFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState("");
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [zoom, setZoom] = useState(100);
  const [enhance, setEnhance] = useState(true);

  const [backendOnline, setBackendOnline] = useState(false);
  const [checkingBackend, setCheckingBackend] = useState(true);
  const [loadingOCR, setLoadingOCR] = useState(false);
  const [loadingTranslation, setLoadingTranslation] = useState(false);

  const [transcription, setTranscription] = useState("");
  const [translatedText, setTranslatedText] = useState("");
  const [ocrResult, setOcrResult] = useState<OCRResult | null>(null);

  const [referenceText, setReferenceText] = useState("");
  const [copied, setCopied] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [evaluationRows, setEvaluationRows] = useState<EvaluationRow[]>([]);
  const [evaluationLoading, setEvaluationLoading] = useState(true);
  const [evaluationError, setEvaluationError] = useState("");

  const checkBackend = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        cache: "no-store",
      });
      setBackendOnline(response.ok);
    } catch {
      setBackendOnline(false);
    } finally {
      setCheckingBackend(false);
    }
  }, []);

  useEffect(() => {
    void checkBackend();
    const interval = window.setInterval(() => void checkBackend(), 15000);
    return () => window.clearInterval(interval);
  }, [checkBackend]);

  useEffect(() => {
    return () => {
      if (imageUrlRef.current) {
        URL.revokeObjectURL(imageUrlRef.current);
      }
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadEvaluation() {
      setEvaluationLoading(true);
      setEvaluationError("");

      try {
        const response = await fetch("/evaluation/batch_results.csv", {
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error("Evaluation CSV is not available yet.");
        }

        const csv = await response.text();
        const lines = csv.trim().split(/\r?\n/);

        if (lines.length < 2) {
          if (!cancelled) setEvaluationRows([]);
          return;
        }

        const parseCSVLine = (line: string) => {
          const cells: string[] = [];
          let cell = "";
          let quoted = false;

          for (let i = 0; i < line.length; i++) {
            const char = line[i];

            if (char === '"' && quoted && line[i + 1] === '"') {
              cell += '"';
              i++;
            } else if (char === '"') {
              quoted = !quoted;
            } else if (char === "," && !quoted) {
              cells.push(cell);
              cell = "";
            } else {
              cell += char;
            }
          }

          cells.push(cell);
          return cells;
        };

        const headers = parseCSVLine(lines[0]).map((item) =>
          item.trim().replace(/^\uFEFF/, "")
        );

        const rows = lines.slice(1).filter(Boolean).map((line) => {
          const values = parseCSVLine(line);
          return Object.fromEntries(
            headers.map((header, index) => [
              header,
              (values[index] ?? "").trim(),
            ])
          );
        });

        if (!cancelled) setEvaluationRows(rows);
      } catch (err) {
        if (!cancelled) {
          setEvaluationError(
            err instanceof Error ? err.message : "Could not load evaluation."
          );
          setEvaluationRows([]);
        }
      } finally {
        if (!cancelled) setEvaluationLoading(false);
      }
    }

    void loadEvaluation();

    return () => {
      cancelled = true;
    };
  }, []);

  const accuracy = referenceText.trim()
    ? getWordAccuracy(referenceText, transcription)
    : null;

  const chooseFile = (selected: File | undefined) => {
    if (!selected) return;

    setError("");
    setNotice("");
    setCopied("");
    setTranslatedText("");
    setTranscription("");
    setOcrResult(null);
    setZoom(100);

    if (!selected.type.startsWith("image/")) {
      setError("Please choose an image file, such as JPG, PNG, or WEBP.");
      return;
    }

    if (selected.size > 15 * 1024 * 1024) {
      setError("The image is larger than 15 MB. Please choose a smaller image.");
      return;
    }

    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
    }

    const nextUrl = URL.createObjectURL(selected);
    imageUrlRef.current = nextUrl;

    const image = new Image();

    image.onload = () => {
      setImageSize({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };

    image.src = nextUrl;
    setFile(selected);
    setImageUrl(nextUrl);
  };

  const uploadAndOCR = async () => {
    if (!file) {
      setError("Choose a manuscript image before starting OCR.");
      return;
    }

    setLoadingOCR(true);
    setError("");
    setNotice("");
    setCopied("");
    setTranslatedText("");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${API_BASE_URL}/upload?enhance=${enhance}`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = (await response.json()) as OCRResult & {
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data.detail || data.message || "OCR processing failed.");
      }

      setOcrResult(data);
      setTranscription(data.extracted_text || "");
      setNotice(
        `OCR completed. ${data.lines_detected ?? 0} lines detected.`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Check that the backend is running at ${API_BASE_URL}.`
          : "Could not process this image."
      );
    } finally {
      setLoadingOCR(false);
    }
  };

  const translateText = async () => {
    if (!transcription.trim()) {
      setError("Run OCR or enter some Hindi text before translating.");
      return;
    }

    setLoadingTranslation(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`${API_BASE_URL}/translate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcription }),
      });

      const data = (await response.json()) as {
        translated_text?: string;
        translation?: string;
        translatedText?: string;
        text?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(data.detail || "Translation failed.");
      }

      const result =
        data.translated_text ??
        data.translation ??
        data.translatedText ??
        data.text ??
        "";

      if (typeof result !== "string" || !result.trim()) {
        throw new Error("The server returned no translated text.");
      }

      setTranslatedText(result);
      setNotice("English translation completed.");
    } catch (err) {
      setError(
        err instanceof Error
          ? `${err.message} Check the backend translation endpoint.`
          : "Could not translate the text."
      );
    } finally {
      setLoadingTranslation(false);
    }
  };

  const copyText = async (text: string, label: string) => {
    if (!text.trim()) {
      setError("There is no text to copy yet.");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      setCopied(label);
      setNotice(`${label} copied to clipboard.`);
      window.setTimeout(() => setCopied(""), 2000);
    } catch {
      setError("Clipboard access failed. Select the text and copy it manually.");
    }
  };

  const downloadText = (text: string, filename: string) => {
    if (!text.trim()) {
      setError("There is no text to download yet.");
      return;
    }

    const blob = new Blob([text], {
      type: "text/plain;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const resetProject = () => {
    if (imageUrlRef.current) {
      URL.revokeObjectURL(imageUrlRef.current);
      imageUrlRef.current = null;
    }

    setFile(null);
    setImageUrl("");
    setImageSize({ width: 0, height: 0 });
    setZoom(100);
    setTranscription("");
    setTranslatedText("");
    setReferenceText("");
    setOcrResult(null);
    setError("");
    setNotice("");
    setCopied("");

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const averageSavedAccuracy = (() => {
    const accuracyKey = evaluationRows.length
      ? Object.keys(evaluationRows[0]).find((key) =>
          /accuracy|score|cer|wer/i.test(key)
        )
      : undefined;

    if (!accuracyKey) return null;

    const values = evaluationRows
      .map((row) => Number.parseFloat(row[accuracyKey]))
      .filter(Number.isFinite);

    if (!values.length) return null;

    const normalized = values.map((value) =>
      /cer|wer/i.test(accuracyKey) && value <= 1 ? (1 - value) * 100 : value
    );

    const average =
      normalized.reduce((sum, value) => sum + value, 0) / normalized.length;

    return {
      key: accuracyKey,
      value: average,
    };
  })();

  return (
    <main className="min-h-screen bg-[#f6f8fc] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <a href="#" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-700 text-lg font-black text-white shadow-sm">
              S
            </div>
            <div>
              <p className="text-lg font-extrabold tracking-tight">
                ScriptSage <span className="text-emerald-700">AI</span>
              </p>
              <p className="text-xs text-slate-500">
                Preserving manuscripts, connecting languages
              </p>
            </div>
          </a>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold">
              <span
                className={`h-2 w-2 rounded-full ${
                  backendOnline ? "bg-emerald-500" : "bg-red-500"
                }`}
              />
              {checkingBackend
                ? "Checking backend..."
                : backendOnline
                  ? "Backend connected"
                  : "Backend offline"}
            </div>
            <button
              onClick={() => void checkBackend()}
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-600 transition hover:bg-slate-100"
            >
              Refresh
            </button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-slate-950">
        <div className="pointer-events-none absolute inset-0 opacity-20">
          <div className="absolute -right-20 -top-40 h-96 w-96 rounded-full bg-emerald-400 blur-3xl" />
          <div className="absolute -bottom-48 left-1/4 h-96 w-96 rounded-full bg-teal-500 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 py-14 sm:px-8 sm:py-20 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-4 py-2 text-xs font-semibold tracking-wide text-emerald-200">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              AI-POWERED MANUSCRIPT WORKSPACE
            </div>

            <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
              Ancient words.
              <span className="block text-emerald-400">
                New understanding.
              </span>
            </h1>

            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg">
              Transform Hindi Devanagari manuscript images into editable text
              and English translations with an integrated OCR workflow.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                onClick={() =>
                  document
                    .getElementById("workspace")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
                className="rounded-xl bg-emerald-400 px-5 py-3 text-sm font-bold text-slate-950 shadow-lg shadow-emerald-950/20 transition hover:bg-emerald-300"
              >
                Open workspace <span aria-hidden="true">→</span>
              </button>
              <a
                href="#evaluation"
                className="rounded-xl border border-white/20 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                View evaluation
              </a>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <p className="text-2xl font-bold text-emerald-300">01</p>
              <p className="mt-3 font-bold text-white">Upload</p>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                Select a manuscript image
              </p>
            </div>
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <p className="text-2xl font-bold text-emerald-300">02</p>
              <p className="mt-3 font-bold text-white">Transcribe</p>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                Extract Hindi text with OCR
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <p className="text-2xl font-bold text-emerald-300">03</p>
              <p className="mt-3 font-bold text-white">Translate</p>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                Generate English text
              </p>
            </div>
            <div className="mt-7 rounded-2xl border border-white/10 bg-white/[0.06] p-5 backdrop-blur-sm">
              <p className="text-2xl font-bold text-emerald-300">04</p>
              <p className="mt-3 font-bold text-white">Evaluate</p>
              <p className="mt-1 text-sm leading-5 text-slate-400">
                Compare OCR with reference text
              </p>
            </div>
          </div>
        </div>
      </section>

      <section
        id="workspace"
        className="mx-auto max-w-7xl scroll-mt-6 px-5 py-10 sm:px-8 sm:py-14"
      >
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
              Your workspace
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
              Manuscript studio
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
              Upload an image, extract the text, refine the transcription, and
              create an English translation.
            </p>
          </div>
          <button
            onClick={resetProject}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            Reset workspace
          </button>
        </div>

        {error && (
          <div
            role="alert"
            className="mb-5 flex items-start justify-between gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p>{error}</p>
            <button
              onClick={() => setError("")}
              className="font-bold"
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {notice && !error && (
          <div
            role="status"
            className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
          >
            {notice}
          </div>
        )}

        <div className="grid items-start gap-6 lg:grid-cols-2">
          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 font-bold text-emerald-800">
                  01
                </div>
                <div>
                  <h3 className="font-bold">Manuscript image</h3>
                  <p className="text-xs text-slate-500">
                    JPG, PNG, WEBP · Maximum 15 MB
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(event) =>
                  chooseFile(event.target.files?.[0])
                }
              />

              {!imageUrl ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex min-h-64 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 px-6 py-10 text-center transition hover:border-emerald-500 hover:bg-emerald-50/40"
                >
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-800">
                    ↑
                  </div>
                  <p className="mt-4 font-bold text-slate-800">
                    Choose a manuscript image
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    Browse files on your device
                  </p>
                  <span className="mt-5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white">
                    Select image
                  </span>
                </button>
              ) : (
                <>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
                    <div className="flex items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 py-2.5">
                      <span className="max-w-[65%] truncate text-xs font-semibold text-slate-600">
                        {file?.name}
                      </span>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
                      >
                        Change image
                      </button>
                    </div>
                    <div className="flex max-h-[500px] min-h-64 items-center justify-center overflow-auto p-4">
                      <img
                        src={imageUrl}
                        alt="Uploaded Hindi manuscript"
                        className="h-auto max-w-full rounded-md object-contain shadow-sm"
                        style={{
                          width: `${zoom}%`,
                          maxWidth: "none",
                        }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="font-semibold text-slate-700">
                        Image zoom
                      </span>
                      <span className="font-mono text-slate-500">
                        {zoom}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min="50"
                      max="200"
                      step="10"
                      value={zoom}
                      onChange={(event) => setZoom(Number(event.target.value))}
                      className="mt-3 w-full accent-emerald-700"
                      aria-label="Image zoom"
                    />
                    <div className="mt-1 flex justify-between text-xs text-slate-400">
                      <span>50%</span>
                      <span>200%</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">Dimensions</p>
                      <p className="mt-1 text-sm font-bold">
                        {imageSize.width} × {imageSize.height}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 p-3">
                      <p className="text-xs text-slate-500">File size</p>
                      <p className="mt-1 text-sm font-bold">
                        {file ? (file.size / 1024).toFixed(1) + " KB" : "—"}
                      </p>
                    </div>
                  </div>
                </>
              )}

              <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 p-4">
                <input
                  type="checkbox"
                  checked={enhance}
                  onChange={(event) => setEnhance(event.target.checked)}
                  className="mt-1 h-4 w-4 accent-emerald-700"
                />
                <span>
                  <span className="block text-sm font-bold">
                    Enhance image before OCR
                  </span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    Apply backend image preprocessing to help improve text
                    readability.
                  </span>
                </span>
              </label>

              <button
                onClick={() => void uploadAndOCR()}
                disabled={!file || loadingOCR}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingOCR ? "Processing manuscript..." : "Extract Hindi text"}
                {!loadingOCR && <span aria-hidden="true">→</span>}
              </button>
            </div>
          </section>

          <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-5 py-5 sm:px-6">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 font-bold text-blue-800">
                  02
                </div>
                <div>
                  <h3 className="font-bold">Hindi transcription</h3>
                  <p className="text-xs text-slate-500">
                    Review and edit the extracted text
                  </p>
                </div>
              </div>
            </div>

            <div className="p-5 sm:p-6">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-800">
                  Devanagari · Hindi
                </span>
                <span className="text-xs text-slate-500">
                  {transcription.trim()
                    ? transcription.trim().split(/\s+/).length
                    : 0}{" "}
                  words
                </span>
              </div>

              <textarea
                value={transcription}
                onChange={(event) => setTranscription(event.target.value)}
                placeholder="Extracted Hindi text will appear here. You can also type or paste text manually..."
                spellCheck={false}
                className="min-h-[280px] w-full resize-y rounded-2xl border border-slate-200 bg-[#fbfcfe] p-4 text-base leading-8 text-slate-800 outline-none transition placeholder:text-sm placeholder:leading-6 placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              />

              {ocrResult && (
                <div className="mt-3 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Detected lines</p>
                    <p className="mt-1 font-bold">
                      {ocrResult.lines_detected ?? "—"}
                    </p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Image enhancement</p>
                    <p className="mt-1 text-sm font-bold">
                      {ocrResult.enhancement_applied ? "Applied" : "Not applied"}
                    </p>
                  </div>
                </div>
              )}

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => void copyText(transcription, "Hindi text")}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {copied === "Hindi text" ? "Copied!" : "Copy text"}
                </button>
                <button
                  onClick={() =>
                    downloadText(transcription, "hindi-transcription.txt")
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Download TXT
                </button>
              </div>

              <div className="my-6 border-t border-slate-100" />

              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-50 font-bold text-violet-800">
                  03
                </div>
                <div>
                  <h3 className="font-bold">English translation</h3>
                  <p className="text-xs text-slate-500">
                    Translate your reviewed transcription
                  </p>
                </div>
              </div>

              <button
                onClick={() => void translateText()}
                disabled={!transcription.trim() || loadingTranslation}
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loadingTranslation
                  ? "Translating..."
                  : "Translate to English"}
                {!loadingTranslation && <span aria-hidden="true">→</span>}
              </button>

              <textarea
                value={translatedText}
                onChange={(event) => setTranslatedText(event.target.value)}
                placeholder="Your English translation will appear here..."
                className="mt-4 min-h-40 w-full resize-y rounded-2xl border border-slate-200 bg-[#fbfcfe] p-4 text-sm leading-7 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  onClick={() => void copyText(translatedText, "English text")}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  {copied === "English text" ? "Copied!" : "Copy translation"}
                </button>
                <button
                  onClick={() =>
                    downloadText(translatedText, "english-translation.txt")
                  }
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Download TXT
                </button>
              </div>
            </div>
          </section>
        </div>

        <section className="mt-8 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-700">
                Quality check
              </p>
              <h3 className="mt-2 text-xl font-extrabold">
                Live OCR accuracy evaluation
              </h3>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Paste a trusted Hindi transcription below to compare it with
                your OCR output. The score uses word-level edit distance and is
                an estimate, not a measure of translation quality.
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
              Reference comparison
            </span>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <div>
              <label
                htmlFor="referenceText"
                className="mb-2 block text-sm font-bold text-slate-700"
              >
                Reference Hindi text
              </label>
              <textarea
                id="referenceText"
                value={referenceText}
                onChange={(event) => setReferenceText(event.target.value)}
                placeholder="Paste the correct Hindi text here..."
                className="min-h-36 w-full resize-y rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm leading-7 outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10"
              />
            </div>

            <div>
              <p className="mb-2 text-sm font-bold text-slate-700">
                Evaluation results
              </p>
              <div className="flex min-h-36 flex-col justify-center rounded-2xl border border-slate-200 bg-slate-50 p-5">
                {accuracy ? (
                  <>
                    <div className="flex items-end justify-between gap-3">
                      <span className="text-sm text-slate-500">
                        Estimated word accuracy
                      </span>
                      <span className="text-3xl font-black text-emerald-700">
                        {accuracy.accuracy.toFixed(1)}%
                      </span>
                    </div>
                    <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-emerald-600 transition-all"
                        style={{ width: `${accuracy.accuracy}%` }}
                      />
                    </div>
                    <p className="mt-3 text-xs text-slate-500">
                      Reference words: {accuracy.total} · Estimated matching
                      words: {accuracy.correct}
                    </p>
                  </>
                ) : (
                  <div>
                    <p className="font-semibold text-slate-700">
                      Waiting for reference text
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-500">
                      Enter reference text and transcription to calculate a
                      comparison score.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </section>

      <section
        id="evaluation"
        className="scroll-mt-6 border-y border-slate-200 bg-white"
      >
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-700">
                Model performance
              </p>
              <h2 className="mt-2 text-3xl font-extrabold tracking-tight">
                Evaluation dashboard
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
                Review the saved batch evaluation data from your project when
                the CSV file is available.
              </p>
            </div>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              {evaluationRows.length} saved records
            </span>
          </div>

          {evaluationLoading ? (
            <div className="mt-7 rounded-2xl border border-slate-200 p-8 text-center text-sm text-slate-500">
              Loading evaluation data...
            </div>
          ) : evaluationError ? (
            <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="font-bold text-slate-700">
                No saved evaluation data loaded
              </p>
              <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-500">
                {evaluationError} Place the evaluation CSV at{" "}
                <code className="rounded bg-slate-200 px-1.5 py-0.5">
                  frontend/public/evaluation/batch_results.csv
                </code>{" "}
                to display your saved batch results here.
              </p>
            </div>
          ) : evaluationRows.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">
              The evaluation CSV contains no data records yet.
            </div>
          ) : (
            <>
              <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <MetricCard
                  label="Evaluation records"
                  value={String(evaluationRows.length)}
                  detail="Rows loaded from the saved CSV"
                />
                <MetricCard
                  label="Detected columns"
                  value={String(Object.keys(evaluationRows[0]).length)}
                  detail="Fields present in the evaluation file"
                />
                <MetricCard
                  label="Average saved score"
                  value={
                    averageSavedAccuracy
                      ? `${averageSavedAccuracy.value.toFixed(1)}%`
                      : "Not available"
                  }
                  detail={
                    averageSavedAccuracy
                      ? `Calculated from ${averageSavedAccuracy.key}`
                      : "No recognizable numeric accuracy or error-rate column"
                  }
                />
              </div>

              <div className="mt-7 overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full min-w-[600px] border-collapse text-left text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      {Object.keys(evaluationRows[0]).map((header) => (
                        <th
                          key={header}
                          className="border-b border-slate-200 px-4 py-3 font-bold text-slate-700"
                        >
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {evaluationRows.slice(0, 50).map((row, index) => (
                      <tr
                        key={index}
                        className="transition hover:bg-emerald-50/40"
                      >
                        {Object.keys(evaluationRows[0]).map((header) => (
                          <td
                            key={header}
                            className="max-w-xs border-b border-slate-100 px-4 py-3 text-slate-600"
                          >
                            <span className="block truncate">
                              {row[header] || "—"}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
                {evaluationRows.length > 50 && (
                  <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
                    Showing the first 50 of {evaluationRows.length} records.
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <footer className="bg-slate-950 text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-7 sm:px-8">
          <div>
            <p className="font-bold text-white">
              ScriptSage <span className="text-emerald-400">AI</span>
            </p>
            <p className="mt-1 text-xs">
              AI-assisted manuscript transcription and translation
            </p>
          </div>
          <p className="text-xs">
            Digital heritage · Language technology · Research
          </p>
        </div>
      </footer>
    </main>
  );
}
