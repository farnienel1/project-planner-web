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
    ANNUAL_LEAVE_ALLOWANCE_COPY: () => ANNUAL_LEAVE_ALLOWANCE_COPY,
    CANONICAL_STANDARD_BREAK: () => CANONICAL_STANDARD_BREAK,
    CANONICAL_STANDARD_DAY: () => CANONICAL_STANDARD_DAY,
    DEFAULT_ANNUAL_LEAVE_DAYS: () => DEFAULT_ANNUAL_LEAVE_DAYS,
    DEFAULT_PAYMENT_RUN_DATE_RANGES: () => DEFAULT_PAYMENT_RUN_DATE_RANGES,
    DEFAULT_WARNING_DETECTION: () => DEFAULT_WARNING_DETECTION,
    MIN_HALF_DAY_MINUTES: () => MIN_HALF_DAY_MINUTES,
    accountKindFromFlags: () => accountKindFromFlags,
    annualLeaveBalance: () => annualLeaveBalance,
    applyEmploymentTypeChange: () => applyEmploymentTypeChange,
    applyRemainingOverride: () => applyRemainingOverride,
    bookingBelongsToOrganization: () => bookingBelongsToOrganization,
    canEditWorkCatalogue: () => canEditWorkCatalogue,
    canManageVariationTracker: () => canManageVariationTracker,
    canSeeVariations: () => canSeeVariations,
    canViewStaffWarnings: () => canViewStaffWarnings,
    catalogueRecordFromItem: () => catalogueRecordFromItem,
    coverageWindow: () => coverageWindow,
    dayKeyInOrganizationZone: () => dayKeyInOrganizationZone,
    employmentEffectiveLabel: () => employmentEffectiveLabel,
    employmentTypeOnDay: () => employmentTypeOnDay,
    formatClockMinutes: () => formatClockMinutes,
    halfDayWindows: () => halfDayWindows,
    hasAnnualLeaveAllowance: () => hasAnnualLeaveAllowance,
    intervalsOverlap: () => intervalsOverlap,
    invoicingPeriod: () => invoicingPeriod,
    invoicingToFirestore: () => invoicingToFirestore,
    isBillableSelfEmployedDay: () => isBillableSelfEmployedDay,
    isStaffAccount: () => isStaffAccount,
    leaveCoverageRows: () => leaveCoverageRows,
    leaveSlotKind: () => leaveSlotKind,
    leaveYearBounds: () => leaveYearBounds,
    materialRecordMatches: () => materialRecordMatches,
    materialSearchScore: () => materialSearchScore,
    mergeMinuteIntervals: () => mergeMinuteIntervals,
    namedSlotKind: () => namedSlotKind,
    normalizeEmploymentType: () => normalizeEmploymentType,
    normalizeMaterialSearchText: () => normalizeMaterialSearchText,
    organizationIdFromValue: () => organizationIdFromValue,
    organizationIdsMatch: () => organizationIdsMatch,
    organizationScopedKey: () => organizationScopedKey,
    paidHoursForNamedSlot: () => paidHoursForNamedSlot,
    parseClockMinutes: () => parseClockMinutes,
    parseInvoicing: () => parseInvoicing,
    parsePaymentRunDateRanges: () => parsePaymentRunDateRanges,
    parseWarningDetection: () => parseWarningDetection,
    paymentRunRangeToFirestore: () => paymentRunRangeToFirestore,
    qualificationDismissKey: () => qualificationDismissKey,
    qualificationExpiryRows: () => qualificationExpiryRows,
    rankMaterialRecords: () => rankMaterialRecords,
    receivesJobNotification: () => receivesJobNotification,
    seesEveryJob: () => seesEveryJob,
    slotInterval: () => slotInterval,
    snapLeaveDays: () => snapLeaveDays,
    standardBreakWindow: () => standardBreakWindow,
    standardDayCoverage: () => standardDayCoverage,
    standardDayWindow: () => standardDayWindow,
    subtractMinuteIntervals: () => subtractMinuteIntervals,
    tokenizeMaterialSearch: () => tokenizeMaterialSearch,
    unbookedLabourRows: () => unbookedLabourRows,
    unverifiedOperativeRows: () => unverifiedOperativeRows,
    validateInvoicingSettings: () => validateInvoicingSettings,
    warningDetectionToFirestore: () => warningDetectionToFirestore,
    withoutDismissedQualificationRows: () => withoutDismissedQualificationRows
  });

  // lib/orgTime/zoneTime.ts
  var LONDON_TIME_ZONE = "Europe/London";
  var partsFormatters = /* @__PURE__ */ new Map();
  var partsMemo = /* @__PURE__ */ new Map();
  var PARTS_MEMO_LIMIT = 4096;
  function partsFormatter(timeZone) {
    let fmt = partsFormatters.get(timeZone);
    if (!fmt) {
      fmt = new Intl.DateTimeFormat("en-GB", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23"
      });
      partsFormatters.set(timeZone, fmt);
    }
    return fmt;
  }
  function partsInZone(date, timeZone) {
    const memoKey = `${timeZone}|${date.getTime()}`;
    const cached = partsMemo.get(memoKey);
    if (cached) return cached;
    const map = {};
    for (const part of partsFormatter(timeZone).formatToParts(date)) {
      if (part.type !== "literal") map[part.type] = part.value;
    }
    const parts = {
      y: Number(map.year),
      m: Number(map.month),
      d: Number(map.day),
      h: Number(map.hour),
      min: Number(map.minute)
    };
    if (partsMemo.size >= PARTS_MEMO_LIMIT) {
      partsMemo.delete(partsMemo.keys().next().value);
    }
    partsMemo.set(memoKey, parts);
    return parts;
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
  var CANONICAL_STANDARD_DAY = { start: 7 * 60 + 30, end: 16 * 60 };
  var CANONICAL_STANDARD_BREAK = { start: 12 * 60, end: 12 * 60 + 30 };
  var MIN_HALF_DAY_MINUTES = 60;
  function parseClockMinutes(value) {
    if (typeof value === "number") {
      return Number.isFinite(value) && value >= 0 && value <= 24 * 60 ? Math.round(value) : null;
    }
    const text = String(value ?? "").trim();
    const match = /^(\d{1,2}):(\d{2})$/.exec(text);
    if (!match) return null;
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 24 || minutes > 59) return null;
    const total = hours * 60 + minutes;
    return total <= 24 * 60 ? total : null;
  }
  function formatClockMinutes(minutes) {
    const clamped = Math.max(0, Math.min(Math.round(minutes), 24 * 60));
    const hours = Math.floor(clamped / 60);
    const mins = clamped % 60;
    return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
  }
  function standardDayWindow(input) {
    const start = parseClockMinutes(input?.standardDayStart);
    const end = parseClockMinutes(input?.standardDayEnd);
    if (start == null || end == null || end <= start) return { ...CANONICAL_STANDARD_DAY };
    return { start, end };
  }
  function standardBreakWindow(input) {
    const start = input?.breakWindowStart == null ? CANONICAL_STANDARD_BREAK.start : parseClockMinutes(input.breakWindowStart);
    const end = input?.breakWindowEnd == null ? CANONICAL_STANDARD_BREAK.end : parseClockMinutes(input.breakWindowEnd);
    if (start == null || end == null || end <= start) return null;
    return { start, end };
  }
  function halfDayWindows(input) {
    const day = standardDayWindow(input);
    const breakWindow = standardBreakWindow(input);
    const breakStart = breakWindow?.start ?? null;
    const breakEnd = breakWindow?.end ?? null;
    const breakUsable = breakStart != null && breakEnd != null && breakStart - day.start >= MIN_HALF_DAY_MINUTES && day.end - breakEnd >= MIN_HALF_DAY_MINUTES;
    if (breakUsable) {
      return {
        day,
        am: { start: day.start, end: breakStart },
        pm: { start: breakEnd, end: day.end },
        pivot: "break",
        breakWindow: { start: breakStart, end: breakEnd }
      };
    }
    const mid = day.start + Math.floor((day.end - day.start) / 2);
    return {
      day,
      am: { start: day.start, end: mid },
      pm: { start: mid, end: day.end },
      pivot: "midpoint",
      breakWindow: null
    };
  }
  function namedSlotKind(timeSlot) {
    const normalized = String(timeSlot || "").trim().toUpperCase().replace(/_/g, " ");
    if (!normalized) return "UNKNOWN";
    if (normalized.includes("FULL")) return "FULL_DAY";
    if (normalized === "AM" || normalized.includes("MORNING")) return "AM";
    if (normalized === "PM" || normalized.includes("AFTERNOON")) return "PM";
    if (normalized.includes("CUSTOM")) return "CUSTOM";
    if (normalized.includes("EVENING")) return "EVENING";
    if (normalized.includes("OVERTIME")) return "OVERTIME";
    return "UNKNOWN";
  }
  function slotInterval(booking, dayInput) {
    const start = parseClockMinutes(booking.workStartTime);
    const end = parseClockMinutes(booking.workEndTime);
    if (start != null && end != null && end > start) return { start, end };
    const windows = halfDayWindows(dayInput);
    switch (namedSlotKind(booking.timeSlot)) {
      case "AM":
        return { ...windows.am };
      case "PM":
        return { ...windows.pm };
      case "EVENING": {
        const eveningEnd = Math.min(windows.day.end + 240, 24 * 60);
        return eveningEnd > windows.day.end ? { start: windows.day.end, end: eveningEnd } : null;
      }
      case "OVERTIME": {
        const overtimeStart = Math.min(windows.day.end + 240, 24 * 60);
        const overtimeEnd = Math.min(windows.day.end + 360, 24 * 60);
        return overtimeEnd > overtimeStart ? { start: overtimeStart, end: overtimeEnd } : null;
      }
      default:
        return { ...windows.day };
    }
  }
  function mergeMinuteIntervals(intervals) {
    const sorted = intervals.filter((interval) => interval.end > interval.start).map((interval) => ({ ...interval })).sort((a, b) => a.start - b.start);
    const merged = [];
    for (const interval of sorted) {
      const last = merged[merged.length - 1];
      if (last && interval.start <= last.end) last.end = Math.max(last.end, interval.end);
      else merged.push(interval);
    }
    return merged;
  }
  function subtractMinuteIntervals(window, covered) {
    const gaps = [];
    let cursor = window.start;
    for (const interval of mergeMinuteIntervals(covered)) {
      if (interval.end <= cursor) continue;
      if (interval.start >= window.end) break;
      if (interval.start > cursor) gaps.push({ start: cursor, end: Math.min(interval.start, window.end) });
      cursor = Math.max(cursor, interval.end);
      if (cursor >= window.end) break;
    }
    if (cursor < window.end) gaps.push({ start: cursor, end: window.end });
    return gaps;
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
  function intervalMinutes(intervals) {
    return intervals.reduce((sum, interval) => sum + (interval.end - interval.start), 0);
  }
  function roundCoverageHours(hours) {
    return Math.round(hours * 100) / 100;
  }
  function withoutInterval(intervals, cut) {
    if (!cut) return intervals.map((interval) => ({ ...interval }));
    return intervals.flatMap((interval) => subtractMinuteIntervals(interval, [cut]));
  }
  function bookingCoverInterval(booking, windows) {
    switch (namedSlotKind(booking.timeSlot)) {
      case "UNKNOWN":
      case "FULL_DAY":
        return { ...windows.day };
      case "AM":
        return windows.am.end > windows.am.start ? { ...windows.am } : null;
      case "PM":
        return windows.pm.end > windows.pm.start ? { ...windows.pm } : null;
      default: {
        const start = parseClockMinutes(booking.workStart);
        const end = parseClockMinutes(booking.workEnd);
        if (start != null && end != null && end > start) return { start, end };
        return { ...windows.day };
      }
    }
  }
  function standardDayCoverage(policy, bookings) {
    const windows = halfDayWindows(policy);
    const unpaidBreak = standardBreakWindow(policy);
    const required = withoutInterval([windows.day], unpaidBreak);
    const requiredHours = roundCoverageHours(intervalMinutes(required) / 60);
    const covered = [];
    for (const booking of bookings) {
      const interval = bookingCoverInterval(booking, windows);
      if (!interval) continue;
      const start = Math.max(interval.start, windows.day.start);
      const end = Math.min(interval.end, windows.day.end);
      if (end > start) covered.push({ start, end });
    }
    const inside = withoutInterval(mergeMinuteIntervals(covered), unpaidBreak);
    const coveredHours = roundCoverageHours(Math.min(requiredHours, intervalMinutes(inside) / 60));
    return {
      requiredHours,
      coveredHours,
      missingHours: roundCoverageHours(Math.max(0, requiredHours - coveredHours))
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
      endDayKey: dayKeyInZone(addDaysInZone(today, 5 - iso, timeZone), timeZone)
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

  // lib/canonical/dayKeys.ts
  function zoneOrLondon(timeZone) {
    const value = String(timeZone || "").trim();
    return value || LONDON_TIME_ZONE;
  }
  function eachDayKey(startKey, endKey, timeZone, cap = 400) {
    if (!startKey || !endKey || startKey > endKey) return [];
    const keys = [];
    let cursor = dateFromDayKeyInZone(startKey, timeZone);
    while (dayKeyInZone(cursor, timeZone) <= endKey) {
      keys.push(dayKeyInZone(cursor, timeZone));
      cursor = addDaysInZone(cursor, 1, timeZone);
      if (keys.length > cap) break;
    }
    return keys;
  }
  function isoWeekdayOfDayKey(dayKey, timeZone) {
    return isoWeekdayInZone(dateFromDayKeyInZone(dayKey, timeZone), timeZone);
  }
  function formatLongDayKey(dayKey, timeZone) {
    const date = dateFromDayKeyInZone(dayKey, timeZone);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(date);
  }

  // lib/canonical/warningRows.ts
  function qualificationDismissKey(operativeId, qualificationId, expiryDayKey) {
    return `qual|${String(operativeId).trim()}|${String(qualificationId).trim()}|${String(expiryDayKey).trim()}`;
  }
  function withoutDismissedQualificationRows(rows, dismissedKeys) {
    const dismissed = dismissedKeys instanceof Set ? dismissedKeys : new Set(dismissedKeys);
    if (dismissed.size === 0) return [...rows];
    return rows.filter((row) => !(row.daysUntilExpiry < 0 && dismissed.has(row.dismissKey)));
  }
  var zoneOf2 = zoneOrLondon;
  function emailKey(value) {
    return String(value || "").trim().toLowerCase();
  }
  function dayKeyFromIso(iso, timeZone) {
    const date = new Date(String(iso || ""));
    if (Number.isNaN(date.getTime())) return "";
    return dayKeyInZone(date, timeZone);
  }
  function addCalendarMonths(dayKey, months) {
    const [year, month, day] = dayKey.split("-").map(Number);
    if (!year || !month || !day) return dayKey;
    const shifted = new Date(Date.UTC(year, month - 1 + months, 1));
    const yearOut = shifted.getUTCFullYear();
    const monthOut = shifted.getUTCMonth();
    const lastDay = new Date(Date.UTC(yearOut, monthOut + 1, 0)).getUTCDate();
    const dayOut = Math.min(day, lastDay);
    return `${yearOut}-${String(monthOut + 1).padStart(2, "0")}-${String(dayOut).padStart(2, "0")}`;
  }
  function signedDayDelta(fromKey, toKey) {
    const [fy, fm, fd] = fromKey.split("-").map(Number);
    const [ty, tm, td] = toKey.split("-").map(Number);
    const from = Date.UTC(fy, fm - 1, fd);
    const to = Date.UTC(ty, tm - 1, td);
    return Math.round((to - from) / 864e5);
  }
  function workingDaysInclusive(startKey, endKey, timeZone) {
    if (!startKey || !endKey || startKey > endKey) return 0;
    let count = 0;
    let cursor = dateFromDayKeyInZone(startKey, timeZone);
    while (dayKeyInZone(cursor, timeZone) <= endKey) {
      const iso = isoWeekdayInZone(cursor, timeZone);
      if (iso >= 1 && iso <= 5) count += 1;
      cursor = addDaysInZone(cursor, 1, timeZone);
      if (count > 400) break;
    }
    return count;
  }
  var formatUnbookedDay = formatLongDayKey;
  function formatCoverageHours(hours) {
    const rounded = Math.round(hours * 2) / 2;
    if (Math.abs(rounded - Math.trunc(rounded)) < 0.01) return String(Math.trunc(rounded));
    return rounded.toFixed(1);
  }
  function finiteHours(value, fallback) {
    return typeof value === "number" && Number.isFinite(value) ? value : fallback;
  }
  function hoursForIsoWeekday(iso, input) {
    const standard = finiteHours(input.standardPaidHours, 0);
    if (iso === 6) return Math.max(finiteHours(input.saturdayCountsAsHours, standard), 0);
    if (iso === 7) return Math.max(finiteHours(input.sundayCountsAsHours, standard), 0);
    return Math.max(standard, 0);
  }
  function qualificationExpiryRows(input) {
    const timeZone = zoneOf2(input.timeZone);
    const todayKey = dayKeyFromIso(input.referenceIso, timeZone);
    if (!todayKey) return [];
    const endKey = addCalendarMonths(todayKey, 1);
    const rows = [];
    for (const operative of input.operatives) {
      if (!operative.isActive) continue;
      const operativeName = String(operative.name || "").trim() || operative.id;
      for (const expiry of operative.expiries) {
        const name = String(expiry.name || "").trim();
        const expiryKey = dayKeyFromIso(expiry.expiryIso, timeZone);
        if (!name || !expiry.qualificationId || !expiryKey || expiryKey > endKey) continue;
        const daysUntilExpiry = signedDayDelta(todayKey, expiryKey);
        const ago = Math.abs(daysUntilExpiry);
        const message = daysUntilExpiry < 0 ? `${operativeName}'s ${name} expired ${ago} day${ago === 1 ? "" : "s"} ago` : daysUntilExpiry === 0 ? `${operativeName}'s ${name} expires today` : `${operativeName}'s ${name} expires in ${daysUntilExpiry} day${daysUntilExpiry === 1 ? "" : "s"}`;
        rows.push({
          id: `qual-${operative.id}-${expiry.qualificationId}`,
          operativeId: operative.id,
          operativeName,
          qualificationId: expiry.qualificationId,
          qualificationName: name,
          dayKey: expiryKey,
          daysUntilExpiry,
          severity: "low",
          title: daysUntilExpiry < 0 ? "Qualification expired" : "Qualification expiry",
          message,
          dismissKey: qualificationDismissKey(operative.id, expiry.qualificationId, expiryKey)
        });
      }
    }
    return rows;
  }
  function unverifiedOperativeRows(input) {
    const timeZone = zoneOf2(input.timeZone);
    const todayKey = dayKeyFromIso(input.referenceIso, timeZone);
    if (!todayKey) return [];
    const rows = [];
    for (const operative of input.operatives) {
      const email = emailKey(operative.email);
      if (!email) continue;
      const person = input.people.find((candidate) => emailKey(candidate.email) === email && candidate.isOperativeMode);
      if (!person || person.passwordSet) continue;
      const createdKey = dayKeyFromIso(person.createdAtIso, timeZone);
      if (!createdKey || workingDaysInclusive(createdKey, todayKey, timeZone) < 3) continue;
      const operativeName = String(operative.name || "").trim() || operative.email;
      rows.push({
        id: `unverified-${operative.id}`,
        operativeId: operative.id,
        operativeName,
        email,
        title: "Unverified operative",
        message: `${operativeName} has not verified their account`
      });
    }
    return rows;
  }
  function hasFinishedSignup(person) {
    return person.passwordSet === true && person.status !== "pending";
  }
  function isManagerOrAdmin(person) {
    return Boolean(person.isActive && (person.isManager || person.isAdmin || person.isSuperAdmin));
  }
  function isOperativeModeOnly(person) {
    return Boolean(
      person.isActive && person.isOperativeMode && !person.isManager && !person.isAdmin && !person.isSuperAdmin
    );
  }
  function preferFinishedAccount(candidates) {
    return candidates.find((person) => person.passwordSet && person.isActive) ?? candidates.find((person) => person.passwordSet);
  }
  function dedupeFinishedPeople(people) {
    const groups = /* @__PURE__ */ new Map();
    const withoutEmail = [];
    for (const person of people) {
      if (!hasFinishedSignup(person)) continue;
      const email = emailKey(person.email);
      if (!email) {
        withoutEmail.push(person);
        continue;
      }
      const list = groups.get(email) || [];
      list.push(person);
      groups.set(email, list);
    }
    const picked = [];
    for (const group of groups.values()) {
      const best = preferFinishedAccount(group);
      if (best) picked.push(best);
    }
    return [...picked, ...withoutEmail];
  }
  function asCoverageBooking(booking) {
    return {
      timeSlot: booking.timeSlot,
      workStart: booking.workStart,
      workEnd: booking.workEnd
    };
  }
  function unbookedLabourRows(input) {
    const timeZone = zoneOf2(input.timeZone);
    const excluded = new Set((input.excludedUserIds || []).map((id) => String(id)));
    const dayPolicy = {
      standardDayStart: input.standardDayStart,
      standardDayEnd: input.standardDayEnd,
      breakWindowStart: input.breakWindowStart,
      breakWindowEnd: input.breakWindowEnd
    };
    const operativeBookings = /* @__PURE__ */ new Map();
    const managerBookings = /* @__PURE__ */ new Map();
    for (const booking of input.bookings) {
      const personId = String(booking.personId || "");
      const dayKey = String(booking.dayKey || "");
      if (!personId || !dayKey) continue;
      const key = `${personId}|${dayKey}`;
      const target = booking.kind === "manager" ? managerBookings : operativeBookings;
      const list = target.get(key) || [];
      list.push(asCoverageBooking(booking));
      target.set(key, list);
    }
    const operativesByEmail = /* @__PURE__ */ new Map();
    const operativeIdsByEmail = /* @__PURE__ */ new Map();
    for (const operative of input.operatives) {
      const email = emailKey(operative.email);
      if (!email) continue;
      const ids = operativeIdsByEmail.get(email) || /* @__PURE__ */ new Set();
      if (operative.id) ids.add(operative.id);
      operativeIdsByEmail.set(email, ids);
      const existing = operativesByEmail.get(email);
      if (!existing || operative.profileWeight > existing.profileWeight) {
        operativesByEmail.set(email, operative);
      }
    }
    const userIdsByEmail = /* @__PURE__ */ new Map();
    for (const person of input.people) {
      const email = emailKey(person.email);
      if (!email || !person.id) continue;
      const ids = userIdsByEmail.get(email) || /* @__PURE__ */ new Set();
      ids.add(person.id);
      userIdsByEmail.set(email, ids);
    }
    const slotsFor = (email, operativeId, userId, dayKey) => {
      const slots = [];
      const ids = /* @__PURE__ */ new Set();
      if (operativeId) ids.add(operativeId);
      const linked = operativeIdsByEmail.get(email);
      if (linked) for (const id of linked) ids.add(id);
      for (const id of ids) slots.push(...operativeBookings.get(`${id}|${dayKey}`) || []);
      const userIds = /* @__PURE__ */ new Set();
      if (userId) userIds.add(userId);
      const linkedUsers = userIdsByEmail.get(email);
      if (linkedUsers) for (const id of linkedUsers) userIds.add(id);
      for (const id of userIds) slots.push(...managerBookings.get(`${id}|${dayKey}`) || []);
      return slots;
    };
    const approvedHolidays = input.holidays.filter((holiday) => holiday.approved);
    const holidayCovers = (dayKey, email, userId, operativeId) => {
      const userIds = /* @__PURE__ */ new Set();
      if (userId) userIds.add(userId);
      const linkedUsers = userIdsByEmail.get(email);
      if (linkedUsers) for (const id of linkedUsers) userIds.add(id);
      const operativeIds = /* @__PURE__ */ new Set();
      if (operativeId) operativeIds.add(operativeId);
      const linkedOps = operativeIdsByEmail.get(email);
      if (linkedOps) for (const id of linkedOps) operativeIds.add(id);
      return approvedHolidays.some((holiday) => {
        if (dayKey < holiday.startDayKey || dayKey > holiday.endDayKey) return false;
        const holidayUser = String(holiday.userId || "").trim();
        if (holidayUser && userIds.has(holidayUser)) return true;
        if (holiday.operativeId && operativeIds.has(holiday.operativeId)) return true;
        return false;
      });
    };
    const operativeUsers = dedupeFinishedPeople(input.people.filter(isOperativeModeOnly));
    const managerUsers = dedupeFinishedPeople(input.people.filter(isManagerOrAdmin));
    const managerAdminUserIds = new Set(
      input.people.filter(isManagerOrAdmin).filter(hasFinishedSignup).map((person) => person.id)
    );
    const operativeUserEmails = new Set(operativeUsers.map((person) => emailKey(person.email)).filter(Boolean));
    const verifiedUserForEmail = (email) => {
      if (!email) return void 0;
      return preferFinishedAccount(input.people.filter((person) => emailKey(person.email) === email));
    };
    const roster = input.operatives.filter((operative) => operative.isActive !== false && !operative.isPlaceholder);
    const rows = [];
    for (const dayKey of eachDayKey(input.startDayKey, input.endDayKey, timeZone)) {
      const iso = isoWeekdayInZone(dateFromDayKeyInZone(dayKey, timeZone), timeZone);
      if (!input.includeWeekends && (iso < 1 || iso > 5)) continue;
      const weekendRequired = hoursForIsoWeekday(iso, input);
      if (iso >= 6 && weekendRequired <= 1e-3) continue;
      const seen = /* @__PURE__ */ new Set();
      const append = (args) => {
        const seenKey = args.email || args.personKey;
        if (seen.has(seenKey)) return;
        seen.add(seenKey);
        const coverage = standardDayCoverage(dayPolicy, slotsFor(args.email, args.operativeId, args.userId, dayKey));
        const requiredHours = iso >= 6 ? weekendRequired : coverage.requiredHours;
        if (requiredHours <= 1e-3) return;
        const coveredHours = Math.min(coverage.coveredHours, requiredHours);
        const missingHours = Math.round(Math.max(0, requiredHours - coveredHours) * 100) / 100;
        if (missingHours <= 1e-3) return;
        const label = formatCoverageHours(missingHours);
        rows.push({
          id: `unbooked-${dayKey}-${args.personKey}`,
          operativeId: args.operativeId,
          operativeName: args.name,
          userId: args.userId,
          personKey: args.personKey,
          dayKey,
          missingHours,
          message: `${args.name} is missing ${label}h on ${formatUnbookedDay(dayKey, timeZone)}.`
        });
      };
      for (const person of operativeUsers) {
        if (excluded.has(person.id)) continue;
        const email = emailKey(person.email);
        const linked = operativesByEmail.get(email);
        if (holidayCovers(dayKey, email, person.id, linked?.id)) continue;
        append({
          personKey: person.id,
          name: person.name,
          email,
          operativeId: linked?.id || person.id,
          userId: person.id
        });
      }
      for (const person of managerUsers) {
        if (excluded.has(person.id)) continue;
        const email = emailKey(person.email);
        const linked = operativesByEmail.get(email);
        if (holidayCovers(dayKey, email, person.id, linked?.id)) continue;
        append({
          personKey: person.id,
          name: person.name,
          email,
          operativeId: linked?.id || person.id,
          userId: person.id
        });
      }
      for (const operative of roster) {
        const email = emailKey(operative.email);
        if (email && operativeUserEmails.has(email)) continue;
        const matched = email ? verifiedUserForEmail(email) : void 0;
        if (!matched && email && input.people.some((person) => emailKey(person.email) === email)) continue;
        if (matched && managerAdminUserIds.has(matched.id)) continue;
        if (matched && excluded.has(matched.id)) continue;
        if (holidayCovers(dayKey, email, matched?.id, operative.id)) continue;
        append({
          personKey: matched?.id || operative.id,
          name: matched?.name || operative.name,
          email: email || operative.id,
          operativeId: operative.id,
          userId: matched?.id
        });
      }
    }
    return rows.sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
      return a.operativeName.localeCompare(b.operativeName, void 0, { sensitivity: "base" });
    });
  }

  // lib/canonical/leaveCoverage.ts
  function leaveSlotKind(timeSlot) {
    const kind = namedSlotKind(timeSlot);
    if (kind === "AM") return "AM";
    if (kind === "PM") return "PM";
    return "FULL_DAY";
  }
  function leaveLabelFor(slot) {
    return slot === "AM" ? "AM" : slot === "PM" ? "PM" : "Full day";
  }
  function rangeLabel(interval) {
    return `${formatClockMinutes(interval.start)}\u2013${formatClockMinutes(interval.end)}`;
  }
  function hoursOf(intervals) {
    const minutes = intervals.reduce((sum, interval) => sum + Math.max(0, interval.end - interval.start), 0);
    return Math.round(minutes / 60 * 100) / 100;
  }
  function formatHours(hours) {
    const rounded = Math.round(hours * 4) / 4;
    const text = Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(/0+$/, "");
    return `${text} hour${rounded === 1 ? "" : "s"}`;
  }
  function joinRanges(intervals) {
    const labels = intervals.map(rangeLabel);
    if (labels.length <= 1) return labels[0] || "";
    return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
  }
  function leaveCoverageRows(input) {
    const timeZone = zoneOrLondon(input.timeZone);
    const windows = halfDayWindows(input.day);
    const excluded = new Set((input.excludedUserIds || []).map((id) => String(id)));
    const approvedLeave = input.leave.filter((record) => record.approved && record.startDayKey && record.endDayKey);
    if (approvedLeave.length === 0) return [];
    const peopleByUserId = /* @__PURE__ */ new Map();
    const peopleByOperativeId = /* @__PURE__ */ new Map();
    for (const person of input.people) {
      const userId = String(person.userId || "").trim();
      if (userId && !peopleByUserId.has(userId)) peopleByUserId.set(userId, person);
      for (const operativeId of person.operativeIds || []) {
        const key = String(operativeId || "").trim();
        if (key && !peopleByOperativeId.has(key)) peopleByOperativeId.set(key, person);
      }
    }
    const personForLeave = (record) => {
      const userId = String(record.userId || "").trim();
      if (userId && peopleByUserId.has(userId)) return peopleByUserId.get(userId);
      const operativeId = String(record.operativeId || "").trim();
      if (operativeId && peopleByOperativeId.has(operativeId)) return peopleByOperativeId.get(operativeId);
      return void 0;
    };
    const bookingsByPersonDay = /* @__PURE__ */ new Map();
    for (const booking of input.bookings) {
      const personId = String(booking.personId || "").trim();
      if (!personId || !booking.dayKey) continue;
      const person = booking.kind === "manager" ? peopleByUserId.get(personId) : peopleByOperativeId.get(personId);
      if (!person) continue;
      const key = `${person.personKey}|${booking.dayKey}`;
      const list = bookingsByPersonDay.get(key) || [];
      list.push(booking);
      bookingsByPersonDay.set(key, list);
    }
    const rows = [];
    const seen = /* @__PURE__ */ new Set();
    for (const dayKey of eachDayKey(input.startDayKey, input.endDayKey, timeZone)) {
      const iso = isoWeekdayOfDayKey(dayKey, timeZone);
      const weekend = iso === 6 || iso === 7;
      for (const record of approvedLeave) {
        if (dayKey < record.startDayKey || dayKey > record.endDayKey) continue;
        const person = personForLeave(record);
        if (!person) continue;
        const dedupe = `${person.personKey}|${dayKey}|${record.id}`;
        if (seen.has(dedupe)) continue;
        seen.add(dedupe);
        const leaveSlot = leaveSlotKind(record.timeSlot);
        const leaveWindow = leaveSlot === "AM" ? windows.am : leaveSlot === "PM" ? windows.pm : windows.day;
        const dayBookings = bookingsByPersonDay.get(`${person.personKey}|${dayKey}`) || [];
        const intervals = dayBookings.map((booking) => ({ booking, interval: slotInterval(booking, input.day) })).filter((entry) => entry.interval !== null);
        const personName = String(person.name || "").trim() || person.personKey;
        const userId = String(person.userId || "").trim() || void 0;
        const operativeId = String(record.operativeId || person.operativeIds?.[0] || "").trim() || void 0;
        const longDay = formatLongDayKey(dayKey, timeZone);
        const leaveLabel = leaveLabelFor(leaveSlot);
        const clashes = intervals.filter(({ interval }) => intervalsOverlap(interval, leaveWindow)).map(({ booking, interval }) => ({
          bookingId: booking.id,
          kind: booking.kind,
          label: String(booking.label || "").trim() || (booking.kind === "manager" ? "Manager booking" : "Booking"),
          start: interval.start,
          end: interval.end,
          overlapStart: Math.max(interval.start, leaveWindow.start),
          overlapEnd: Math.min(interval.end, leaveWindow.end)
        })).sort((a, b) => a.start - b.start);
        if (clashes.length > 0) {
          const bookedText = clashes.map((clash) => `${clash.label} ${formatClockMinutes(clash.start)}\u2013${formatClockMinutes(clash.end)}`).join(", ");
          const leaveText = leaveSlot === "FULL_DAY" ? "full-day annual leave" : `${leaveLabel} annual leave (${rangeLabel(leaveWindow)})`;
          rows.push({
            id: `leave-clash-${dayKey}-${person.personKey}-${record.id}`,
            kind: "leave_clash",
            personKey: person.personKey,
            personName,
            userId,
            operativeId,
            dayKey,
            leaveId: record.id,
            leaveSlot,
            leaveLabel,
            leaveWindow: { ...leaveWindow },
            clashes,
            workingWindow: null,
            missing: [],
            missingHours: 0,
            bookedHours: hoursOf(mergeMinuteIntervals(intervals.map((entry) => entry.interval))),
            severity: "high",
            title: "Booked during annual leave",
            message: `${personName} is booked ${bookedText} on ${longDay} while on ${leaveText}.`
          });
        }
        if (leaveSlot === "FULL_DAY") continue;
        if (weekend && !input.includeWeekends) continue;
        if (userId && excluded.has(userId)) continue;
        const workingWindow = leaveSlot === "PM" ? windows.am : windows.pm;
        const workingLabel = leaveSlot === "PM" ? "AM" : "PM";
        const covered = intervals.map((entry) => entry.interval);
        const missing = subtractMinuteIntervals(workingWindow, covered);
        if (missing.length === 0) continue;
        const missingHours = hoursOf(missing);
        const bookedInWorking = subtractMinuteIntervals(workingWindow, missing);
        const bookedHours = hoursOf(bookedInWorking);
        const message = bookedHours > 0 ? `${personName} has ${leaveLabel} annual leave on ${longDay}. The ${workingLabel} (${rangeLabel(workingWindow)}) is only booked ${joinRanges(bookedInWorking)}; ${joinRanges(missing)} (${formatHours(missingHours)}) is not booked.` : `${personName} has ${leaveLabel} annual leave on ${longDay} but is not booked for the ${workingLabel} (${rangeLabel(workingWindow)}, ${formatHours(missingHours)}).`;
        rows.push({
          id: `leave-cover-${dayKey}-${person.personKey}-${record.id}`,
          kind: "leave_cover",
          personKey: person.personKey,
          personName,
          userId,
          operativeId,
          dayKey,
          leaveId: record.id,
          leaveSlot,
          leaveLabel,
          leaveWindow: { ...leaveWindow },
          clashes: [],
          workingWindow: { ...workingWindow },
          missing,
          missingHours,
          bookedHours,
          severity: "medium",
          title: "Half-day leave not covered",
          message
        });
      }
    }
    return rows.sort((a, b) => {
      if (a.dayKey !== b.dayKey) return a.dayKey < b.dayKey ? -1 : 1;
      if (a.kind !== b.kind) return a.kind === "leave_clash" ? -1 : 1;
      return a.personName.localeCompare(b.personName, void 0, { sensitivity: "base" });
    });
  }

  // lib/canonical/staffAccess.ts
  function isStaffAccount(role) {
    if (role.isOperativeMode) return false;
    return role.isSuperAdmin || role.isAdmin || role.isManager;
  }
  function seesEveryJob(role) {
    return isStaffAccount(role);
  }
  function canViewStaffWarnings(role) {
    return isStaffAccount(role);
  }
  function canSeeVariations(role) {
    return isStaffAccount(role);
  }
  function canManageVariationTracker(role) {
    if (role.isOperativeMode) return false;
    return role.isSuperAdmin || role.isAdmin;
  }
  function canEditWorkCatalogue(role, catalogue, toggles) {
    if (role.isOperativeMode) return false;
    if (role.isSuperAdmin) return true;
    if (!role.isAdmin && !role.isManager) return false;
    return catalogue === "projects" ? toggles.projects === true : toggles.smallWorks === true;
  }
  function normalizedId(value) {
    return String(value ?? "").trim();
  }
  function receivesJobNotification(input) {
    const userId = normalizedId(input.userId);
    if (!userId) return false;
    const role = input.role;
    if (role.isOperativeMode) return false;
    if (role.isSuperAdmin || role.isAdmin) return true;
    const assigned = input.assignedManagerUserIds.map(normalizedId);
    if (assigned.includes(userId)) return true;
    const line = (input.lineManagerUserIds ?? []).map(normalizedId);
    return line.includes(userId);
  }

  // lib/canonical/organizationSettings.ts
  var DEFAULT_WEEKEND = {
    allHoursAtMultiplierMode: false,
    allHoursMultiplier: 2,
    definedWindowStart: "07:30",
    definedWindowEnd: "16:00",
    countsAsStandardHours: 8,
    outsideWindowMultiplier: 1.5,
    sameAsSaturday: false
  };
  var DEFAULT_SUNDAY = {
    ...DEFAULT_WEEKEND,
    sameAsSaturday: true
  };
  var DEFAULT_PAYROLL_POLICY = {
    standardDayStart: "07:30",
    standardDayEnd: "16:00",
    unpaidBreakMinutes: 30,
    standardPaidHours: 8,
    breakWindowStart: "12:00",
    breakWindowEnd: "12:30",
    weekdayOutsideStandardMultiplier: 1.5,
    saturday: { ...DEFAULT_WEEKEND },
    sunday: { ...DEFAULT_SUNDAY }
  };
  var DEFAULT_PAYMENT_RUN_DATE_RANGES = CANONICAL_HALF_MONTH_RANGES.map((range) => ({
    ...range
  }));
  var DEFAULT_WARNING_DETECTION = {
    detectClashes: true,
    clashLookaheadMode: "numberOfDays",
    clashLookaheadDays: 7,
    includeWeekendsForUnbookedLabour: false,
    excludedUserIdsFromUnbookedWarnings: []
  };
  var DEFAULT_INVOICING = {
    paymentRunMode: "date_ranges",
    paymentDateMode: "recurring_date",
    recurringRunStartDay: "monday",
    recurringRunEndDay: "sunday",
    recurringPaymentDay: "friday",
    paymentRunDateRanges: DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range })),
    paymentDates: [],
    noteToUsers: "If your timesheet displays 0 against your rate, then your day/hourly rate hasn't been set by your line manager"
  };
  var MONTH_DAYS = 31;
  function asSettingsRecord(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return void 0;
    return value;
  }
  function parseDayOfMonth(value) {
    const n = Number(value);
    if (Number.isInteger(n) && n >= 1 && n <= 31) return n;
    return 0;
  }
  function stringIdList(value) {
    if (!Array.isArray(value)) return [];
    return value.map((id) => String(id).trim()).filter(Boolean);
  }
  function parsePaymentRunDateRanges(data) {
    const raw = data?.paymentRunDateRanges;
    if (!Array.isArray(raw) || raw.length === 0) {
      return DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range }));
    }
    const ranges = raw.slice(0, 2).map((entry) => {
      const row = entry || {};
      return {
        startDay: parseDayOfMonth(row.startDay ?? row.startDate),
        endDay: parseDayOfMonth(row.endDay ?? row.endDate)
      };
    });
    while (ranges.length < 2) ranges.push({ startDay: 0, endDay: 0 });
    return ranges;
  }
  function paymentRunRangeToFirestore(range) {
    return {
      startDay: range.startDay,
      endDay: range.endDay,
      startDate: range.startDay,
      endDate: range.endDay
    };
  }
  function clampClashLookaheadDays(value) {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const rec = value;
      if (rec.integerValue != null) return clampClashLookaheadDays(rec.integerValue);
      if (rec.doubleValue != null) return clampClashLookaheadDays(rec.doubleValue);
    }
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n)) return DEFAULT_WARNING_DETECTION.clashLookaheadDays;
    return Math.max(1, Math.min(365, Math.round(n)));
  }
  function parseClashLookaheadMode(value) {
    const mode = String(value || "").trim();
    if (mode === "numberOfDays" || mode === "days") return "numberOfDays";
    if (mode === "endOfInvoicingPeriod" || mode === "invoicing") return "endOfInvoicingPeriod";
    if (mode === "endOfWorkingWeek" || mode === "week") return "endOfWorkingWeek";
    return DEFAULT_WARNING_DETECTION.clashLookaheadMode;
  }
  function excludedUnbookedUserIds(record) {
    if (Array.isArray(record.excludedUserIdsFromUnbookedWarnings)) {
      return stringIdList(record.excludedUserIdsFromUnbookedWarnings);
    }
    for (const key of ["excludedUserIds", "excludedUsers", "excludedUserIdsFromWarnings", "unbookedWarningExcludedUserIds"]) {
      if (Array.isArray(record[key])) return stringIdList(record[key]);
    }
    return [];
  }
  function parseWarningDetection(data) {
    const record = asSettingsRecord(data);
    if (!record) return { ...DEFAULT_WARNING_DETECTION, excludedUserIdsFromUnbookedWarnings: [] };
    const daysRaw = record.clashLookaheadDays ?? record.lookaheadDays ?? record.lookAheadDays ?? record.numberOfDays ?? record.daysAhead;
    const days = daysRaw === void 0 || daysRaw === null ? DEFAULT_WARNING_DETECTION.clashLookaheadDays : daysRaw;
    return {
      detectClashes: record.detectClashes !== false,
      clashLookaheadMode: parseClashLookaheadMode(
        record.clashLookaheadMode ?? record.lookAheadMode ?? record.lookaheadMode
      ),
      clashLookaheadDays: clampClashLookaheadDays(days),
      includeWeekendsForUnbookedLabour: Boolean(record.includeWeekendsForUnbookedLabour),
      excludedUserIdsFromUnbookedWarnings: excludedUnbookedUserIds(record)
    };
  }
  function warningDetectionToFirestore(settings) {
    return {
      detectClashes: settings.detectClashes,
      clashLookaheadMode: settings.clashLookaheadMode,
      clashLookaheadDays: clampClashLookaheadDays(settings.clashLookaheadDays),
      includeWeekendsForUnbookedLabour: settings.includeWeekendsForUnbookedLabour,
      excludedUserIdsFromUnbookedWarnings: settings.excludedUserIdsFromUnbookedWarnings
    };
  }
  function parseInvoicing(data) {
    if (!data) return { ...DEFAULT_INVOICING, paymentRunDateRanges: DEFAULT_PAYMENT_RUN_DATE_RANGES.map((range) => ({ ...range })) };
    const paymentRunMode = data.paymentRunMode === "recurring_timeframe" ? "recurring_timeframe" : "date_ranges";
    const paymentDateMode = data.paymentDateMode === "specific_dates" ? "specific_dates" : "recurring_date";
    const paymentDates = Array.isArray(data.paymentDates) ? data.paymentDates.map((d) => String(parseDayOfMonth(d) || Number(d) || "")).filter(Boolean) : [];
    return {
      paymentRunMode,
      paymentDateMode,
      recurringRunStartDay: String(data.recurringRunStartDay ?? DEFAULT_INVOICING.recurringRunStartDay),
      recurringRunEndDay: String(data.recurringRunEndDay ?? DEFAULT_INVOICING.recurringRunEndDay),
      recurringPaymentDay: String(data.recurringPaymentDay ?? DEFAULT_INVOICING.recurringPaymentDay),
      paymentRunDateRanges: parsePaymentRunDateRanges(data),
      paymentDates,
      noteToUsers: String(data.noteToUsers ?? DEFAULT_INVOICING.noteToUsers)
    };
  }
  function capitalizeWeekday(day) {
    if (!day) return day;
    return day.charAt(0).toUpperCase() + day.slice(1);
  }
  function invoicingToFirestore(settings) {
    return {
      paymentRunMode: settings.paymentRunMode,
      paymentDateMode: settings.paymentDateMode,
      paymentRunDateRanges: settings.paymentRunDateRanges.map(paymentRunRangeToFirestore),
      paymentDates: settings.paymentDates.map((d) => Number(d)),
      noteToUsers: settings.noteToUsers,
      recurringPaymentRunSummary: `In arrears: ${capitalizeWeekday(settings.recurringRunStartDay)} to ${capitalizeWeekday(settings.recurringRunEndDay)} (of the previous week)`,
      recurringRunStartDay: settings.recurringRunStartDay,
      recurringRunEndDay: settings.recurringRunEndDay,
      recurringPaymentDay: settings.recurringPaymentDay
    };
  }
  function isValidDay(day) {
    return Number.isInteger(day) && day >= 1 && day <= MONTH_DAYS;
  }
  function validatePaymentRunDateRanges(ranges) {
    if (ranges.length < 2) {
      return "Set two payment run date ranges that together cover every day of the month.";
    }
    const [run1, run2] = ranges;
    if (!isValidDay(run1.startDay) || !isValidDay(run1.endDay)) {
      return "Payment run 1 needs a start and end day (1\u201331).";
    }
    if (!isValidDay(run2.startDay) || !isValidDay(run2.endDay)) {
      return "Payment run 2 needs a start and end day (1\u201331).";
    }
    if (run1.startDay > run1.endDay) return "Payment run 1: start day must be on or before end day.";
    if (run2.startDay > run2.endDay) return "Payment run 2: start day must be on or before end day.";
    if (run1.startDay !== 1) return "Payment run 1 must start on day 1 of the month.";
    if (run2.endDay !== MONTH_DAYS) {
      return `Payment run 2 must end on day ${MONTH_DAYS} so all days of the month are covered.`;
    }
    if (run2.startDay !== run1.endDay + 1) {
      return "Payment runs must not overlap \u2014 run 2 should start the day after run 1 ends (e.g. 1\u201315 then 16\u201331).";
    }
    const covered = /* @__PURE__ */ new Set();
    for (const range of ranges) {
      for (let day = range.startDay; day <= range.endDay; day += 1) {
        if (covered.has(day)) {
          return "Payment run date ranges overlap. Each day of the month must belong to exactly one run.";
        }
        covered.add(day);
      }
    }
    if (covered.size !== MONTH_DAYS) {
      return `All ${MONTH_DAYS} days of the month must be covered across your payment runs.`;
    }
    return null;
  }
  function validatePaymentDates(paymentDates, expectedCount) {
    if (paymentDates.length < expectedCount) {
      return `Set ${expectedCount} payment date${expectedCount === 1 ? "" : "s"} \u2014 one for each payment run.`;
    }
    for (let i = 0; i < expectedCount; i += 1) {
      if (!isValidDay(paymentDates[i])) {
        return `Payment date ${i + 1} must be a day of the month (1\u201331).`;
      }
    }
    return null;
  }
  function validateInvoicingSettings(settings) {
    if (settings.paymentRunMode === "date_ranges") {
      const rangeError = validatePaymentRunDateRanges(settings.paymentRunDateRanges);
      if (rangeError) return rangeError;
      if (settings.paymentDateMode !== "specific_dates") {
        return "Choose payment date/s when using payment run date ranges.";
      }
      const paymentDays = settings.paymentDates.map((d) => Number(d)).filter((d) => Number.isFinite(d) && d > 0);
      return validatePaymentDates(paymentDays, 2);
    }
    if (settings.paymentRunMode === "recurring_timeframe") {
      if (!settings.recurringRunStartDay || !settings.recurringRunEndDay) {
        return "Choose a start day and end day for your recurring payment run.";
      }
      if (settings.paymentDateMode === "recurring_date" && !settings.recurringPaymentDay) {
        return "Choose a recurring payment date.";
      }
      if (settings.paymentDateMode === "specific_dates") {
        const paymentDays = settings.paymentDates.map((d) => Number(d)).filter((d) => Number.isFinite(d) && d > 0);
        if (paymentDays.length < 1) return "Set at least one payment date.";
        for (const day of paymentDays) {
          if (!isValidDay(day)) return "Each payment date must be a day of the month (1\u201331).";
        }
      }
    }
    return null;
  }

  // lib/canonical/userProfile.ts
  function normalizeEmploymentType(raw) {
    if (raw === "paye") return "paye";
    if (raw === "self_employed" || raw === "selfEmployed") return "self_employed";
    return "self_employed";
  }
  function accountKindFromFlags(flags) {
    if (flags.isSuperAdmin) return "admin";
    if (flags.adminAccess || flags.role === "admin") return "admin";
    if (flags.operativeMode) return "operative";
    return "manager";
  }
  function validDay(value) {
    if (value instanceof Date) return Number.isNaN(value.getTime()) ? void 0 : value;
    if (typeof value === "string" || typeof value === "number") {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? void 0 : parsed;
    }
    return void 0;
  }
  function employmentTypeOnDay(user, date, timeZone) {
    const current = normalizeEmploymentType(user.employmentType);
    const from = user.employmentTypeTransitionFrom;
    const day = validDay(date);
    const effectiveAt = validDay(user.employmentTypeEffectiveAt);
    if (!from || !day || !effectiveAt) return current;
    const zone = zoneOrLondon(timeZone);
    if (dayKeyInZone(day, zone) < dayKeyInZone(effectiveAt, zone)) {
      return normalizeEmploymentType(from);
    }
    return current;
  }
  function isBillableSelfEmployedDay(user, date, timeZone) {
    return employmentTypeOnDay(user, date, timeZone) === "self_employed";
  }
  function applyEmploymentTypeChange(input) {
    const next = normalizeEmploymentType(input.nextType);
    const previous = normalizeEmploymentType(input.previousType);
    if (next === previous) {
      const existing = validDay(input.previousEffectiveAt);
      return {
        employmentType: next,
        employmentTypeTransitionFrom: input.previousTransitionFrom ? String(input.previousTransitionFrom) : null,
        employmentTypeEffectiveAt: existing ?? null
      };
    }
    const zone = zoneOrLondon(input.timeZone);
    const todayKey = dayKeyInZone(input.now ?? /* @__PURE__ */ new Date(), zone);
    if (input.effectiveAt === "immediate") {
      return { employmentType: next, employmentTypeTransitionFrom: null, employmentTypeEffectiveAt: null };
    }
    const when = validDay(input.effectiveAt);
    if (!when || dayKeyInZone(when, zone) <= todayKey) {
      return { employmentType: next, employmentTypeTransitionFrom: null, employmentTypeEffectiveAt: null };
    }
    return {
      employmentType: next,
      employmentTypeTransitionFrom: previous,
      employmentTypeEffectiveAt: when
    };
  }
  function employmentEffectiveLabel(user, now = /* @__PURE__ */ new Date(), timeZone) {
    const effectiveAt = validDay(user.employmentTypeEffectiveAt);
    if (!effectiveAt || !user.employmentTypeTransitionFrom) return "Effective immediately";
    const zone = zoneOrLondon(timeZone);
    if (dayKeyInZone(now, zone) >= dayKeyInZone(effectiveAt, zone)) return "Effective immediately";
    const [year, month, day] = dayKeyInZone(effectiveAt, zone).split("-").map(Number);
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${day} ${months[(month || 1) - 1]} ${year}`;
  }

  // lib/canonical/annualLeaveBalance.ts
  var DEFAULT_ANNUAL_LEAVE_DAYS = 25;
  var ANNUAL_LEAVE_ALLOWANCE_COPY = {
    toggleTitle: "Annual leave allowance",
    toggleDescription: "Turn off annual leave allowances using this toggle. This is generally used for self-employed staff who do not get paid annual leave, therefore they do not have a set number of days per year.",
    toggleNote: "When off, this person can still book and see annual leave. They see days taken in the company leave year, not a remaining balance or days per year.",
    remainingTitle: "Manually adjust this user's remaining annual leave allowance for this year",
    remainingNote: "This number will reset to the Days per year figure at the end of your company year."
  };
  function hasAnnualLeaveAllowance(enabled) {
    return enabled !== false;
  }
  function snapLeaveDays(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.round(n * 2) / 2;
  }
  function clampMonth(value, fallback) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    const month = Math.trunc(n);
    if (month < 1 || month > 12) return fallback;
    return month;
  }
  function pad2(n) {
    return n < 10 ? `0${n}` : String(n);
  }
  function lastDayOfMonth(year, month) {
    return new Date(Date.UTC(year, month, 0)).getUTCDate();
  }
  function parseDayKey(value) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    if (!year || month < 1 || month > 12 || day < 1 || day > 31) return null;
    return { year, month, day };
  }
  function leaveYearBounds(input) {
    const parsed = parseDayKey(input.onDayKey);
    const startMonth = clampMonth(input.startMonth, 1);
    const endMonth = clampMonth(input.endMonth, 12);
    if (!parsed) {
      const startDayKey2 = `1970-${pad2(startMonth)}-01`;
      const endDay2 = lastDayOfMonth(endMonth <= startMonth ? 1971 : 1970, endMonth);
      const endDayKey2 = `${endMonth <= startMonth ? 1971 : 1970}-${pad2(endMonth)}-${pad2(endDay2)}`;
      return { startDayKey: startDayKey2, endDayKey: endDayKey2, yearKey: startDayKey2 };
    }
    let year = parsed.year;
    if (parsed.month < startMonth) year -= 1;
    const startDayKey = `${year}-${pad2(startMonth)}-01`;
    const endYear = endMonth <= startMonth ? year + 1 : year;
    const endDay = lastDayOfMonth(endYear, endMonth);
    const endDayKey = `${endYear}-${pad2(endMonth)}-${pad2(endDay)}`;
    return { startDayKey, endDayKey, yearKey: startDayKey };
  }
  function leaveUnits(slot) {
    const raw = String(slot || "").trim().toUpperCase().replace(/\s+/g, "_");
    if (raw === "AM" || raw === "PM") return 0.5;
    return 1;
  }
  function bookingDays(startDayKey, endDayKey, timeZone) {
    const keys = eachDayKey(startDayKey, endDayKey || startDayKey, timeZone);
    return keys.length;
  }
  function bookingCount(booking, timeZone) {
    const start = String(booking.startDayKey || "").trim();
    if (!parseDayKey(start)) return 0;
    const end = String(booking.endDayKey || start).trim() || start;
    return snapLeaveDays(bookingDays(start, end, timeZone) * leaveUnits(booking.timeSlot));
  }
  function bookingsInYear(bookings, startDayKey, endDayKey, status, timeZone) {
    let total = 0;
    for (const booking of bookings) {
      const raw = String(booking.status || "approved").toLowerCase();
      if (raw !== status) continue;
      const start = String(booking.startDayKey || "").trim();
      if (start < startDayKey || start > endDayKey) continue;
      total += bookingCount(booking, timeZone);
    }
    return snapLeaveDays(total);
  }
  function resolveDaysPerYear(userDays, orgDays) {
    const user = Number(userDays);
    if (Number.isFinite(user) && user >= 0) return snapLeaveDays(user);
    const org = Number(orgDays);
    if (Number.isFinite(org) && org >= 0) return snapLeaveDays(org);
    return DEFAULT_ANNUAL_LEAVE_DAYS;
  }
  function previousYearEndKey(startDayKey, timeZone) {
    const start = dateFromDayKeyInZone(startDayKey, timeZone);
    return dayKeyInZone(addDaysInZone(start, -1, timeZone), timeZone);
  }
  function annualLeaveBalance(input) {
    const hasAllowance = hasAnnualLeaveAllowance(input.annualLeaveEnabled);
    const timeZone = zoneOrLondon(input.timeZone);
    const orgStart = clampMonth(input.orgStartMonth, 1);
    const orgEnd = clampMonth(input.orgEndMonth, 12);
    const startMonth = hasAllowance ? clampMonth(input.startMonth, orgStart) : orgStart;
    const endMonth = hasAllowance ? clampMonth(input.endMonth, orgEnd) : orgEnd;
    const year = leaveYearBounds({ startMonth, endMonth, onDayKey: input.onDayKey });
    const bookings = input.bookings ?? [];
    const taken = bookingsInYear(bookings, year.startDayKey, year.endDayKey, "approved", timeZone);
    const pending = bookingsInYear(bookings, year.startDayKey, year.endDayKey, "pending", timeZone);
    const daysPerYear = hasAllowance ? resolveDaysPerYear(input.daysPerYear, input.orgDaysPerYear) : 0;
    const overrideKey = String(input.yearAllowanceKey || "").trim();
    const overrideApplies = hasAllowance && overrideKey !== "" && overrideKey === year.yearKey && Number.isFinite(Number(input.yearAllowance));
    let carriedForward = 0;
    if (hasAllowance && input.carriesOver === true && !overrideApplies && daysPerYear > 0) {
      const prevOn = previousYearEndKey(year.startDayKey, timeZone);
      const previous = leaveYearBounds({ startMonth, endMonth, onDayKey: prevOn });
      const prevTaken = bookingsInYear(
        bookings,
        previous.startDayKey,
        previous.endDayKey,
        "approved",
        timeZone
      );
      carriedForward = Math.max(0, snapLeaveDays(daysPerYear - prevTaken));
    }
    const yearAllowance = overrideApplies ? snapLeaveDays(input.yearAllowance) : null;
    const pot = yearAllowance != null ? yearAllowance : daysPerYear + carriedForward;
    const remaining = hasAllowance ? snapLeaveDays(pot - taken - pending) : null;
    return {
      hasAllowance,
      startDayKey: year.startDayKey,
      endDayKey: year.endDayKey,
      yearKey: year.yearKey,
      taken,
      pending,
      usedThisYear: taken,
      daysPerYear,
      carriedForward,
      yearAllowance,
      remaining
    };
  }
  function applyRemainingOverride(input) {
    const remaining = snapLeaveDays(input.remaining);
    const taken = snapLeaveDays(input.taken);
    const pending = snapLeaveDays(input.pending);
    return {
      annualLeaveYearAllowance: snapLeaveDays(remaining + taken + pending),
      annualLeaveYearAllowanceKey: String(input.yearKey || "").trim()
    };
  }

  // lib/canonical/materialSearch.ts
  var UNIT_TOKEN = /^(mm2|mm|cm|m|kg)$/;
  var NUMBER_TOKEN = /^\d+(?:\.\d+)?$/;
  var MEASURE_TOKEN = /^(\d+(?:\.\d+)?)(mm2|mm|cm|m|kg)$/;
  function normalizeMaterialSearchText(value) {
    return String(value || "").toLowerCase().replace(/mm²|mm\^2/g, "mm2").replace(/&/g, " ").replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
  }
  function expandToken(token) {
    const out = /* @__PURE__ */ new Set([token]);
    const measure = MEASURE_TOKEN.exec(token);
    if (measure) {
      const amount = measure[1];
      const unit = measure[2];
      out.add(amount);
      out.add(unit);
      out.add(amount + unit);
      if (unit === "mm2") {
        out.add(`${amount}mm`);
        out.add("mm");
      }
    }
    const code = /^(\d+)([a-z]+)$/.exec(token);
    if (code) out.add(code[1]);
    return [...out];
  }
  function tokenizeMaterialSearch(value) {
    const raw = normalizeMaterialSearchText(value).split(" ").filter(Boolean);
    const tokens = [];
    for (let i = 0; i < raw.length; i += 1) {
      const current = raw[i];
      const next = raw[i + 1];
      if (next && NUMBER_TOKEN.test(current) && UNIT_TOKEN.test(next)) {
        tokens.push(current + next);
        i += 1;
        continue;
      }
      tokens.push(current);
    }
    return tokens;
  }
  function fieldTokens(value) {
    const tokens = normalizeMaterialSearchText(value).split(" ").filter(Boolean);
    const expanded = [];
    for (const token of tokens) expanded.push(...expandToken(token));
    return expanded;
  }
  function bestHit(...hits) {
    if (hits.includes("exact")) return "exact";
    if (hits.includes("prefix")) return "prefix";
    if (hits.includes("contains")) return "contains";
    return null;
  }
  function tokenHit(queryToken, hayTokens) {
    if (!queryToken) return null;
    for (const hay of hayTokens) {
      if (hay === queryToken) return "exact";
    }
    if (queryToken.length >= 2) {
      for (const hay of hayTokens) {
        if (hay.startsWith(queryToken)) return "prefix";
      }
    }
    if (queryToken.length >= 3) {
      for (const hay of hayTokens) {
        if (hay.includes(queryToken) || hay.length >= 3 && queryToken.startsWith(hay)) return "contains";
      }
    }
    return null;
  }
  function recordFields(record) {
    return {
      name: fieldTokens(record.name),
      brand: fieldTokens(record.brand),
      code: fieldTokens(record.productCode),
      extra: [
        ...fieldTokens(record.category),
        ...fieldTokens(record.size),
        ...fieldTokens(record.length)
      ]
    };
  }
  function materialSearchScore(query, record) {
    const tokens = tokenizeMaterialSearch(query);
    if (tokens.length === 0) return 1;
    const fields = recordFields(record);
    const all = [...fields.name, ...fields.brand, ...fields.code, ...fields.extra];
    let score = 0;
    for (const token of tokens) {
      const named = tokenHit(token, fields.name);
      const branded = tokenHit(token, fields.brand);
      const coded = tokenHit(token, fields.code);
      const extra = tokenHit(token, fields.extra);
      const hit = bestHit(coded, named, branded, extra, tokenHit(token, all));
      if (!hit) return 0;
      if (hit === "exact") score += 40;
      else if (hit === "prefix") score += 26;
      else score += 12;
      if (coded) score += 18;
      if (named) score += 8;
    }
    const name = normalizeMaterialSearchText(record.name);
    const joined = tokens.join(" ");
    if (name.startsWith(joined)) score += 24;
    else if (name.includes(joined)) score += 10;
    const nameLength = name.length;
    if (nameLength > 0) score += Math.max(0, 20 - Math.floor(nameLength / 8));
    return score;
  }
  function materialRecordMatches(query, record) {
    return materialSearchScore(query, record) > 0;
  }
  function rankMaterialRecords(query, records, limit) {
    const tokens = tokenizeMaterialSearch(query);
    const hits = [];
    for (let index = 0; index < records.length; index += 1) {
      const score = tokens.length === 0 ? 1 : materialSearchScore(query, records[index]);
      if (score > 0) hits.push({ index, score });
    }
    if (tokens.length > 0) {
      hits.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        const left = normalizeMaterialSearchText(records[a.index]?.name);
        const right = normalizeMaterialSearchText(records[b.index]?.name);
        return left.localeCompare(right);
      });
    }
    const cap = Number(limit);
    if (Number.isFinite(cap) && cap > 0) return hits.slice(0, cap);
    return hits;
  }
  function catalogueRecordFromItem(item) {
    return {
      name: item.name,
      brand: item.brand,
      productCode: item.productCode,
      category: item.category,
      size: item.size,
      length: item.length
    };
  }
  return __toCommonJS(bundleEntry_exports);
})();
