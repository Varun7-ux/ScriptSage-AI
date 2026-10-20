
export type AccuracyResult = {
  cer: number;
  wer: number;
  characterErrors: number;
  wordErrors: number;
  referenceCharacters: number;
  referenceWords: number;
};

export type WordDifference = {
  type: "correct" | "substitution" | "insertion" | "deletion";
  reference: string;
  predicted: string;
};

function normalizeText(text: string): string {
  return text.normalize("NFC").replace(/\s+/gu, " ").trim();
}

function editDistance<T>(reference: T[], predicted: T[]): number {
  const previous = Array.from(
    { length: predicted.length + 1 },
    (_, index) => index
  );

  for (let i = 1; i <= reference.length; i++) {
    const current = new Array<number>(predicted.length + 1);
    current[0] = i;

    for (let j = 1; j <= predicted.length; j++) {
      const cost = reference[i - 1] === predicted[j - 1] ? 0 : 1;

      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + cost
      );
    }

    for (let j = 0; j <= predicted.length; j++) {
      previous[j] = current[j];
    }
  }

  return previous[predicted.length];
}

export function calculateAccuracy(
  referenceText: string,
  predictedText: string
): AccuracyResult {
  const reference = normalizeText(referenceText);
  const predicted = normalizeText(predictedText);

  const referenceCharacters = Array.from(reference);
  const predictedCharacters = Array.from(predicted);

  const referenceWords = reference ? reference.split(" ") : [];
  const predictedWords = predicted ? predicted.split(" ") : [];

  const characterErrors = editDistance(
    referenceCharacters,
    predictedCharacters
  );

  const wordErrors = editDistance(referenceWords, predictedWords);

  return {
    cer: referenceCharacters.length
      ? (characterErrors / referenceCharacters.length) * 100
      : 0,
    wer: referenceWords.length
      ? (wordErrors / referenceWords.length) * 100
      : 0,
    characterErrors,
    wordErrors,
    referenceCharacters: referenceCharacters.length,
    referenceWords: referenceWords.length,
  };
}

export function compareWords(
  referenceText: string,
  predictedText: string
): WordDifference[] {
  const reference = normalizeText(referenceText);
  const predicted = normalizeText(predictedText);

  const refWords = reference ? reference.split(" ") : [];
  const predWords = predicted ? predicted.split(" ") : [];

  const rows = refWords.length + 1;
  const cols = predWords.length + 1;

  const dp: number[][] = Array.from(
    { length: rows },
    () => Array<number>(cols).fill(0)
  );

  for (let i = 0; i < rows; i++) {
    dp[i][0] = i;
  }

  for (let j = 0; j < cols; j++) {
    dp[0][j] = j;
  }

  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = refWords[i - 1] === predWords[j - 1] ? 0 : 1;

      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  const differences: WordDifference[] = [];

  let i = refWords.length;
  let j = predWords.length;

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      refWords[i - 1] === predWords[j - 1]
    ) {
      differences.push({
        type: "correct",
        reference: refWords[i - 1],
        predicted: predWords[j - 1],
      });

      i--;
      j--;
    } else if (
      i > 0 &&
      j > 0 &&
      dp[i][j] === dp[i - 1][j - 1] + 1
    ) {
      differences.push({
        type: "substitution",
        reference: refWords[i - 1],
        predicted: predWords[j - 1],
      });

      i--;
      j--;
    } else if (
      i > 0 &&
      dp[i][j] === dp[i - 1][j] + 1
    ) {
      differences.push({
        type: "deletion",
        reference: refWords[i - 1],
        predicted: "",
      });

      i--;
    } else {
      differences.push({
        type: "insertion",
        reference: "",
        predicted: predWords[j - 1],
      });

      j--;
    }
  }

  return differences.reverse();
}
