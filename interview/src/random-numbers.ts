import _ from "lodash";

class Generator {
  /**
   * Make this function faster.
   * Do not change its output probability distribution.
   * Later, I found out that the function is supposed to generate a random list of unique integers from 1 to n, 
   * but it may not always generate the given amount, because random may repeat. 
   * So we need to keep generating until we have n unique numbers.
   **/
  generateRandomList(n: number): number[] {
    const result: number[] = [];

    for (let i = 0; i < n; i++) {
      const x = Math.floor(Math.random() * n) + 1; // [1, n]
      if (!result.includes(x)) {
        // using Map<key:random, value:count>
        result.push(x);
      }
    }

    return result;
  }

  // This solution is faster than the original since we use a Map for O(1) lookups instead of Array.includes which is O(n).
  // And it still generates a random list of unique integers from 1 to n, 
  // but it didn't fix the issue that we may not get n unique numbers, so we need to keep generating until we have n unique numbers.
  // And this is expected, because during the interview, it was not the requirement to always generate n unique numbers, 
  // but to make the function faster while keeping the same probability distribution.
  generateRandomList2(n: number): number[] {
    // const result: number[] = [];
    const result: Map<number, number> = new Map<number, number>();

    for (let i = 0; i < n; i++) {
      const x = Math.floor(Math.random() * n) + 1; // [1, n]
      if (!result.get(x)) {
        // using Map<key:random, value:count>
        result.set(x, 1);
      }
    }

    return [...result.keys()];
  }

  // 1) Array + includes (baseline - slowest)
  generateRandomList_Array(n: number): number[] {
    const result: number[] = [];

    while (result.length < n) {
      const x = Math.floor(Math.random() * n) + 1;

      if (!result.includes(x)) {
        result.push(x);
      }
    }

    return result;
  }

  // 2) Set (faster than array since O(1) lookup)
  generateRandomList_Set(n: number): number[] {
    const seen = new Set<number>();

    while (seen.size < n) {
      const x = Math.floor(Math.random() * n) + 1; // [1..n]
      seen.add(x); // duplicates automatically ignored
    }

    return [...seen];
  }

  // 3) Map (similar to Set, but we store a dummy value)
  generateRandomList_Map(n: number): number[] {
    const map = new Map<number, true>();

    while (map.size < n) {
      const x = Math.floor(Math.random() * n) + 1; // [1..n]

      if (!map.has(x)) {
        map.set(x, true); // value doesn't matter
      }
    }

    return [...map.keys()];
  }

  // 4) Fisher–Yates Shuffle (optimal solution)
  generateRandomList_FY(n: number): number[] {
    // Step 1: build ordered array
    const result = Array.from({ length: n }, (_, i) => i + 1);

    // Step 2: shuffle in-place
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1)); // [0..i]
      [result[i], result[j]] = [result[j], result[i]];
    }

    return result;
  }
}

function test_Generator() {
  const generator = new Generator();
  const n = 1000;

  const tests: Array<{ name: string; fn: (n: number) => number[] }> = [
    { name: "Array", fn: (n) => generator.generateRandomList_Array(n) },
    { name: "Set", fn: (n) => generator.generateRandomList_Set(n) },
    { name: "Map", fn: (n) => generator.generateRandomList_Map(n) },
    { name: "Fisher-Yates", fn: (n) => generator.generateRandomList_FY(n) },
  ];

  for (const { name, fn } of tests) {
    const start = process.hrtime.bigint();

    fn(n);

    const end = process.hrtime.bigint();
    const seconds = Number(end - start) / 1e9;

    console.log(`${name}: ${seconds.toFixed(6)}s`);
  }
}

function main2() {
  const generator = new Generator();
  const n = 500;

  // 1) Function pointer array
  // actually no .bind needed since we are using arrow functions, but let's keep it for clarity
  const funcs: { name: string; fn: (n: number) => number[] }[] = [
    { name: "Set", fn: generator.generateRandomList_Set.bind(generator) },
    { name: "Map", fn: generator.generateRandomList_Map.bind(generator) },
    {
      name: "Fisher-Yates",
      fn: generator.generateRandomList_FY.bind(generator),
    },
  ];

  // 2) Run and measure
  for (const { name, fn } of funcs) {
    const start = process.hrtime.bigint();

    fn(n);

    const end = process.hrtime.bigint();

    // 3) Convert to seconds
    const seconds = Number(end - start) / 1_000_000_000;

    console.log(`${name} took: ${seconds.toFixed(6)} seconds`);
  }
}

test_Generator();
