import { printDebug } from "./debug";

function topFrequent(nums: number[], k: number): number[] {
  // Build Number Map <number, frequency>
  const numberMap = new Map<number, number>();
  for (const num of nums) {
    numberMap.set(num, (numberMap.get(num) || 0) + 1);
  }

  // Build Frequency Map <frequency, numbers[]>
  const freqMap = new Map<number, number[]>();

  for (const [num, freq] of numberMap) {
    if (!freqMap.has(freq)) {
      freqMap.set(freq, []);
    }
    freqMap.get(freq)!.push(num);
  }

  // Get Result numbers[]
  const result: number[] = [];

  // 🔥 FIX: start from max possible frequency
  for (let i = nums.length; i >= 1; i--) {
    if (freqMap.has(i)) {
      for (const num of freqMap.get(i)!) {
        result.push(num);

        // stop when we reach k
        if (result.length === k) {
          return result;
        }
      }
    }
  }

  return result;
}

function main() {
  const data = [7, 11, 7, 2, 2, 3, 3, 3];
  const input = 2;

  printDebug({
    fileName: __filename,
    test: { data, input },
  });

  console.log(topFrequent(data, input));
}

main();
