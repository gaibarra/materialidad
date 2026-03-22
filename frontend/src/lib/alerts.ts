"use client";

import Swal, { SweetAlertIcon, SweetAlertResult } from "sweetalert2";

const confirmButtonColor = "#059669"; // jade-500
const cancelButtonColor = "#94a3b8"; // slate-400

export function alertSuccess(title: string, text?: string) {
  return Swal.fire({
    icon: "success",
    title,
    text,
    confirmButtonColor,
  });
}

export function alertError(title: string, text?: string) {
  return Swal.fire({
    icon: "error",
    title,
    text,
    confirmButtonColor,
  });
}

export function alertInfo(title: string, text?: string) {
  return Swal.fire({
    icon: "info",
    title,
    text,
    confirmButtonColor,
  });
}

export function alertWarning(title: string, text?: string) {
  return Swal.fire({
    icon: "warning",
    title,
    text,
    confirmButtonColor,
  });
}

export async function confirmAction(options: {
  title: string;
  text?: string;
  confirmButtonText?: string;
  cancelButtonText?: string;
  icon?: SweetAlertIcon;
}): Promise<SweetAlertResult<any>> {
  return Swal.fire({
    icon: options.icon ?? "question",
    title: options.title,
    text: options.text,
    showCancelButton: true,
    confirmButtonText: options.confirmButtonText ?? "Confirmar",
    cancelButtonText: options.cancelButtonText ?? "Cancelar",
    confirmButtonColor,
    cancelButtonColor,
    reverseButtons: true,
    focusCancel: true,
  });
}

export async function alertConfirm(title: string, text?: string): Promise<boolean> {
  const result = await confirmAction({ title, text, icon: "warning" });
  return result.isConfirmed;
}
