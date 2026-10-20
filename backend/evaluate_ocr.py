
from pathlib import Path
import argparse
import csv


def edit_distance(reference, prediction):
    """Calculate Levenshtein edit distance."""
    previous = list(range(len(prediction) + 1))

    for i, ref_item in enumerate(reference, start=1):
        current = [i]

        for j, pred_item in enumerate(prediction, start=1):
            substitution_cost = 0 if ref_item == pred_item else 1

            current.append(
                min(
                    previous[j] + 1,
                    current[j - 1] + 1,
                    previous[j - 1] + substitution_cost,
                )
            )

        previous = current

    return previous[-1]


def normalize_text(text):
    """Normalize whitespace for fair comparison."""
    return " ".join(text.split())


def calculate_metrics(reference, prediction):
    reference = normalize_text(reference)
    prediction = normalize_text(prediction)

    if not reference:
        raise ValueError("Reference text is empty.")

    if not prediction:
        raise ValueError("Prediction text is empty.")

    reference_words = reference.split()
    prediction_words = prediction.split()

    cer = edit_distance(reference, prediction) / len(reference)
    wer = edit_distance(reference_words, prediction_words) / len(reference_words)

    return cer, wer


def read_text(path):
    """Read a UTF-8 text file."""
    return Path(path).read_text(encoding="utf-8-sig")


def evaluate_single(reference_path, prediction_path):
    reference = read_text(reference_path)
    prediction = read_text(prediction_path)

    cer, wer = calculate_metrics(reference, prediction)

    print("\nScriptSage AI — OCR Evaluation")
    print("-" * 35)
    print(f"Character Error Rate (CER): {cer:.2%}")
    print(f"Word Error Rate (WER):      {wer:.2%}")


def evaluate_batch(folder, output_path):
    """
    Evaluate all sample folders.

    Each sample folder must contain:
        reference.txt
        original.txt
        enhanced.txt
    """
    root = Path(folder)

    if not root.is_dir():
        raise ValueError(f"Evaluation folder does not exist: {root}")

    results = []

    for sample in sorted(root.iterdir()):
        if not sample.is_dir():
            continue

        reference_path = sample / "reference.txt"
        original_path = sample / "original.txt"
        enhanced_path = sample / "enhanced.txt"

        if not all(
            path.is_file()
            for path in (reference_path, original_path, enhanced_path)
        ):
            print(f"Skipping {sample.name}: missing evaluation files.")
            continue

        reference = read_text(reference_path)
        original = read_text(original_path)
        enhanced = read_text(enhanced_path)

        try:
            original_cer, original_wer = calculate_metrics(reference, original)
            enhanced_cer, enhanced_wer = calculate_metrics(reference, enhanced)
        except ValueError as error:
            print(f"Skipping {sample.name}: {error}")
            continue

        results.append({
            "sample": sample.name,
            "original_cer": round(original_cer * 100, 2),
            "original_wer": round(original_wer * 100, 2),
            "enhanced_cer": round(enhanced_cer * 100, 2),
            "enhanced_wer": round(enhanced_wer * 100, 2),
        })

    if not results:
        raise ValueError("No valid evaluation samples found.")

    output = Path(output_path)
    output.parent.mkdir(parents=True, exist_ok=True)

    with output.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=list(results[0].keys()))
        writer.writeheader()
        writer.writerows(results)

    print("\nScriptSage AI — Batch OCR Evaluation")
    print("-" * 55)

    for result in results:
        print(f"\nSample: {result['sample']}")
        print(
            f"Original: CER {result['original_cer']:.2f}% | "
            f"WER {result['original_wer']:.2f}%"
        )
        print(
            f"Enhanced: CER {result['enhanced_cer']:.2f}% | "
            f"WER {result['enhanced_wer']:.2f}%"
        )

    print(f"\nEvaluated {len(results)} sample(s).")
    print(f"CSV report saved to: {output}")


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate ScriptSage AI OCR accuracy."
    )

    parser.add_argument(
        "reference",
        nargs="?",
        help="Correct reference text file"
    )

    parser.add_argument(
        "prediction",
        nargs="?",
        help="OCR transcription text file"
    )

    parser.add_argument(
        "--batch",
        help="Folder containing evaluation sample directories"
    )

    parser.add_argument(
        "--output",
        default="backend/evaluation/batch_results.csv",
        help="Output CSV report path for batch evaluation"
    )

    args = parser.parse_args()

    try:
        if args.batch:
            if args.reference or args.prediction:
                parser.error(
                    "Use either --batch or two text file paths, not both."
                )

            evaluate_batch(args.batch, args.output)
        else:
            if not args.reference or not args.prediction:
                parser.error(
                    "Provide reference and prediction files, or use --batch."
                )

            evaluate_single(args.reference, args.prediction)

    except (OSError, ValueError) as error:
        parser.error(str(error))


if __name__ == "__main__":
    main()

