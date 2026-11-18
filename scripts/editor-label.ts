// Match the full Hebrew label, including the optional English translation.
export function editorLabel(hebrew: string) {
  const escaped = hebrew.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp('^' + escaped + '(?: / .+)?$');
}
