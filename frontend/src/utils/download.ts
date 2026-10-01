/**
 * Utility for triggering browser file downloads from Blobs.
 * Keeps DOM-level manipulation out of HTTP service layers.
 */
export function saveBlobAsFile(blob: Blob, filename: string): void {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  window.URL.revokeObjectURL(url);
  document.body.removeChild(anchor);
}
