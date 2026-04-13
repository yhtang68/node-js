import { printDebug } from "./debug";

function twoSum(nums: number[], target: number): number[] {
  const map = new Map<number, number>();

  for (let i = 0; i < nums.length; i++) {
    const complement = target - nums[i]!;

    if (map.has(complement)) {
      return [map.get(complement)!, i];
    }

    map.set(nums[i], i);
  }

  return [];
}

function main() {
  const data = [7, 11, 15, 2];
  const input = 9;

  printDebug({
    fileName: __filename,
    test: { data, input },
  });

  console.log(twoSum(data, input));
}

main();
