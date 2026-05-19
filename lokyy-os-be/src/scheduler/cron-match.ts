/**
 * cron-match.ts — minimal 5-field POSIX cron matcher.
 *
 * Extracted from lokyy-mcp/src/cron.ts and trimmed. Supports literals,
 * '*', comma-lists, dash-ranges, and step expressions ('*' / '<lo>-<hi>'
 * with '/<n>'). Aliases like '@daily' are intentionally NOT supported —
 * we canonicalize FE shortcuts (e.g. '30m') to real cron expressions in
 * normalizeSchedule() instead, so the matcher only ever sees 5-field
 * input it knows about.
 */

const FIELD_OK = /^[\d*/,-]+$/;

export function isPlausibleCron(s: string): boolean {
  const fields = s.trim().split(/\s+/);
  return fields.length === 5 && fields.every((f) => FIELD_OK.test(f));
}

export function cronMatches(expr: string, now: Date): boolean {
  if (!isPlausibleCron(expr)) return false;
  const [min, hour, dom, mon, dow] = expr.trim().split(/\s+/) as [
    string,
    string,
    string,
    string,
    string,
  ];
  return (
    fieldMatches(min, now.getMinutes()) &&
    fieldMatches(hour, now.getHours()) &&
    fieldMatches(dom, now.getDate()) &&
    fieldMatches(mon, now.getMonth() + 1) &&
    fieldMatches(dow, now.getDay())
  );
}

function fieldMatches(field: string, value: number): boolean {
  if (field === "*") return true;
  if (field.includes(",")) {
    return field.split(",").some((part) => fieldMatches(part, value));
  }
  if (field.includes("/")) {
    const [range, stepStr] = field.split("/");
    const step = Number.parseInt(stepStr ?? "1", 10);
    if (!step) return false;
    if (range === "*") return value % step === 0;
    if (range && range.includes("-")) {
      const [lo, hi] = range.split("-").map((s) => Number.parseInt(s, 10));
      if (lo === undefined || hi === undefined) return false;
      return value >= lo && value <= hi && (value - lo) % step === 0;
    }
    return false;
  }
  if (field.includes("-")) {
    const [lo, hi] = field.split("-").map((s) => Number.parseInt(s, 10));
    if (lo === undefined || hi === undefined) return false;
    return value >= lo && value <= hi;
  }
  return Number.parseInt(field, 10) === value;
}

/**
 * Canonicalize FE-friendly shortcut strings ('30m', '1h', '2h') to
 * 5-field POSIX cron. Real cron expressions pass through unchanged.
 *
 * The shortcuts come from SCHEDULE_PRESETS in lokyy-app's /jobs route.
 */
export function normalizeSchedule(input: string): string {
  const s = input.trim();
  if (!s) return s;
  // Interval shortcuts: minutes
  const mMin = /^(\d+)\s*m(in(ute)?s?)?$/i.exec(s);
  if (mMin) {
    const n = Number.parseInt(mMin[1]!, 10);
    if (n >= 1 && n <= 59) return `*/${n} * * * *`;
  }
  // Interval shortcuts: hours
  const mHour = /^(\d+)\s*h(our?s?)?$/i.exec(s);
  if (mHour) {
    const n = Number.parseInt(mHour[1]!, 10);
    if (n === 1) return "0 * * * *";
    if (n >= 2 && n <= 23) return `0 */${n} * * *`;
  }
  // Otherwise assume the user typed real cron — let the matcher
  // validate it later via isPlausibleCron.
  return s;
}
