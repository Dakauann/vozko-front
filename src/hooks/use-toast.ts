"use client"

import type { ReactNode } from "react"
import { toast as sonnerToast, type ExternalToast } from "sonner"

type ToastVariant = "default" | "destructive" | "success"

type ToastInput = {
  title?: ReactNode
  description?: ReactNode
  variant?: ToastVariant | null
  duration?: number
  action?: ExternalToast["action"]
}

type ToastId = string | number

function senderFor(variant: ToastInput["variant"]) {
  if (variant === "destructive") return sonnerToast.error
  if (variant === "success") return sonnerToast.success
  return sonnerToast
}

function toast({ title, description, variant, duration, action }: ToastInput) {
  const hasTitle = title !== undefined && title !== null && title !== ""
  const message = hasTitle ? title : description ?? ""
  const id: ToastId = senderFor(variant)(message, {
    description: hasTitle ? description : undefined,
    duration,
    action,
  })
  return {
    id,
    dismiss: () => {
      sonnerToast.dismiss(id)
    },
  }
}

function dismiss(id?: ToastId) {
  sonnerToast.dismiss(id)
}

function useToast() {
  return { toast, dismiss }
}

export { useToast, toast }
export type { ToastInput }
