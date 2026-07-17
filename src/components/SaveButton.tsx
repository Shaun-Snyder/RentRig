"use client";

import { useFormStatus } from "react-dom";

type SaveButtonProps = {
  idleText?: string;
  pendingText?: string;
  className?: string;
};

export default function SaveButton({
  idleText = "Save",
  pendingText = "Saving...",
  className = "rr-btn rr-btn-primary",
}: SaveButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? pendingText : idleText}
    </button>
  );
}
