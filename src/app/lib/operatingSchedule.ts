export interface WeeklyOperatingDays {
  monday: boolean;
  tuesday: boolean;
  wednesday: boolean;
  thursday: boolean;
  friday: boolean;
  saturday: boolean;
  sunday: boolean;
}

export interface SpecialClosureItem {
  id: string;
  name: string;
  dateRange: string;
  days: number;
  startDate?: string;
  endDate?: string;
}

export interface OperatingScheduleData {
  weeklyDays: WeeklyOperatingDays;
  openingTime: string;
  closingTime: string;
  holyWeekRange: string;
  holyWeekDays: number;
  christmasRange: string;
  christmasDays: number;
  specialClosures: SpecialClosureItem[];
}

export const DEFAULT_SPECIAL_CLOSURES: SpecialClosureItem[] = [
  {
    id: 'holy-week',
    name: 'Holy Week',
    startDate: '2026-04-01',
    endDate: '2026-04-04',
    dateRange: 'Holy Wednesday-Black Saturday',
    days: 4,
  },
  {
    id: 'christmas-week',
    name: 'Christmas Week',
    startDate: '2026-12-24',
    endDate: '2026-12-25',
    dateRange: 'Christmas Eve to Christmas Day',
    days: 2,
  },
  {
    id: 'new-year',
    name: 'New Year',
    startDate: '2026-12-31',
    endDate: '2027-01-01',
    dateRange: 'New Year Eve to New Year Day',
    days: 2,
  },
];

export const DEFAULT_OPERATING_SCHEDULE: OperatingScheduleData = {
  weeklyDays: {
    monday: true,
    tuesday: true,
    wednesday: true,
    thursday: true,
    friday: true,
    saturday: true,
    sunday: false,
  },
  openingTime: '09:00 AM',
  closingTime: '07:00 PM',
  holyWeekRange: 'Holy Wednesday-Black Saturday',
  holyWeekDays: 4,
  christmasRange: 'Christmas Eve to Christmas Day',
  christmasDays: 2,
  specialClosures: DEFAULT_SPECIAL_CLOSURES,
};

export const OPERATING_SCHEDULE_STORAGE_KEY = 'shoelotskey_operating_schedule';

export function parseHour(timeStr: string, fallback: number): number {
  if (!timeStr) return fallback;
  const clean = timeStr.trim();
  const match12 = clean.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    let hour = parseInt(match12[1], 10);
    const meridiem = match12[3].toUpperCase();
    if (meridiem === 'PM' && hour < 12) hour += 12;
    if (meridiem === 'AM' && hour === 12) hour = 0;
    return hour;
  }
  const match24 = clean.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    return parseInt(match24[1], 10);
  }
  return fallback;
}

export function getOperatingHoursRange(schedule?: OperatingScheduleData): { startHour: number; endHour: number } {
  const sched = schedule || getOperatingSchedule();
  const startHour = parseHour(sched.openingTime, 9);
  const endHour = parseHour(sched.closingTime, 19);
  return {
    startHour: Math.min(startHour, endHour),
    endHour: Math.max(startHour, endHour),
  };
}

export function getOperatingSchedule(): OperatingScheduleData {
  if (typeof window === 'undefined') return DEFAULT_OPERATING_SCHEDULE;
  try {
    const raw = localStorage.getItem(OPERATING_SCHEDULE_STORAGE_KEY);
    if (!raw) return DEFAULT_OPERATING_SCHEDULE;
    const parsed = JSON.parse(raw);

    // Dynamic closures migration & fallback with calendar dates
    let closures: SpecialClosureItem[] = DEFAULT_SPECIAL_CLOSURES;
    if (Array.isArray(parsed.specialClosures) && parsed.specialClosures.length > 0) {
      closures = parsed.specialClosures.map((c: SpecialClosureItem) => {
        // Auto-fill dates if missing on standard closures
        const nameLower = (c.name || '').toLowerCase();
        if (!c.startDate && (nameLower.includes('holy') || c.id.includes('holy'))) {
          return { ...c, startDate: '2026-04-02', endDate: '2026-04-04' };
        }
        if (!c.startDate && (nameLower.includes('christ') || c.id.includes('xmas') || c.id.includes('christ'))) {
          return { ...c, startDate: '2026-12-24', endDate: '2026-12-26' };
        }
        if (!c.startDate && (nameLower.includes('new year') || c.id.includes('new-year'))) {
          return { ...c, startDate: '2026-12-31', endDate: '2027-01-01' };
        }
        return c;
      });
    } else if (parsed.holyWeekRange || parsed.christmasRange) {
      closures = DEFAULT_SPECIAL_CLOSURES;
    }

    return {
      ...DEFAULT_OPERATING_SCHEDULE,
      ...parsed,
      specialClosures: closures,
      weeklyDays: {
        ...DEFAULT_OPERATING_SCHEDULE.weeklyDays,
        ...(parsed.weeklyDays || {}),
      },
    };
  } catch {
    return DEFAULT_OPERATING_SCHEDULE;
  }
}

