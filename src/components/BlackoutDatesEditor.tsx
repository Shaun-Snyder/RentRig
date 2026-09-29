"use client";

import { useState } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";

type BlackoutDate = {
  id: string;
  blackout_date: string;
};

function toLocalDateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function fromLocalDateString(value: string) {
  const [year, month, day] = value.split("-").map(Number);

  return new Date(year, month - 1, day);
}

export default function BlackoutDatesEditor({
  listingId,
  initialBlackoutDates,
}: {
  listingId: string;
  initialBlackoutDates: BlackoutDate[];
}) {
  const [blackoutDates, setBlackoutDates] = useState(initialBlackoutDates);

  const selectedDates = blackoutDates.map((item) =>
    fromLocalDateString(item.blackout_date),
  );

  async function toggleDate(date: Date) {
    const blackoutDate = toLocalDateString(date);

    const existing = blackoutDates.find(
      (item) => item.blackout_date === blackoutDate,
    );

    if (existing) {
      const response = await fetch("/api/listing-blackout-dates", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          id: existing.id,
        }),
      });

      if (!response.ok) {
        return;
      }

      setBlackoutDates((current) =>
        current.filter((item) => item.id !== existing.id),
      );

      return;
    }

    const response = await fetch("/api/listing-blackout-dates", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        listingId,
        blackoutDate,
      }),
    });

    if (!response.ok) {
      return;
    }

    const data = await response.json();

    setBlackoutDates((current) => [...current, data.blackoutDate]);
  }

  return (
    <div className="mt-4">
      <DayPicker
        mode="multiple"
        selected={selectedDates}
        onDayClick={toggleDate}
        numberOfMonths={1}
      />

      <div className="mt-3 text-sm text-slate-600">
        Click a date to mark it unavailable. Click it again to remove the
        blackout.
      </div>
    </div>
  );
}
