"use strict";
var ProjectPlannerCanonical = (() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

  // lib/canonical/bundleEntry.ts
  var bundleEntry_exports = {};
  __export(bundleEntry_exports, {
    bookingBelongsToOrganization: () => bookingBelongsToOrganization,
    coverageWindow: () => coverageWindow,
    dayKeyInOrganizationZone: () => dayKeyInOrganizationZone,
    intervalsOverlap: () => intervalsOverlap,
    invoicingPeriod: () => invoicingPeriod,
    organizationIdFromValue: () => organizationIdFromValue,
    organizationIdsMatch: () => organizationIdsMatch,
    organizationScopedKey: () => organizationScopedKey,
    paidHoursForNamedSlot: () => paidHoursForNamedSlot
  });

  // lib/orgTime/zoneTime.ts
  var LONDON_TIME_ZONE = "Europe/London";
  function partsInZone(date, timeZone) {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    const map = {};
    for (const part of fmt.formatToParts(date)) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    return {
      y: Number(map.year),
      m: Number(map.month),
      d: Number(map.day),
      h: Number(map.hour),
      min: Number(map.minute)
    };
  }
  function dayKeyInZone(date, timeZone) {
    const { y, m, d } = partsInZone(date, timeZone);
    return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  }
  function midnightInZone(date, timeZone) {
    const { y, m, d } = partsInZone(date, timeZone);
    const guess = new Date(Date.UTC(y, m - 1, d, 0, 0, 0));
    const shown = partsInZone(guess, timeZone);
    let deltaMin = shown.h * 60 + shown.min;
    const shownKey = dayKeyInZone(guess, timeZone);
    const wanted = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    if (shownKey < wanted) deltaMin -= 24 * 60;
    else if (shownKey > wanted) deltaMin += 24 * 60;
    return new Date(guess.getTime() - deltaMin * 6e4);
  }
  function addDaysInZone(date, days, timeZone) {
    const { y, m, d } = partsInZone(date, timeZone);
    const noon = new Date(Date.UTC(y, m - 1, d + days, 12, 0, 0));
    return midnightInZone(noon, timeZone);
  }
  function daysInZoneMonth(date, timeZone) {
    const { y, m } = partsInZone(date, timeZone);
    return new Date(Date.UTC(y, m, 0, 12, 0, 0)).getUTCDate();
  }
  function isoWeekdayInZone(date, timeZone) {
    const { y, m, d } = partsInZone(date, timeZone);
    const js = new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
    return js === 0 ? 7 : js;
  }
  function dayOfMonthInZone(date, timeZone) {
    return partsInZone(date, timeZone).d;
  }
  function dateFromDayKeyInZone(key, timeZone) {
    const [y, m, d] = key.split("-").map(Number);
    return midnightInZone(new Date(Date.UTC(y, m - 1, d, 12, 0, 0)), timeZone);
  }

  // lib/canonical/engine.ts
  var CANONICAL_TIME_ZONE = LONDON_TIME_ZONE;
  var CANONICAL_HALF_MONTH_RANGES = [
    { startDay: 1, endDay: 15 },
    { startDay: 16, endDay: 31 }
  ];
  var WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
  function organizationIdsMatch(lhs, rhs) {
    const left = String(lhs ?? "").trim().toLowerCase();
    const right = String(rhs ?? "").trim().toLowerCase();
    return left.length > 0 && left === right;
  }
  function organizationIdFromValue(value) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed) return "";
      if (trimmed.includes("/")) {
        const parts = trimmed.split("/").filter(Boolean);
        return parts[parts.length - 1] || "";
      }
      return trimmed;
    }
    if (value && typeof value === "object" && "id" in value) {
      return organizationIdFromValue(value.id);
    }
    return "";
  }
  function bookingBelongsToOrganization(bookingOrganizationId, currentOrganizationId) {
    return organizationIdsMatch(bookingOrganizationId, currentOrganizationId);
  }
  function intervalsOverlap(a, b) {
    return a.start < b.end && b.start < a.end;
  }
  function paidHoursForNamedSlot(timeSlot, standardPaidHours = 8) {
    const normalized = String(timeSlot || "").trim().toUpperCase().replace(/_/g, " ");
    const standard = Number.isFinite(standardPaidHours) && standardPaidHours > 0 ? standardPaidHours : 8;
    if (normalized.includes("FULL")) return standard;
    if (normalized === "AM" || normalized === "PM") return standard / 2;
    return null;
  }
  function zoneOf(timeZone) {
    const value = String(timeZone || "").trim();
    return value || CANONICAL_TIME_ZONE;
  }
  function isoWeekdayIndex(day) {
    const index = WEEKDAYS.indexOf(String(day || "").trim().toLowerCase());
    return index >= 0 ? index + 1 : 5;
  }
  function weekdayOnOrBefore(reference, isoWeekday, timeZone) {
    const current = isoWeekdayInZone(reference, timeZone);
    const delta = current >= isoWeekday ? current - isoWeekday : current + 7 - isoWeekday;
    return addDaysInZone(midnightInZone(reference, timeZone), -delta, timeZone);
  }
  function weekdayOnOrAfter(reference, isoWeekday, timeZone) {
    const current = isoWeekdayInZone(reference, timeZone);
    const delta = current <= isoWeekday ? isoWeekday - current : 7 - current + isoWeekday;
    return addDaysInZone(midnightInZone(reference, timeZone), delta, timeZone);
  }
  function dayInMonth(monthAnchor, day, timeZone) {
    const { y, m } = partsInZone(monthAnchor, timeZone);
    const dim = daysInZoneMonth(monthAnchor, timeZone);
    const clamped = Math.min(Math.max(day, 1), dim);
    return dateFromDayKeyInZone(
      `${y}-${String(m).padStart(2, "0")}-${String(clamped).padStart(2, "0")}`,
      timeZone
    );
  }
  function shiftMonth(reference, offset, timeZone) {
    const { y, m } = partsInZone(reference, timeZone);
    return midnightInZone(new Date(Date.UTC(y, m - 1 + offset, 1, 12, 0, 0)), timeZone);
  }
  function usableRanges(ranges) {
    return (ranges ?? []).filter((range) => range.startDay > 0 && range.endDay > 0).slice(0, 2);
  }
  function rangeContainsDay(range, dayOfMonth) {
    if (range.startDay <= range.endDay) {
      return dayOfMonth >= range.startDay && dayOfMonth <= range.endDay;
    }
    return dayOfMonth >= range.startDay || dayOfMonth <= range.endDay;
  }
  function boundsForRange(range, reference, timeZone) {
    const dayOfMonth = dayOfMonthInZone(reference, timeZone);
    const monthAnchor = shiftMonth(reference, 0, timeZone);
    if (range.startDay <= range.endDay) {
      return {
        startDayKey: dayKeyInZone(dayInMonth(monthAnchor, range.startDay, timeZone), timeZone),
        endDayKey: dayKeyInZone(dayInMonth(monthAnchor, range.endDay, timeZone), timeZone)
      };
    }
    if (dayOfMonth >= range.startDay) {
      const nextMonth = shiftMonth(reference, 1, timeZone);
      return {
        startDayKey: dayKeyInZone(dayInMonth(monthAnchor, range.startDay, timeZone), timeZone),
        endDayKey: dayKeyInZone(dayInMonth(nextMonth, range.endDay, timeZone), timeZone)
      };
    }
    const previousMonth = shiftMonth(reference, -1, timeZone);
    return {
      startDayKey: dayKeyInZone(dayInMonth(previousMonth, range.startDay, timeZone), timeZone),
      endDayKey: dayKeyInZone(dayInMonth(monthAnchor, range.endDay, timeZone), timeZone)
    };
  }
  function invoicingPeriod(input) {
    const timeZone = zoneOf(input.timeZone);
    const reference = midnightInZone(new Date(input.referenceIso), timeZone);
    if (String(input.paymentRunMode || "date_ranges") === "recurring_timeframe") {
      return recurringPeriod(reference, input, timeZone);
    }
    return dateRangePeriod(reference, input.ranges, timeZone);
  }
  function dateRangePeriod(reference, ranges, timeZone) {
    const parsed = usableRanges(ranges);
    const effective = parsed.length > 0 ? parsed : CANONICAL_HALF_MONTH_RANGES;
    const dayOfMonth = dayOfMonthInZone(reference, timeZone);
    const match = effective.find((range) => rangeContainsDay(range, dayOfMonth));
    if (match) return boundsForRange(match, reference, timeZone);
    const fallback = effective.reduce((latest, range) => range.endDay > latest.endDay ? range : latest);
    return boundsForRange(fallback, reference, timeZone);
  }
  function recurringPeriod(reference, input, timeZone) {
    const startWd = isoWeekdayIndex(input.recurringRunStartDay || "monday");
    const endWd = isoWeekdayIndex(input.recurringRunEndDay || "sunday");
    let periodStart = weekdayOnOrBefore(reference, startWd, timeZone);
    let periodEnd = weekdayOnOrAfter(periodStart, endWd, timeZone);
    if (dayKeyInZone(periodEnd, timeZone) < dayKeyInZone(periodStart, timeZone)) {
      periodEnd = addDaysInZone(periodEnd, 7, timeZone);
    }
    if (dayKeyInZone(reference, timeZone) > dayKeyInZone(periodEnd, timeZone)) {
      periodStart = addDaysInZone(periodStart, 7, timeZone);
      periodEnd = weekdayOnOrAfter(periodStart, endWd, timeZone);
      if (dayKeyInZone(periodEnd, timeZone) < dayKeyInZone(periodStart, timeZone)) {
        periodEnd = addDaysInZone(periodEnd, 7, timeZone);
      }
    }
    return {
      startDayKey: dayKeyInZone(periodStart, timeZone),
      endDayKey: dayKeyInZone(periodEnd, timeZone)
    };
  }
  function coverageWindow(input) {
    const timeZone = zoneOf(input.timeZone);
    const today = midnightInZone(new Date(input.referenceIso), timeZone);
    const todayKey = dayKeyInZone(today, timeZone);
    const mode = String(input.clashLookaheadMode || "endOfWorkingWeek");
    if (mode === "numberOfDays") {
      const days = Math.max(1, Math.min(Number(input.clashLookaheadDays) || 1, 366));
      return {
        startDayKey: todayKey,
        endDayKey: dayKeyInZone(addDaysInZone(today, days - 1, timeZone), timeZone)
      };
    }
    if (mode === "endOfInvoicingPeriod") {
      return invoicingPeriod({ ...input, referenceIso: today.toISOString(), timeZone });
    }
    const iso = isoWeekdayInZone(today, timeZone);
    return {
      startDayKey: dayKeyInZone(addDaysInZone(today, -(iso - 1), timeZone), timeZone),
      endDayKey: dayKeyInZone(addDaysInZone(today, 7 - iso, timeZone), timeZone)
    };
  }
  function dayKeyInOrganizationZone(referenceIso, timeZone) {
    return dayKeyInZone(new Date(referenceIso), zoneOf(timeZone));
  }
  function organizationScopedKey(kind, organizationId, userId = "") {
    const org = String(organizationId || "").trim().toLowerCase();
    const user = String(userId || "").trim();
    return user ? `${kind}:${user}:${org}` : `${kind}:${org}`;
  }
  return __toCommonJS(bundleEntry_exports);
})();
