import { printDebug } from "./debug";

function containsDuplicate(nums: number[], target: number): boolean {
  const set = new Set<number>();

  for (let i = 0; i < nums.length; i++) {
    if (set.has(nums[i])) {
      return true;
    }

    set.add(nums[i]);
  }

  return false;
}

function main() {
  const data = [7, 11, 7, 2];
  const input = 9;

  printDebug({
    fileName: __filename,
    test: { data, input },
  });

  console.log(containsDuplicate(data, input));
}

main();
