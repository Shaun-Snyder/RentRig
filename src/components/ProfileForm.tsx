
"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/dashboard/actions";

async function normalizeAvatarFile(file: File): Promise<File> {
  if (typeof window === "undefined") return file;

  const nameLower = (file.name || "").toLowerCase();
  const typeLower = (file.type || "").toLowerCase();

  // ---------- HEIC/HEIF -> JPEG ----------
  const isHeic =
    nameLower.endsWith(".heic") ||
    nameLower.endsWith(".heif") ||
    typeLower === "image/heic" ||
    typeLower === "image/heif" ||
    typeLower === "image/heic-sequence" ||
    typeLower === "image/heif-sequence";

  if (isHeic) {
    type Heic2AnyFn = (opts: {
      blob: Blob;
      toType: string;
      quality?: number;
    }) => Promise<Blob | Blob[]>;

    const mod = (await import("heic2any")) as unknown as {
      default?: Heic2AnyFn;
    };

    const heic2any = mod.default ?? (mod as unknown as Heic2AnyFn);

    const out = await heic2any({
      blob: file,
      toType: "image/jpeg",
      quality: 0.9,
    });

    const blob: Blob = Array.isArray(out) ? out[0] : out;
    const base = file.name ? file.name.replace(/\.(heic|heif)$/i, "") : "photo";
    return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
  }

  // ---------- Compress large images ----------
  if (!typeLower.startsWith("image/")) return file;

  const MAX_BYTES = 6 * 1024 * 1024;
  const MAX_DIM = 2400;
  if (file.size <= MAX_BYTES) return file;

  const outType = typeLower.includes("png") ? "image/png" : "image/jpeg";
  const quality = outType === "image/jpeg" ? 0.82 : undefined;

  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });

    const srcW = bitmap.width;
    const srcH = bitmap.height;
    if (!srcW || !srcH) return file;

    const scale = Math.min(1, MAX_DIM / Math.max(srcW, srcH));
    const outW = Math.max(1, Math.round(srcW * scale));
    const outH = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement("canvas");
    canvas.width = outW;
    canvas.height = outH;

    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    ctx.drawImage(bitmap, 0, 0, outW, outH);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outType, quality);
    });

    if (!blob) return file;
    if (blob.size >= file.size) return file;

    const newName = file.name.replace(
      /\.[a-z0-9]+$/i,
      outType === "image/png" ? ".png" : ".jpg"
    );

    return new File([blob], newName, { type: outType, lastModified: Date.now() });
  } catch (e) {
    console.warn("Avatar compress failed; uploading original:", e);
    return file;
  }
}

export default function ProfileForm({
  initialFullName,
  initialPhone,
  initialAvatarUrl,
  initialSummary,
}: {
  initialFullName: string;
  initialPhone: string;
  initialAvatarUrl: string;
  initialSummary: string;
}) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();
  const [localAvatarPreview, setLocalAvatarPreview] = useState<string | null>(null);

  const router = useRouter();

  const avatarUrl = localAvatarPreview || initialAvatarUrl || "";

  return (
    <form
      encType="multipart/form-data"
      action={async (fd) => {
        setMsg("");

        // Normalize avatar (HEIC -> JPEG, compress big files) before sending
        const avatar = fd.get("avatar");
        if (avatar instanceof File && avatar.size > 0) {
          const safeFile = await normalizeAvatarFile(avatar);
          fd.set("avatar", safeFile);
        }

        startTransition(async () => {
          const res = await updateProfile(fd);
          setMsg(res.message);
          router.refresh();
        });
      }}
      className="rr-card grid gap-6 max-w-2xl p-6"
    >
      <h2 className="text-xl font-semibold">Profile</h2>

      <div className="grid gap-6 md:grid-cols-[auto,1fr] items-start">
        {/* Avatar preview + upload */}
        <div className="flex flex-col items-center gap-3">
          <div className="h-24 w-24 rounded-full border-4 border-black overflow-hidden bg-slate-200 flex items-center justify-center">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Profile"
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-slate-700 text-center px-2">
                No photo
              </span>
            )}
          </div>

          <label className="rr-btn rr-btn-secondary rr-btn-sm cursor-pointer">
            <span>Choose photo</span>
            <input
              type="file"
              name="avatar"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (!file) {
                  setLocalAvatarPreview(null);
                  return;
                }
                setLocalAvatarPreview(URL.createObjectURL(file));
              }}
            />
          </label>

          <div className="text-xs text-slate-700 text-center max-w-[9rem]">
            Select an image and click “Save profile” to update your photo.
          </div>
        </div>

        {/* Text fields */}
        <div className="grid gap-4">
          <div className="grid gap-1">
            <label className="text-sm font-medium">Full name</label>
            <input
              name="full_name"
              defaultValue={initialFullName}
              placeholder="Your name"
              className="rr-input w-full"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Phone</label>
            <input
              name="phone"
              defaultValue={initialPhone}
              placeholder="(optional)"
              className="rr-input w-full"
            />
          </div>

          <div className="grid gap-1">
            <label className="text-sm font-medium">Profile summary</label>
            <textarea
              name="profile_summary"
              defaultValue={initialSummary}
              placeholder="Short summary about you"
              className="rr-input w-full min-h-[96px]"
            />
          </div>
        </div>
      </div>

      <button type="submit" disabled={isPending} className="rr-btn rr-btn-primary w-full">
        {isPending ? "Saving..." : "Save profile"}
      </button>

      {msg && <p className="text-sm text-slate-700 mt-1">{msg}</p>}
    </form>
  );
}
