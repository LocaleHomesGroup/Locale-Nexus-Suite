/**
 * A file's size as the file list shows it: whole bytes, whole KB, or MB to one decimal, and "" when the size isn't
 * known. The unit follows the rounded value, so 1,048,064 bytes (1023.5 KB) reads "1.0 MB", never "1024 KB".
 */
export function formatFileSize(n: number | null): string {
  if (n === null) return "";
  if (n < 1024) return `${n} B`;
  const kb = Math.round(n / 1024);
  if (kb < 1024) return `${kb} KB`;
  return `${(n / 1_048_576).toFixed(1)} MB`;
}
