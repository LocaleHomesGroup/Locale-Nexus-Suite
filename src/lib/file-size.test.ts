import { test } from "node:test";
import assert from "node:assert/strict";
import { formatFileSize } from "./file-size";

// Bytes in, what the file list shows. 1,048,064 bytes is 1023.5 KB, which rounds to 1024: the unit follows the
// rounded value, so it moves to MB there and the list never prints "1024 KB".
const ROWS: readonly (readonly [number | null, string])[] = [
  [null, ""],
  [0, "0 B"],
  [1023, "1023 B"],
  [1024, "1 KB"],
  [1_048_063, "1023 KB"],
  [1_048_064, "1.0 MB"],
  [1_048_575, "1.0 MB"],
  [1_048_576, "1.0 MB"],
  [52_428_800, "50.0 MB"],
];

for (const [bytes, shows] of ROWS) {
  test(`file size: ${bytes === null ? "no size" : `${bytes} bytes`} shows ${JSON.stringify(shows)}`, () => {
    assert.equal(formatFileSize(bytes), shows);
  });
}

test('file size: nothing near the KB/MB boundary is ever printed as "1024 KB"', () => {
  for (let bytes = 1_040_000; bytes <= 1_050_000; bytes++) {
    assert.notEqual(formatFileSize(bytes), "1024 KB", `${bytes} bytes`);
  }
});
