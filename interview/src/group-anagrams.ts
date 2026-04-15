import { printDebug } from "./debug";

function groupAnagrams(strs: string[]): string[][] {
  const map = new Map<string, string[]>();

  for (const str of strs) {
    // 1. create key by sorting characters
    const key = str.split("").sort().join("");

    // 2. initialize bucket if not exists
    if (!map.has(key)) {
      map.set(key, []);
    }

    // 3. add word into correct group
    map.get(key)!.push(str);
  }

  // 4. return grouped results
  return Array.from(map.values());
}

function main() {
  const input = ["eat", "tea", "tan", "ate", "nat", "bat"];

  printDebug({
    fileName: __filename,
    test: { input },
  });

  console.log(groupAnagrams(input));
}

main();
