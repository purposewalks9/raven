import { tokenize } from "./lexer/token.js";
import { Parser } from "./parser/parser.js";
import { TypeChecker } from "./typechecker/checker.js";
import { Emitter } from "./emitter/emitter.js";
import { writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

const source = `// ============================================
// Raven Algorithms Lab
// A tour through recursion, iteration, arrays,
// searching, sorting, and a bit of geometry.
// ============================================

fn factorial(n: number): number
    if n <= 1 then
        return 1
    end
    return n * factorial(n - 1)
end

fn power(base: number, exp: number): number
    if exp == 0 then
        return 1
    end
    return base * power(base, exp - 1)
end

fn gcd(a: number, b: number): number
    let x: number = a
    let y: number = b
    while y > 0 do
        const remainder: number = x % y
        x = y
        y = remainder
    end
    return x
end

fn distance(x1: number, y1: number, x2: number, y2: number): number
    const dx: number = x1 - x2
    const dy: number = y1 - y2
    return sqrt(dx * dx + dy * dy)
end

fn absoluteDifference(a: number, b: number): number
    return abs(a - b)
end

fn isPrime(n: number): boolean
    if n < 2 then
        return false
    end
    const limit: number = n / 2
    let i: number = 2
    while i <= limit do
        if n % i == 0 then
            return false
        end
        i = i + 1
    end
    return true
end

fn isPerfectSquare(n: number): boolean
    let i: number = 1
    while i * i <= n do
        if i * i == n then
            return true
        end
        i = i + 1
    end
    return false
end

fn isFibonacci(n: number): boolean
    const a: number = 5 * n * n + 4
    const b: number = 5 * n * n - 4
    return isPerfectSquare(a) or isPerfectSquare(b)
end

fn findMysteriousNumbers(count: number): array<number>
    let result: array<number> = []
    let num: number = 1
    let found: number = 0
    while found < count do
        if isPrime(num) and isFibonacci(num) then
            result = result + num
            found = found + 1
        end
        num = num + 1
    end
    return result
end

fn bubbleSort(arr: array<number>): array<number>
    const n: number = arr.length
    let i: number = 0
    while i < n do
        let j: number = 0
        while j < n - i - 1 do
            if arr[j] > arr[j + 1] then
                const temp: number = arr[j]
                arr[j] = arr[j + 1]
                arr[j + 1] = temp
            end
            j = j + 1
        end
        i = i + 1
    end
    return arr
end

fn linearSearch(arr: array<number>, target: number): number
    let i: number = 0
    while i < arr.length do
        if arr[i] == target then
            return i
        end
        i = i + 1
    end
    return 0 - 1
end

fn traceOfMatrix(matrix: array<array<number>>, size: number): number
    let sum: number = 0
    let i: number = 0
    while i < size do
        sum = sum + matrix[i][i]
        i = i + 1
    end
    return sum
end

fn doubleDiagonal(matrix: array<array<number>>, size: number): array<array<number>>
    let i: number = 0
    while i < size do
        matrix[i][i] = matrix[i][i] * 2
        i = i + 1
    end
    return matrix
end

fn printMatrix(matrix: array<array<number>>, size: number): boolean
    let i: number = 0
    while i < size do
        let rowStr: string = ""
        let j: number = 0
        while j < size do
            rowStr = rowStr + matrix[i][j]
            if j < size - 1 then
                rowStr = rowStr + " "
            end
            j = j + 1
        end
        print(rowStr)
        i = i + 1
    end
    return true
end

print("🔮 RAVEN ALGORITHMS LAB 🔮")
print("")

print("--- Recursion ---")
print("5! = " + factorial(5))
print("2^10 = " + power(2, 10))
print("")

print("--- Euclidean GCD ---")
print("gcd(48, 18) = " + gcd(48, 18))
print("")

print("--- Geometry ---")
print("distance((0,0), (3,4)) = " + distance(0, 0, 3, 4))
print("|7 - 19| = " + absoluteDifference(7, 19))
print("")

print("--- Prime & Fibonacci Hunters ---")
const mysterious: array<number> = findMysteriousNumbers(6)
let m: number = 0
while m < mysterious.length do
    print("  #" + (m + 1) + ": " + mysterious[m])
    m = m + 1
end
print("")

print("--- Sorting ---")
const unsorted: array<number> = [64, 34, 25, 12, 22, 11, 90, 5]
print("Before: " + toString(unsorted.length) + " elements")
const sorted: array<number> = bubbleSort(unsorted)
let s: number = 0
let sortedLine: string = ""
while s < sorted.length do
    sortedLine = sortedLine + sorted[s]
    if s < sorted.length - 1 then
        sortedLine = sortedLine + ", "
    end
    s = s + 1
end
print("Sorted: " + sortedLine)
print("")

print("--- Searching ---")
const foundIndex: number = linearSearch(sorted, 25)
const missingIndex: number = linearSearch(sorted, 999)
print("Index of 25: " + foundIndex)
print("Index of 999: " + missingIndex)
print("")

print("--- Matrix Mischief ---")
const matrix: array<array<number>> = [
    [1, 2, 3],
    [4, 5, 6],
    [7, 8, 9]
]
print("Original matrix:")
printMatrix(matrix, 3)
print("Trace: " + traceOfMatrix(matrix, 3))
const doubled: array<array<number>> = doubleDiagonal(matrix, 3)
print("")
print("After doubling the diagonal:")
printMatrix(doubled, 3)
print("Trace: " + traceOfMatrix(doubled, 3))
print("")

print("✨ Lab complete! ✨")
`;

console.log("=== RAVEN SOURCE ===");
console.log(source);

console.log("=== TOKENS ===");
const tokens = tokenize(source);
console.log(tokens);

console.log("=== AST ===");
const ast = new Parser(tokens).parseProgram();
console.log(JSON.stringify(ast, null, 2));

console.log("=== TYPE CHECK ===");
const errors = new TypeChecker().check(ast);
if (errors.length > 0) {
    console.log("Found type errors:");
    errors.forEach(e => console.log("  - " + e));
    process.exit(1);
}
console.log("No type errors ✔");

console.log("=== GENERATED JS ===");
const js = new Emitter().emit(ast);
console.log(js);

console.log("=== ACTUAL OUTPUT (real Node execution) ===");
writeFileSync("./tmp-demo.js", js);
const output = execSync("node ./tmp-demo.js").toString();
console.log(output);