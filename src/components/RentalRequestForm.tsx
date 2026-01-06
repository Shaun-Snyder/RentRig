"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { requestRental } from "@/app/rentals/actions";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import type { DateRange } from "react-day-picker";

type BlockedRange = {
  start: string;
  end_exclusive: string;
  buffer_days?: number | null;
};

function formatMoney(amount: number) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(amount);
}

function parseISO(value: string) {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDaysUTC(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysBetween(start: string, end: string) {
  const a = parseISO(start);
  const b = parseISO(end);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

type ServiceChoice = "none" | "driver" | "driver_labor" | "operator";
type ServiceUnit = "day" | "hour";

type Props = {
  listingId: string;
  pricePerDay: number;
  blocked?: BlockedRange[];
  minRentalDays?: number;
  maxRentalDays?: number;
  securityDeposit?: number;
  cancellationPolicy?: string;

  // delivery
  deliveryMode?: "pickup_only" | "pickup_or_delivery" | "delivery_only";
  deliveryFee?: number;

  // ✅ delivery discount bundle (Step 4.3)
  deliveryDiscountEnabled?: boolean;
  deliveryDiscountAmount?: number;

  // category/license (needed for license block UI)
  category?: "heavy_equipment" | "lifts" | "trailers" | "vans_covered" | "trucks" | "other" | string;
  licenseRequired?: boolean;
  licenseType?: string | null;

  // operator
  operatorEnabled?: boolean;
  operatorRate?: number;
  operatorRateUnit?: "day" | "hour";
  operatorMaxHours?: number;

  // driver
  driverEnabled?: boolean;
  driverDailyEnabled?: boolean;
  driverHourlyEnabled?: boolean;
  driverDayRate?: number;
  driverHourRate?: number;
  driverMaxHours?: number;

  // driver + labor
  driverLaborEnabled?: boolean;
  driverLaborDailyEnabled?: boolean;
  driverLaborHourlyEnabled?: boolean;
  driverLaborDayRate?: number;
  driverLaborHourRate?: number;
  driverLaborMaxHours?: number;
};

export default function RentalRequestForm({
  listingId,
  pricePerDay,
  blocked = [],
  minRentalDays,
  maxRentalDays,
  securityDeposit,
  cancellationPolicy,

  deliveryMode = "pickup_only",
  deliveryFee = 0,

  deliveryDiscountEnabled = false,
  deliveryDiscountAmount = 0,

  category,
  licenseRequired = false,
  licenseType = null,

  operatorEnabled = false,
  operatorRate = 0,
  operatorRateUnit = "day",
  operatorMaxHours,

  driverEnabled = false,
  driverDailyEnabled = false,
  driverHourlyEnabled = false,
  driverDayRate,
  driverHourRate,
  driverMaxHours,

  driverLaborEnabled = false,
  driverLaborDailyEnabled = false,
  driverLaborHourlyEnabled = false,
  driverLaborDayRate,
  driverLaborHourRate,
  driverLaborMaxHours,
}: Props) {
  const [msg, setMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const [range, setRange] = useState<DateRange | undefined>();
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  // delivery UI
  const deliveryAllowed = deliveryMode !== "pickup_only";
  const deliveryForced = deliveryMode === "delivery_only";
  const [deliverySelected, setDeliverySelected] = useState(deliveryForced);

  useEffect(() => {
    if (deliveryForced) setDeliverySelected(true);
    if (!deliveryAllowed) setDeliverySelected(false);
  }, [deliveryForced, deliveryAllowed]);

  // service selection
  const [serviceChoice, setServiceChoice] = useState<ServiceChoice>("none");
  const [serviceUnit, setServiceUnit] = useState<ServiceUnit>("day");
  const [serviceHours, setServiceHours] = useState(1);

  // license confirmation (for heavy equipment/lifts)
  const isHeavyCategory = category === "heavy_equipment" || category === "lifts";
  const needsLicenseBlock = Boolean(isHeavyCategory && licenseRequired);
  const [renterHasLicense, setRenterHasLicense] = useState(false);

  // show options based on what listing offers
  const showDriverOption = Boolean(driverEnabled && (driverDailyEnabled || driverHourlyEnabled));
  const showDriverLaborOption = Boolean(driverLaborEnabled && (driverLaborDailyEnabled || driverLaborHourlyEnabled));

  // keep your existing “operator only heavy/lifts” toggle behavior
  const OPERATOR_ONLY_HEAVY_LIFTS = false;

  const showOperatorOption = Boolean(
    operatorEnabled && operatorRate > 0 && (!OPERATOR_ONLY_HEAVY_LIFTS || isHeavyCategory)
  );

  // If license is required and renter doesn't confirm, force Operator (UI guard)
  useEffect(() => {
    if (needsLicenseBlock && !renterHasLicense) {
      if (showOperatorOption) setServiceChoice("operator");
      else setServiceChoice("none");
    }
  }, [needsLicenseBlock, renterHasLicense, showOperatorOption]);

  // If option isn't available, bounce back to none
  useEffect(() => {
    if (serviceChoice === "driver" && !showDriverOption) setServiceChoice("none");
    if (serviceChoice === "driver_labor" && !showDriverLaborOption) setServiceChoice("none");
    if (serviceChoice === "operator" && !showOperatorOption) setServiceChoice("none");
  }, [serviceChoice, showDriverOption, showDriverLaborOption, showOperatorOption]);

  // If service choice changes, default unit to what’s available
  useEffect(() => {
    if (serviceChoice === "driver") {
      if (serviceUnit === "day" && !driverDailyEnabled) setServiceUnit("hour");
      if (serviceUnit === "hour" && !driverHourlyEnabled) setServiceUnit("day");
    }
    if (serviceChoice === "driver_labor") {
      if (serviceUnit === "day" && !driverLaborDailyEnabled) setServiceUnit("hour");
      if (serviceUnit === "hour" && !driverLaborHourlyEnabled) setServiceUnit("day");
    }
    if (serviceChoice === "operator") {
      setServiceUnit(operatorRateUnit);
    }
  }, [
    serviceChoice,
    serviceUnit,
    driverDailyEnabled,
    driverHourlyEnabled,
    driverLaborDailyEnabled,
    driverLaborHourlyEnabled,
    operatorRateUnit,
  ]);

  // ✅ IMPORTANT: days is defined here (fixes your runtime error)
  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    return daysBetween(startDate, endDate);
  }, [startDate, endDate]);

  // hourly caps
  const hourlyCap = useMemo(() => {
    if (serviceChoice === "operator") return operatorMaxHours ?? 24;
    if (serviceChoice === "driver") return driverMaxHours ?? 24;
    if (serviceChoice === "driver_labor") return driverLaborMaxHours ?? 24;
    return 24;
  }, [serviceChoice, operatorMaxHours, driverMaxHours, driverLaborMaxHours]);

  useEffect(() => {
    if (serviceUnit === "hour") {
      setServiceHours((h) => Math.max(1, Math.min(hourlyCap, h)));
    }
  }, [serviceUnit, hourlyCap]);

  const serviceSelected = serviceChoice !== "none";

  const serviceRateUnit: ServiceUnit = useMemo(() => {
    if (serviceChoice === "operator") return operatorRateUnit;
    return serviceUnit;
  }, [serviceChoice, operatorRateUnit, serviceUnit]);

  const serviceRate = useMemo(() => {
    if (serviceChoice === "operator") return operatorRate;

    if (serviceChoice === "driver") {
      if (serviceRateUnit === "day") return Number(driverDayRate ?? 0);
      return Number(driverHourRate ?? 0);
    }

    if (serviceChoice === "driver_labor") {
      if (serviceRateUnit === "day") return Number(driverLaborDayRate ?? 0);
      return Number(driverLaborHourRate ?? 0);
    }

    return 0;
  }, [
    serviceChoice,
    operatorRate,
    serviceRateUnit,
    driverDayRate,
    driverHourRate,
    driverLaborDayRate,
    driverLaborHourRate,
  ]);

  const serviceUnitsUsed = useMemo(() => {
    if (!serviceSelected) return 0;
    if (serviceChoice === "operator") {
      return operatorRateUnit === "day" ? days : serviceHours;
    }
    return serviceRateUnit === "day" ? days : serviceHours;
  }, [serviceSelected, serviceChoice, operatorRateUnit, days, serviceRateUnit, serviceHours]);

  const serviceTotal = useMemo(() => {
    if (!serviceSelected) return 0;
    return serviceUnitsUsed * serviceRate;
  }, [serviceSelected, serviceUnitsUsed, serviceRate]);

  const serviceLabel = useMemo(() => {
    if (serviceChoice === "none") return null;
    if (serviceChoice === "operator") return "Operator";
    if (serviceChoice === "driver") return "Driver";
    return "Driver + Labor";
  }, [serviceChoice]);

  // base rental
  const baseSubtotal = days * pricePerDay;

  // ✅ discount applies only when delivery selected + a service selected + enabled
  const deliveryDiscount = useMemo(() => {
    if (!deliverySelected) return 0;
    if (!serviceSelected) return 0;
    if (!deliveryDiscountEnabled) return 0;
    const amt = Number(deliveryDiscountAmount ?? 0);
    if (amt <= 0) return 0;
    return Math.min(deliveryFee, amt);
  }, [deliverySelected, serviceSelected, deliveryDiscountEnabled, deliveryDiscountAmount, deliveryFee]);

  const deliveryCost = useMemo(() => {
    if (!deliverySelected) return 0;
    return Math.max(0, deliveryFee - deliveryDiscount);
  }, [deliverySelected, deliveryFee, deliveryDiscount]);

  // Service fee (10%) based on subtotal + delivery + service
  const serviceFee = Math.round((baseSubtotal + deliveryCost + serviceTotal) * 0.1 * 100) / 100;

  const total = baseSubtotal + deliveryCost + serviceTotal + serviceFee;
  const deposit = Number(securityDeposit ?? 0);
  const totalPlusDeposit = total + deposit;

  // min/max days guard message
  const minViolation = minRentalDays && days > 0 && days < minRentalDays;
  const maxViolation = maxRentalDays && days > 0 && days > maxRentalDays;

  const canSubmit =
    Boolean(startDate && endDate && days > 0) &&
    !minViolation &&
    !maxViolation &&
    (!needsLicenseBlock || renterHasLicense || (showOperatorOption && serviceChoice === "operator"));

  return (
    <form
      className="rounded-xl border bg-white p-5 shadow-sm grid gap-3 max-w-xl"
      action={(fd) => {
        startTransition(async () => {
          try {
            const res: any = await requestRental(fd);
            setMsg(res?.message ?? "Request failed.");
          } catch (e: any) {
            setMsg(e?.message ?? "Request failed.");
          }
        });
      }}
    >
      <h2 className="text-lg font-semibold">Request this listing</h2>

      <input type="hidden" name="listing_id" value={listingId} />
      <input type="hidden" name="start_date" value={startDate} />
      <input type="hidden" name="end_date" value={endDate} />

      {/* delivery */}
      <input type="hidden" name="delivery_selected" value={deliverySelected ? "true" : "false"} />
      {/* ✅ send discounted delivery fee (server will enforce too) */}
      <input type="hidden" name="delivery_fee" value={deliverySelected ? String(deliveryCost) : "0"} />

      {/* license confirmation snapshot */}
      <input type="hidden" name="renter_has_license" value={renterHasLicense ? "true" : "false"} />

      {/* service snapshot (new unified values) */}
      <input type="hidden" name="service_choice" value={serviceChoice} />
      <input type="hidden" name="service_unit" value={serviceRateUnit} />
      <input
        type="hidden"
        name="service_hours"
        value={String(serviceChoice !== "none" && serviceRateUnit === "hour" ? serviceHours : 0)}
      />
      <input type="hidden" name="service_rate" value={String(serviceRate)} />
      <input type="hidden" name="service_total" value={String(serviceTotal)} />

      {/* keep legacy operator snapshot */}
      <input type="hidden" name="operator_selected" value={serviceChoice === "operator" ? "true" : "false"} />
      <input type="hidden" name="operator_rate" value={String(operatorRate)} />
      <input type="hidden" name="operator_rate_unit" value={operatorRateUnit} />
      <input type="hidden" name="operator_days" value={String(serviceChoice === "operator" && operatorRateUnit === "day" ? days : 0)} />
      <input type="hidden" name="operator_hours" value={String(serviceChoice === "operator" && operatorRateUnit === "hour" ? serviceHours : 0)} />
      <input type="hidden" name="operator_total" value={String(serviceChoice === "operator" ? serviceTotal : 0)} />

      <DayPicker
        mode="range"
        selected={range}
        onSelect={(r) => {
          if (!r?.from || !r?.to) return;
          setRange(r);
          setStartDate(r.from.toISOString().slice(0, 10));
          setEndDate(addDaysUTC(r.to, 1).toISOString().slice(0, 10));
        }}
        numberOfMonths={2}
        disabled={(d) => {
          const now = new Date();
          // disallow past dates
          if (d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return true;

          // block booked ranges
          for (const b of blocked) {
            const start = parseISO(b.start);
            const endEx = parseISO(b.end_exclusive);
            if (d >= start && d < endEx) return true;
          }
          return false;
        }}
      />

      {(minViolation || maxViolation) && (
        <div className="rounded-lg border bg-white p-3 text-sm text-amber-700">
          {minViolation ? <div>Minimum rental is {minRentalDays} day(s).</div> : null}
          {maxViolation ? <div>Maximum rental is {maxRentalDays} day(s).</div> : null}
        </div>
      )}

      {needsLicenseBlock && (
        <div className="rounded-lg border bg-white p-3 text-sm">
          <div className="font-semibold mb-2">License required</div>
          <div className="text-slate-600">
            This listing requires a license{licenseType ? ` (${licenseType})` : ""}. If you don’t have it, you must add an Operator.
          </div>

          <label className="flex items-center gap-2 mt-2">
            <input checked={renterHasLicense} onChange={(e) => setRenterHasLicense(e.target.checked)} type="checkbox" />
            <span>I have the required license</span>
          </label>
        </div>
      )}

      <div className="rounded-lg border bg-white p-3 text-sm">
        <div className="font-semibold mb-2">Driver / Operator options</div>

        <label className="grid gap-1">
          <span className="text-sm text-slate-600">Select service</span>
          <select
            value={serviceChoice}
            onChange={(e) => setServiceChoice(e.target.value as ServiceChoice)}
            className="border rounded-lg p-2"
            disabled={needsLicenseBlock && !renterHasLicense}
          >
            <option value="none">No driver / operator</option>
            {showDriverOption && <option value="driver">Driver</option>}
            {showDriverLaborOption && <option value="driver_labor">Driver + Labor</option>}
            {showOperatorOption && <option value="operator">Operator</option>}
          </select>
        </label>

        {serviceChoice !== "none" && (
          <div className="grid gap-2 mt-3">
            <label className="grid gap-1">
              <span className="text-sm text-slate-600">Billing</span>
              <select
                value={serviceRateUnit}
                onChange={(e) => {
                  if (serviceChoice === "operator") return;
                  setServiceUnit(e.target.value as ServiceUnit);
                }}
                className="border rounded-lg p-2"
                disabled={serviceChoice === "operator"}
              >
                {serviceChoice === "operator" ? (
                  <option value={operatorRateUnit}>{operatorRateUnit === "day" ? "Daily rate" : "Hourly rate (estimate)"}</option>
                ) : (
                  <>
                    {serviceChoice === "driver" && driverDailyEnabled && <option value="day">Daily rate</option>}
                    {serviceChoice === "driver" && driverHourlyEnabled && <option value="hour">Hourly rate (estimate)</option>}
                    {serviceChoice === "driver_labor" && driverLaborDailyEnabled && <option value="day">Daily rate</option>}
                    {serviceChoice === "driver_labor" && driverLaborHourlyEnabled && <option value="hour">Hourly rate (estimate)</option>}
                  </>
                )}
              </select>
            </label>

            {serviceRateUnit === "hour" && (
              <label className="grid gap-1">
                <span className="text-sm text-slate-600">Estimated hours (max {hourlyCap})</span>
                <input
                  type="number"
                  min={1}
                  max={hourlyCap}
                  step={1}
                  value={serviceHours}
                  onChange={(e) => setServiceHours(Math.max(1, Math.min(hourlyCap, Number(e.target.value) || 1)))}
                  className="border rounded-lg p-2"
                />
                <span className="text-xs text-slate-500">Hourly services are estimates at booking. Final hours are billed after completion.</span>
              </label>
            )}

            <div className="text-slate-600">
              {serviceLabel} rate: <span className="font-semibold">{formatMoney(serviceRate)}</span>{" "}
              {serviceRateUnit === "day" ? "/day" : "/hour"}
            </div>
          </div>
        )}
      </div>

      {deliveryAllowed && (
        <div className="rounded-lg border bg-white p-3 text-sm">
          <div className="font-semibold mb-2">Delivery</div>

          {deliveryForced ? (
            <div className="text-slate-600">Delivery is required for this listing.</div>
          ) : (
            <label className="flex items-center gap-2">
              <input checked={deliverySelected} onChange={(e) => setDeliverySelected(e.target.checked)} type="checkbox" />
              <span>Request delivery ({formatMoney(deliveryFee)})</span>
            </label>
          )}
        </div>
      )}

      <div className="rounded-lg border bg-white p-3 text-sm">
        <div className="font-semibold">Price breakdown</div>

        <div className="mt-2 grid gap-1">
          <div className="flex justify-between">
            <span>Rental ({days} days)</span>
            <span>{formatMoney(baseSubtotal)}</span>
          </div>

          {serviceSelected && (
            <div className="flex justify-between">
              <span>{serviceLabel} ({serviceRateUnit === "day" ? `${days} days` : `${serviceHours} hours (est.)`})</span>
              <span>{formatMoney(serviceTotal)}</span>
            </div>
          )}

          {deliverySelected && (
            <>
              <div className="flex justify-between">
                <span>Delivery</span>
                <span>{formatMoney(deliveryCost)}</span>
              </div>

              {deliveryDiscount > 0 && (
                <div className="flex justify-between">
                  <span>Delivery discount</span>
                  <span>-{formatMoney(deliveryDiscount)}</span>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between">
            <span>Service fee (10%)</span>
            <span>{formatMoney(serviceFee)}</span>
          </div>

          <div className="border-t my-2" />

          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>{formatMoney(total)}</span>
          </div>

          {deposit > 0 && (
            <div className="flex justify-between font-semibold">
              <span>Total + deposit</span>
              <span>{formatMoney(totalPlusDeposit)}</span>
            </div>
          )}
        </div>

        {cancellationPolicy ? (
          <div className="mt-3 text-xs text-slate-500">Cancellation policy: {cancellationPolicy}</div>
        ) : null}
      </div>

      <label className="grid gap-1">
        <span className="text-sm text-slate-600">Message to owner (optional)</span>
        <textarea name="message" className="border rounded-lg p-2" rows={4} />
      </label>

      <button
  className="rr-btn rr-btn-primary w-full"
  disabled={isPending || !canSubmit}
>
  {isPending ? "Sending..." : "Request rental"}
</button>

      {!canSubmit && (
        <div className="text-xs text-amber-700">
          {needsLicenseBlock && !renterHasLicense && showOperatorOption
            ? "Confirm license or select Operator to continue."
            : "Select valid dates and meet listing requirements to continue."}
        </div>
      )}

      {msg && <div className="text-sm">{msg}</div>}
    </form>
  );
}
