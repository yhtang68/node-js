import { printDebug } from "./debug";

function isAnagrams(a: string, b: string): boolean {
  const aChars = [...a];
  const bChars = [...b];

  if (aChars.length !== bChars.length) return false;

  const bCharsMap = new Map();

  bChars.forEach((val) => {
    bCharsMap.set(val, (bCharsMap.get(val) || 0) + 1);
  });

  for (const curr of aChars) {
    const count = bCharsMap.get(curr);

    if (!count) return false;

    if (count === 1) bCharsMap.delete(curr);
    else bCharsMap.set(curr, count - 1);
  }

  return bCharsMap.size === 0;
}

function main() {
  const a = "listen";
  const b = "silent";

  printDebug({
    fileName: __filename,
    test: { a, b },
  });

  console.log(isAnagrams(a, b));
}

main();
