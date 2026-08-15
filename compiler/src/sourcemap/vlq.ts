// Base64 VLQ (variable-length quantity) encoding, as used by the source
// map v3 "mappings" field. Each mapping segment is a small list of signed
// integer deltas encoded as a run of base64 digits, 5 data bits per digit
// with the 6th bit marking "more digits follow".
//
// Reference: https://sourcemaps.info/spec.html

const BASE64_DIGITS =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

const VLQ_BASE_SHIFT = 5;
const VLQ_BASE = 1 << VLQ_BASE_SHIFT; // 32
const VLQ_BASE_MASK = VLQ_BASE - 1; // 0b11111
const VLQ_CONTINUATION_BIT = VLQ_BASE; // 0b100000

/**
 * Converts a signed integer into the VLQ encoding's "sign bit in the
 * lowest bit" representation: `abs(value) << 1`, with bit 0 set when
 * `value` is negative.
 */
function toVlqSigned(value: number): number {
  return value < 0 ? (-value << 1) + 1 : value << 1;
}

function encodeOne(value: number): string {
  let digits = "";
  let vlq = toVlqSigned(value);
  do {
    let digit = vlq & VLQ_BASE_MASK;
    vlq >>>= VLQ_BASE_SHIFT;
    if (vlq > 0) {
      digit |= VLQ_CONTINUATION_BIT;
    }
    digits += BASE64_DIGITS[digit];
  } while (vlq > 0);
  return digits;
}

/** Encodes a sequence of signed integers (one mapping segment's deltas). */
export function encodeVlq(values: number[]): string {
  return values.map(encodeOne).join("");
}
