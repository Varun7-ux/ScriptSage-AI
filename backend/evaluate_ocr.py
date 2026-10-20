
from pathlib import Path
import argparse


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
        raise ValueError(
            "Reference text is empty. Add the correct transcription first."
        )

    if not prediction:
        raise ValueError(
            "Prediction text is empty. Add the OCR output first."
        )

    reference_words = reference.split()
    prediction_words = prediction.split()

    char_errors = edit_distance(reference, prediction)
    word_errors = edit_distance(reference_words, prediction_words)

    cer = char_errors / len(reference)
    wer = word_errors / len(reference_words)

    return cer, wer


def main():
    parser = argparse.ArgumentParser(
        description="Evaluate ScriptSage AI OCR accuracy."
    )

    parser.add_argument(
        "reference",
        help="Correct reference text file"
    )

    parser.add_argument(
        "prediction",
        help="OCR transcription text file"
    )

    args = parser.parse_args()

    try:
        reference = Path(args.reference).read_text(
            encoding="utf-8-sig"
        )

        prediction = Path(args.prediction).read_text(
            encoding="utf-8-sig"
        )

    except FileNotFoundError as error:
        parser.error(f"File not found: {error.filename}")

    except OSError as error:
        parser.error(f"Unable to read file: {error}")

    if not reference.strip():
        parser.error(
            "Reference file is empty. Add the correct Hindi transcription first."
        )

    if not prediction.strip():
        parser.error(
            "Prediction file is empty. Add the OCR output first."
        )

    cer, wer = calculate_metrics(reference, prediction)

    print("\nScriptSage AI — OCR Evaluation")
    print("-" * 35)
    print(f"Character Error Rate (CER): {cer:.2%}")
    print(f"Word Error Rate (WER):      {wer:.2%}")


if __name__ == "__main__":
    main()