export function saveOperatingSchedule(schedule: OperatingScheduleData): void {
  if (typeof window === 'undefined') return;
  try {
    // Keep backward-compatible scalar fields synchronized with dynamic list
    const holyItem = schedule.specialClosures?.find(c => c.id === 'holy-week' || c.name.toLowerCase().includes('holy'));
    const xmasItem = schedule.specialClosures?.find(c => c.id === 'christmas-new-year' || c.name.toLowerCase().includes('christ') || c.name.toLowerCase().includes('xmas'));
    
    const enrichedSchedule: OperatingScheduleData = {
      ...schedule,
      holyWeekRange: holyItem ? holyItem.dateRange : (schedule.holyWeekRange || 'Maundy Thursday to Black Saturday'),
      holyWeekDays: holyItem ? holyItem.days : (schedule.holyWeekDays ?? 3),
      christmasRange: xmasItem ? xmasItem.dateRange : (schedule.christmasRange || 'Dec 24–26, Dec 31–Jan 1'),
      christmasDays: xmasItem ? xmasItem.days : (schedule.christmasDays ?? 4),
    };

    localStorage.setItem(OPERATING_SCHEDULE_STORAGE_KEY, JSON.stringify(enrichedSchedule));
    window.dispatchEvent(new CustomEvent('shoelotskey_schedule_updated', { detail: enrichedSchedule }));
  } catch (err) {
    console.error('Failed to save operating schedule:', err);
  }
}

export function getOperatingDaysSummary(days: WeeklyOperatingDays): string {
  if (days.monday && days.tuesday && days.wednesday && days.thursday && days.friday && days.saturday && !days.sunday) {
    return 'Mon–Sat';
  }
  if (days.monday && days.tuesday && days.wednesday && days.thursday && days.friday && days.saturday && days.sunday) {
    return 'All 7 Days';
  }
  const count = Object.values(days).filter(Boolean).length;
  return `${count} Days/Wk`;
}

export function getOperatingDaysLabel(days: WeeklyOperatingDays): string {
  const { monday, tuesday, wednesday, thursday, friday, saturday, sunday } = days;
  if (monday && tuesday && wednesday && thursday && friday && saturday && sunday) {
    return 'All 7 Days';
  }
  if (monday && tuesday && wednesday && thursday && friday && saturday && !sunday) {
    return 'Mon–Sat';
  }
  if (monday && tuesday && wednesday && thursday && friday && !saturday && !sunday) {
    return 'Mon–Fri';
  }
  if (monday && tuesday && wednesday && thursday && friday && !saturday && sunday) {
    return 'Mon–Fri, Sun';
  }
  const active: string[] = [];
  if (monday) active.push('Mon');
  if (tuesday) active.push('Tue');
  if (wednesday) active.push('Wed');
  if (thursday) active.push('Thu');
  if (friday) active.push('Fri');
  if (saturday) active.push('Sat');
  if (sunday) active.push('Sun');
  if (active.length === 0) return 'Closed';
  return active.join(', ');
}

export function getClosedDaysSummary(days: WeeklyOperatingDays): string {
  const dayNames: { key: keyof WeeklyOperatingDays; label: string; short: string }[] = [
    { key: 'monday', label: 'Monday', short: 'Mon' },
    { key: 'tuesday', label: 'Tuesday', short: 'Tue' },
    { key: 'wednesday', label: 'Wednesday', short: 'Wed' },
    { key: 'thursday', label: 'Thursday', short: 'Thu' },
    { key: 'friday', label: 'Friday', short: 'Fri' },
    { key: 'saturday', label: 'Saturday', short: 'Sat' },
    { key: 'sunday', label: 'Sunday', short: 'Sun' },
  ];
  const closed = dayNames.filter(d => !days[d.key]);
  if (closed.length === 0) return '';
  if (closed.length === 1) return closed[0].label;
  return closed.map(c => c.short).join(', ');
}
