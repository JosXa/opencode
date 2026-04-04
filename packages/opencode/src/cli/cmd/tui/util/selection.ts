import * as Clipboard from "./clipboard"

type Toast = {
  show: (input: { message: string; variant: "info" | "success" | "warning" | "error" }) => void
  error: (err: unknown) => void
}

type Renderer = {
  getSelection: () => { getSelectedText: () => string } | null
  clearSelection: () => void
}

export function text(renderer: Renderer) {
  return renderer.getSelection()?.getSelectedText()
}

export function quote(text: string) {
  return (
    text
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => `> ${line}`)
      .join("\n") + "\n\n"
  )
}

export function copy(renderer: Renderer, toast: Toast): boolean {
  const selected = text(renderer)
  if (!selected) return false

  Clipboard.copy(selected)
    .then(() => toast.show({ message: "Copied to clipboard", variant: "info" }))
    .catch(toast.error)

  renderer.clearSelection()
  return true
}

export const Selection = { text, quote, copy }
