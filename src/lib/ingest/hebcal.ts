// HebCal REST API client — used to push a card's billing date off Shabbat
// and Israeli public holidays (banks don't settle on those days), the same
// way an Israeli bank postpones a charge to the nearest following business
// day. No auth required; https://www.hebcal.com/home/195/jewish-calendar-rest-api.
//
// Only "major" holidays (yomtov=true: the days work/banking actually stops —
// Rosh Hashana, Yom Kippur, Sukkot/Pesach first & last days, Shavuot, etc.)
// are treated as non-business days; Chol HaMoed and minor fasts are not.
const HEBCAL_URL = "https://www.hebcal.com/hebcal";

// One Set of "YYYY-MM-DD" holiday dates per Gregorian year, cached in-memory
// for the life of the server process — the calendar for a given year never
// changes.
const yearCache = new Map<number, Set<string>>();

async function fetchHolidayYear(year: number): Promise<Set<string>> {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const url = `${HEBCAL_URL}?v=1&cfg=json&maj=on&min=off&mod=off&nx=off&mf=off&ss=off&c=on&geo=geoname&geonameid=281184&year=${year}&month=x`;
  const dates = new Set<string>();
  try {
    const res = await fetch(url);
    if (res.ok) {
      const data = (await res.json()) as { items?: Array<{ date: string; yomtov?: boolean }> };
      for (const item of data.items ?? []) {
        if (item.yomtov) dates.add(item.date.slice(0, 10));
      }
    }
  } catch {
    // Network/API failure: fall back to Shabbat-only adjustment rather than
    // failing the whole forecast.
  }
  yearCache.set(year, dates);
  return dates;
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function isNonBusinessDay(date: Date): Promise<boolean> {
  if (date.getDay() === 6) return true; // Saturday
  const holidays = await fetchHolidayYear(date.getFullYear());
  return holidays.has(toISODate(date));
}

// Given a card's raw billing date, returns the date it actually settles on:
// unchanged if it's a business day, otherwise pushed forward day by day
// (matching Israeli bank practice of postponing, never bringing forward)
// until it lands on one.
export async function adjustToNextBusinessDay(date: Date): Promise<Date> {
  const candidate = new Date(date);
  for (let i = 0; i < 14; i++) {
    if (!(await isNonBusinessDay(candidate))) return candidate;
    candidate.setDate(candidate.getDate() + 1);
  }
  return candidate;
}
