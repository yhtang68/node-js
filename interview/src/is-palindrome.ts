/*
 * Write a function that determines whether a given string is a palindrome.
 * A palindrome is a string that reads the same forward and backward, for example: "radar", "level", "madam".
 */

import _ from "lodash";

class PalindromeChecker {
  constructor() { }

  public isPalindrome(str: string) {
    // str.replace(/\s+/g, "")
    // remove the space
    const strTrimmed = str.trim().replaceAll(" ", "");
    //const strTrimmed = str.trim().replace(/\s+/g, "");

    console.log(`strTrimmed: ${strTrimmed}`);

    const strArray = [...strTrimmed];

    if (strArray.length === 0 || strArray.length === 1) {
      return true;
    }

    // e.g. Hannah
    // const isOdd = (str.length % 2 === 1);

    const halfWayIndex = strArray.length / 2;

    //const even
    for (let i = 0, j = strArray.length - 1; i <= halfWayIndex; i++, j--) {
      console.log(`${strArray[i]}, ${strArray[j]}`);
      if (!(strArray[i].toLowerCase() === strArray[j].toLowerCase())) {
        return false;
      }
    }

    return true;
  }
}

let checker = new PalindromeChecker();

let sentence = "Was it a car or a cat I saw";

// let sentence = "Was it a car or a cat I saw";

console.log(checker.isPalindrome(sentence));
