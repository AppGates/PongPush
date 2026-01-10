// This file intentionally has TypeScript errors to test log downloading

const testValue: number = "this is a string"; // Type error

function brokenFunction() {
  return undefinedVariable; // Reference error
}

export const result = testValue + brokenFunction();
