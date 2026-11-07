const TYPING_TAGS = ['INPUT', 'TEXTAREA', 'SELECT']

// True when a key was pressed inside something you type or pick in, where keys like "/" and the arrows belong to it
export function isTypingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || TYPING_TAGS.includes(target.tagName))
}
