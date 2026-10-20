export type AccuracyResult = {
  cer: number;
  wer: number;
  characterErrors: number;
  wordErrors: number;
  referenceCharacters: number;
  referenceWords: number;
};

function editDistance<T>(reference: T[], predicted: T[]): number {
  const previous = Array.from({ length: predicted.length + 1 }, (_, index) => index);

  for (let i = 1; i <= reference.length; i++) {
    const current = new Array<number>(predicted.length + 1);
    current[0] = i;

    for (let j = 1; j <= predicted.length; j++) {
      const cost = reference[i - 1] === predicted[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }

    for (let j = 0; j <= predicted.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[predicted.length];
}

export function calculateAccuracy(referenceText: string, predictedText: string): AccuracyResult {
  const normalize = (text: string) => text.normalize("NFC").replace(/\s+/gu, " ").trim();
  const reference = normalize(referenceText);
  const predicted = normalize(predictedText);
  const referenceCharacters = Array.from(reference);
  const predictedCharacters = Array.from(predicted);
  const referenceWords = reference ? reference.split(" ") : [];
  const predictedWords = predicted ? predicted.split(" ") : [];
  const characterErrors = editDistance(referenceCharacters, predictedCharacters);
  const wordErrors = editDistance(referenceWords, predictedWords);

  return {
    cer: referenceCharacters.length ? (characterErrors / referenceCharacters.length) * 100 : 0,
    wer: referenceWords.length ? (wordErrors / referenceWords.length) * 100 : 0,
    characterErrors,
    wordErrors,
    referenceCharacters: referenceCharacters.length,
    referenceWords: referenceWords.length,
  };
}
