"use client";

import { useState, useTransition } from "react";

type AvailabilityRow = {
  id: string;
  weekday: number;
  start_time: string;
  end_time: string;
};

type DayRow = {
  weekday: number;
  name: string;
  enabled: boolean;
  startTime: string;
  endTime: string;
};

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function HourlyAvailabilityEditor({
  listingId,
  availability,
}: {
  listingId: string;
  availability: AvailabilityRow[];
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState("");

  const [days, setDays] = useState<DayRow[]>(() =>
    DAY_NAMES.map((name, weekday) => {
      const existing = availability.find((row) => row.weekday === weekday);

      return {
        weekday,
        name,
        enabled: Boolean(existing),
        startTime: existing?.start_time?.slice(0, 5) ?? "08:00",
        endTime: existing?.end_time?.slice(0, 5) ?? "17:00",
      };
    }),
  );

  function updateDay(weekday: number, changes: Partial<DayRow>) {
    setDays((current) =>
      current.map((day) =>
        day.weekday === weekday ? { ...day, ...changes } : day,
      ),
    );
  }

  function handleSave() {
    setMessage("");

    startTransition(async () => {
      try {
        const response = await fetch("/api/listing-hourly-availability", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            listingId,
            days: days
              .filter((day) => day.enabled)
              .map((day) => ({
                weekday: day.weekday,
                start_time: day.startTime,
                end_time: day.endTime,
              })),
          }),
        });

        const result = await response.json();

        if (!response.ok || !result.ok) {
          setMessage(result.message || "Could not save availability.");
          return;
        }

        setMessage("Saved.");
      } catch {
        setMessage("Could not save availability.");
      }
    });
  }

  return (
    <div className="mt-5 grid gap-3">
      {days.map((day) => (
        <div
          key={day.weekday}
          className="grid gap-3 rounded-lg border border-slate-200 p-4 sm:grid-cols-[140px_1fr] sm:items-center"
        >
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input
              type="checkbox"
              checked={day.enabled}
              onChange={(e) =>
                updateDay(day.weekday, { enabled: e.target.checked })
              }
            />

            {day.name}
          </label>

          {day.enabled ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={day.startTime}
                onChange={(e) =>
                  updateDay(day.weekday, { startTime: e.target.value })
                }
                className="rr-input"
              />

              <span className="text-sm text-slate-500">to</span>

              <input
                type="time"
                value={day.endTime}
                onChange={(e) =>
                  updateDay(day.weekday, { endTime: e.target.value })
                }
                className="rr-input"
              />
            </div>
          ) : (
            <div className="text-sm text-slate-400">Unavailable</div>
          )}
        </div>
      ))}

      <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-slate-200 pt-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={isPending}
          className="rr-btn rr-btn-primary"
        >
          {isPending ? "Saving..." : "Save Weekly Hours"}
        </button>

        {message ? (
          <span className="text-sm font-medium text-slate-600">{message}</span>
        ) : null}
      </div>
    </div>
  );
}
