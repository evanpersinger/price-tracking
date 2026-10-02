import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent, DragEvent } from 'react'
import { uploadReceipt } from './api.ts'
import type { ReceiptResult } from './types.ts'

const RECEIPT_TYPES = ['image/jpeg', 'image/png'] // what POST /api/receipt accepts

interface Props {
  onClose: () => void
  onResult: (result: ReceiptResult) => void
}

// Stops the browser from opening a dropped image in the tab when it lands outside the drop area.
function allowDrop(event: DragEvent) {
  event.preventDefault()
}

export function ReceiptModal({ onClose, onResult }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [isReading, setIsReading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) dialog.showModal()
  }, [])

  async function readReceipt(file: File | undefined) {
    if (!file) return
    if (!RECEIPT_TYPES.includes(file.type)) {
      setError('Use a JPEG or PNG image.')
      return
    }
    setError(null)
    setIsReading(true)
    try {
      onResult(await uploadReceipt(file))
      onClose()
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong, try again.')
      setIsReading(false)
    }
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault()
    setIsDragging(false)
    if (!isReading) void readReceipt(event.dataTransfer.files[0])
  }

  function handleChoose(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // so picking the same file again after an error still fires
    void readReceipt(file)
  }

  return (
    <dialog
      ref={dialogRef}
      className="receipt-modal"
      aria-labelledby="receipt-modal-title"
      onClose={onClose}
      onCancel={(event) => {
        if (isReading) event.preventDefault() // Escape does nothing while the model is working
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !isReading) dialogRef.current?.close()
      }}
      onDragOver={allowDrop}
      onDrop={allowDrop}
    >
      <div className="receipt-modal-body">
        <div className="receipt-modal-head">
          <h2 id="receipt-modal-title">Add a receipt</h2>
          <button
            type="button"
            className="receipt-modal-close"
            aria-label="Close"
            disabled={isReading}
            onClick={() => dialogRef.current?.close()}
          >
            ×
          </button>
        </div>
        <div
          className={isDragging ? 'drop-area drop-area-active' : 'drop-area'}
          onDragOver={(event) => {
            event.preventDefault()
            if (!isReading) setIsDragging(true)
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {isReading ? 'Reading receipt...' : 'Drag a receipt image here'}
        </div>
        {error && (
          <p className="receipt-modal-error" role="alert">
            {error}
          </p>
        )}
        <button type="button" className="choose-file-button" disabled={isReading} onClick={() => inputRef.current?.click()}>
          Choose file
        </button>
        <input ref={inputRef} type="file" accept={RECEIPT_TYPES.join(',')} hidden onChange={handleChoose} />
      </div>
    </dialog>
  )
}
