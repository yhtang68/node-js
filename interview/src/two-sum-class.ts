console.log("🔥 FILE EXECUTED");

class Solution {
  twoSum(nums: number[], target: number): number[] {
    const map = new Map<number, number>();

    for (let i = 0; i < nums.length; i++) {
      const num = nums[i]!;
      const complement = target - num;

      if (map.has(complement)) {
        return [map.get(complement)!, i];
      }

      map.set(num, i);
    }

    return [];
  }
}

// 👇 TypeScript-only enum (THIS WILL BREAK node execution expectation)
enum Status {
  SUCCESS = "SUCCESS",
  FAIL = "FAIL"
}

function main(): Status {
  console.log("MAIN STARTED");

  const sol = new Solution();

  const result = sol.twoSum([2, 7, 11, 15, 6, 3], 9);

  console.log("RESULT:", result);

  return Status.SUCCESS;
}

main();