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
    paidHoursForNamedSlot: () => paidHoursForNamedSlot,
    qualificationExpiryRows: () => qualificationExpiryRows,
    unbookedLabourRows: () => unbookedLabourRows,
    unverifiedOperativeRows: () => unverifiedOperativeRows
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

  // lib/canonical/warningRows.ts
  function zoneOf2(timeZone) {
    const value = String(timeZone || "").trim();
    return value || LONDON_TIME_ZONE;
  }
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
  function eachDayKey(startKey, endKey, timeZone) {
    if (!startKey || !endKey || startKey > endKey) return [];
    const keys = [];
    let cursor = dateFromDayKeyInZone(startKey, timeZone);
    while (dayKeyInZone(cursor, timeZone) <= endKey) {
      keys.push(dayKeyInZone(cursor, timeZone));
      cursor = addDaysInZone(cursor, 1, timeZone);
      if (keys.length > 400) break;
    }
    return keys;
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
  function formatUnbookedDay(dayKey, timeZone) {
    const date = dateFromDayKeyInZone(dayKey, timeZone);
    return new Intl.DateTimeFormat("en-GB", {
      timeZone,
      weekday: "long",
      day: "numeric",
      month: "long"
    }).format(date);
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
          message
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
  function unbookedLabourRows(input) {
    const timeZone = zoneOf2(input.timeZone);
    const excluded = new Set((input.excludedUserIds || []).map((id) => String(id)));
    const operativeBooked = /* @__PURE__ */ new Set();
    const managerBooked = /* @__PURE__ */ new Set();
    for (const booking of input.bookings) {
      const personId = String(booking.personId || "");
      const dayKey = String(booking.dayKey || "");
      if (!personId || !dayKey) continue;
      if (booking.kind === "manager") managerBooked.add(`${personId}|${dayKey}`);
      else operativeBooked.add(`${personId}|${dayKey}`);
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
    const hasOperativeBooking = (operativeId, dayKey) => Boolean(operativeId) && operativeBooked.has(`${operativeId}|${dayKey}`);
    const hasManagerBooking = (userId, dayKey) => Boolean(userId) && managerBooked.has(`${userId}|${dayKey}`);
    const hasEmailOperativeBooking = (email, dayKey) => {
      const ids = operativeIdsByEmail.get(email);
      if (!ids) return false;
      for (const id of ids) {
        if (hasOperativeBooking(id, dayKey)) return true;
      }
      return false;
    };
    const approvedHolidays = input.holidays.filter((holiday) => holiday.approved);
    const holidayCovers = (dayKey, userId, operativeId) => approvedHolidays.some((holiday) => {
      if (dayKey < holiday.startDayKey || dayKey > holiday.endDayKey) return false;
      const holidayUser = String(holiday.userId || "").trim();
      if (userId && holidayUser && holidayUser === userId) return true;
      if (operativeId && holiday.operativeId && holiday.operativeId === operativeId) return true;
      return false;
    });
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
      const requiredHours = hoursForIsoWeekday(iso, input);
      if (requiredHours <= 1e-3) continue;
      const seen = /* @__PURE__ */ new Set();
      const append = (args) => {
        const seenKey = args.email || args.personKey;
        if (seen.has(seenKey)) return;
        seen.add(seenKey);
        if (args.hasBooking) return;
        rows.push({
          id: `unbooked-${dayKey}-${args.personKey}`,
          operativeId: args.operativeId,
          operativeName: args.name,
          userId: args.userId,
          personKey: args.personKey,
          dayKey,
          missingHours: requiredHours,
          message: `${args.name} is not booked on ${formatUnbookedDay(dayKey, timeZone)}.`
        });
      };
      for (const person of operativeUsers) {
        if (excluded.has(person.id)) continue;
        const linked = operativesByEmail.get(emailKey(person.email));
        if (holidayCovers(dayKey, person.id, linked?.id)) continue;
        const email = emailKey(person.email);
        append({
          personKey: person.id,
          name: person.name,
          email,
          hasBooking: hasEmailOperativeBooking(email, dayKey) || hasOperativeBooking(linked?.id, dayKey) || hasManagerBooking(person.id, dayKey),
          operativeId: linked?.id || person.id,
          userId: person.id
        });
      }
      for (const person of managerUsers) {
        if (excluded.has(person.id)) continue;
        const linked = operativesByEmail.get(emailKey(person.email));
        if (holidayCovers(dayKey, person.id, linked?.id)) continue;
        const email = emailKey(person.email);
        append({
          personKey: person.id,
          name: person.name,
          email,
          hasBooking: hasEmailOperativeBooking(email, dayKey) || hasManagerBooking(person.id, dayKey) || hasOperativeBooking(linked?.id, dayKey),
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
        if (holidayCovers(dayKey, matched?.id, operative.id)) continue;
        append({
          personKey: matched?.id || operative.id,
          name: matched?.name || operative.name,
          email: email || operative.id,
          hasBooking: hasEmailOperativeBooking(email, dayKey) || hasOperativeBooking(operative.id, dayKey) || hasManagerBooking(matched?.id, dayKey),
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
  return __toCommonJS(bundleEntry_exports);
})();
