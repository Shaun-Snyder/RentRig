"use client";

import { useFormStatus } from "react-dom";

type SaveButtonProps = {
  idleText?: string;
  pendingText?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
};

export default function SaveButton({
  idleText = "Save",
  pendingText = "Saving...",
  size = "md",
  className,
}: SaveButtonProps) {
  const { pending } = useFormStatus();

  const sizeClass =
    size === "lg" ? "rr-btn-lg" : size === "sm" ? "rr-btn-sm" : "";

  const buttonClass = className ?? `rr-btn rr-btn-primary ${sizeClass}`.trim();

  return (
    <button type="submit" disabled={pending} className={buttonClass}>
      {pending ? pendingText : idleText}
    </button>
  );
}
