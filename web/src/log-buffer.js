// Bound the browser buffer by both rows and UTF-16 storage, in linear time.
export function appendBounded(existing, incoming, maxLines = 1500, maxChars = 1024 * 1024) {
  const lines = [...existing, ...incoming].slice(-maxLines)
  let chars = lines.reduce((sum, line) => sum + line.length, 0), start = 0
  while (chars > maxChars && start < lines.length) chars -= lines[start++].length
  return lines.slice(start)
}
