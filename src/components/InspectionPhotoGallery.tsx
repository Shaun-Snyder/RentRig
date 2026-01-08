"use client";

import React, { useState, useEffect } from "react";

type InspectionPhotoGalleryProps = {
  photos: string[];
};

export default function InspectionPhotoGallery({
  photos,
}: InspectionPhotoGalleryProps) {
  const [activeUrl, setActiveUrl] = useState<string | null>(null);

  if (!photos || photos.length === 0) {
    return null;
  }

  // Allow closing with ESC
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setActiveUrl(null);
      }
    }
    if (activeUrl) {
      window.addEventListener("keydown", onKey);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
    };
  }, [activeUrl]);

  return (
    <>
      {/* Thumbnail strip */}
      <div className="mt-2 flex flex-wrap gap-2">
        {photos.map((url, idx) => (
          <button
            key={`${url}-${idx}`}
            type="button"
            onClick={() => setActiveUrl(url)}
            className="overflow-hidden rounded-lg border bg-slate-50 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-black"
          >
            <img
              src={url}
              alt="Inspection photo"
              className="h-20 w-28 object-cover"
            />
          </button>
        ))}
      </div>

      {/* Fullscreen modal */}
      {activeUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
          onClick={() => setActiveUrl(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] rounded-xl bg-black/10 p-2"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setActiveUrl(null)}
              className="absolute right-2 top-2 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white shadow-sm hover:bg-black"
            >
              Close
            </button>

            <img
              src={activeUrl}
              alt="Inspection photo"
              className="max-h-[85vh] max-w-[85vw] rounded-lg shadow-xl"
            />
          </div>
        </div>
      )}
    </>
  );
}
