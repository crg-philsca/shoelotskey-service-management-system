import React, { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Label } from '@/app/components/ui/label';
import { Clock, Calendar, CheckCircle2, RotateCcw, Plus, Trash2, CalendarDays, Info } from 'lucide-react';
import { toast } from 'sonner';
import {
  OperatingScheduleData,
  DEFAULT_OPERATING_SCHEDULE,
  WeeklyOperatingDays,
  SpecialClosureItem,
} from '@/app/lib/operatingSchedule';

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  schedule: OperatingScheduleData;
  onSave: (updated: OperatingScheduleData) => void;
  canManage?: boolean;
}

const DAYS: { key: keyof WeeklyOperatingDays; label: string; full: string }[] = [
  { key: 'monday', label: 'MON', full: 'Monday' },
  { key: 'tuesday', label: 'TUE', full: 'Tuesday' },
  { key: 'wednesday', label: 'WED', full: 'Wednesday' },
  { key: 'thursday', label: 'THU', full: 'Thursday' },
  { key: 'friday', label: 'FRI', full: 'Friday' },
  { key: 'saturday', label: 'SAT', full: 'Saturday' },
  { key: 'sunday', label: 'SUN', full: 'Sunday' },
];

const HOURS = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12'];
const MINUTES = ['00', '05', '10', '15', '20', '25', '30', '35', '40', '45', '50', '55'];

const HOUR_PRESETS = [
  { label: '9 AM – 7 PM', open: '09:00 AM', close: '07:00 PM' },
  { label: '9 AM – 9 PM', open: '09:00 AM', close: '09:00 PM' },
];

const COMMON_TEMPLATES = [
  {
    name: 'Holy Week',
    startDate: '2026-04-01',
    endDate: '2026-04-04',
    dateRange: 'Holy Wednesday-Black Saturday',
    days: 4,
  },
  {
    name: 'Christmas Week',
    startDate: '2026-12-24',
    endDate: '2026-12-25',
    dateRange: 'Christmas Eve to Christmas Day',
    days: 2,
  },
  {
    name: 'New Year',
    startDate: '2026-12-31',
    endDate: '2027-01-01',
    dateRange: 'New Year Eve to New Year Day',
    days: 2,
  },
  {
    name: 'All Saints’ Day (Undas)',
    startDate: '2026-11-01',
    endDate: '2026-11-02',
    dateRange: 'Nov 1 – Nov 2, 2026',
    days: 2,
  },
  {
    name: 'Shop Maintenance',
    startDate: '2026-05-01',
    endDate: '2026-05-01',
    dateRange: 'May 1, 2026',
    days: 1,
  },
];

function parseTimeComponents(timeStr: string) {
  let hour = '09';
  let minute = '00';
  let meridiem = 'AM';

  if (!timeStr) return { hour, minute, meridiem };

  const match12 = timeStr.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (match12) {
    hour = match12[1].padStart(2, '0');
    minute = match12[2].padStart(2, '0');
    meridiem = match12[3].toUpperCase();
    return { hour, minute, meridiem };
  }

  const match24 = timeStr.trim().match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    let h = parseInt(match24[1], 10);
    minute = match24[2].padStart(2, '0');
    if (h >= 12) {
      meridiem = 'PM';
      if (h > 12) h -= 12;
    } else {
      meridiem = 'AM';
      if (h === 0) h = 12;
    }
    hour = String(h).padStart(2, '0');
    return { hour, minute, meridiem };
  }

  return { hour, minute, meridiem };
}

function formatTime(hour: string, minute: string, meridiem: string): string {
  return `${hour}:${minute} ${meridiem}`;
}

function formatIsoToMMDDYYYY(iso: string): string {
  if (!iso) return '';
  const parts = iso.split('-');
  if (parts.length === 3) {
    const [y, m, d] = parts;
    return `${m.padStart(2, '0')}/${d.padStart(2, '0')}/${y}`;
  }
  return iso;
}

function parseMMDDYYYYToIso(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const match = trimmed.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (!match) return null;
  const month = parseInt(match[1], 10);
  const day = parseInt(match[2], 10);
  let year = parseInt(match[3], 10);
  if (year < 100) year += 2000;
  if (month < 1 || month > 12 || day < 1 || day > 31 || year < 1900 || year > 2100) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

interface MMDDYYYYDateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
}

function MMDDYYYYDateInput({ value, onChange, disabled }: MMDDYYYYDateInputProps) {
  const [localText, setLocalText] = useState(formatIsoToMMDDYYYY(value));
  const nativePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalText(formatIsoToMMDDYYYY(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const txt = e.target.value;
    setLocalText(txt);
    const parsedIso = parseMMDDYYYYToIso(txt);
    if (parsedIso !== null) {
      onChange(parsedIso);
    }
  };

  const handleBlur = () => {
    const parsedIso = parseMMDDYYYYToIso(localText);
    if (parsedIso !== null) {
      onChange(parsedIso);
      setLocalText(formatIsoToMMDDYYYY(parsedIso));
    } else {
      setLocalText(formatIsoToMMDDYYYY(value));
    }
  };

  const handleOpenPicker = () => {
    if (disabled) return;
    try {
      nativePickerRef.current?.showPicker();
    } catch {
      nativePickerRef.current?.click();
    }
  };

  return (
    <div className="relative inline-flex items-center">
      <input
        type="text"
        placeholder="MM/DD/YYYY"
        value={localText}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
        onClick={handleOpenPicker}
        className="h-5.5 w-[88px] px-1 text-[10px] font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded focus:outline-none focus:border-red-400 focus:bg-white pr-4.5 cursor-pointer placeholder:text-gray-400"
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={handleOpenPicker}
        className="absolute right-0.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 p-0.5 cursor-pointer"
        title="Choose date from calendar"
      >
        <Calendar className="h-2.5 w-2.5" />
      </button>
      <input
        ref={nativePickerRef}
        type="date"
        value={value || ''}
        disabled={disabled}
        onChange={e => {
          onChange(e.target.value);
        }}
        className="absolute right-0 bottom-0 w-1 h-1 opacity-0 pointer-events-none"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}

export default function ScheduleModal({
  isOpen,
  onClose,
  schedule,
  onSave,
  canManage = true,
}: ScheduleModalProps) {
  const [formData, setFormData] = useState<OperatingScheduleData>(schedule);

  // Swipe / slide tracking for operating days
  const isDraggingRef = useRef(false);
  const dragTargetStateRef = useRef<boolean>(true);

  useEffect(() => {
    if (isOpen) {
      setFormData(schedule);
    }
  }, [isOpen, schedule]);

  // Global pointer release listener for smooth dragging
  useEffect(() => {
    const handleGlobalPointerUp = () => {
      isDraggingRef.current = false;
    };
    window.addEventListener('pointerup', handleGlobalPointerUp);
    window.addEventListener('mouseup', handleGlobalPointerUp);
    window.addEventListener('touchend', handleGlobalPointerUp);
    return () => {
      window.removeEventListener('pointerup', handleGlobalPointerUp);
      window.removeEventListener('mouseup', handleGlobalPointerUp);
      window.removeEventListener('touchend', handleGlobalPointerUp);
    };
  }, []);

  const handleDayPointerDown = (day: keyof WeeklyOperatingDays) => {
    if (!canManage) return;
    isDraggingRef.current = true;
    const nextState = !formData.weeklyDays[day];
    dragTargetStateRef.current = nextState;
    setFormData(prev => ({
      ...prev,
      weeklyDays: { ...prev.weeklyDays, [day]: nextState },
    }));
  };

  const handleDayPointerEnter = (day: keyof WeeklyOperatingDays) => {
    if (!canManage || !isDraggingRef.current) return;
    setFormData(prev => ({
      ...prev,
      weeklyDays: { ...prev.weeklyDays, [day]: dragTargetStateRef.current },
    }));
  };

  const handleSetPreset = (preset: 'all') => {
    if (preset === 'all') {
      setFormData(prev => ({
        ...prev,
        weeklyDays: {
          monday: true,
          tuesday: true,
          wednesday: true,
          thursday: true,
          friday: true,
          saturday: true,
          sunday: true,
        },
      }));
    }
  };

  // Hour and Minute pickers update
  const openTime = parseTimeComponents(formData.openingTime);
  const closeTime = parseTimeComponents(formData.closingTime);

  const updateOpenTime = (field: 'hour' | 'minute' | 'meridiem', val: string) => {
    if (!canManage) return;
    const updated = { ...openTime, [field]: val };
    setFormData(prev => ({
      ...prev,
      openingTime: formatTime(updated.hour, updated.minute, updated.meridiem),
    }));
  };

  const updateCloseTime = (field: 'hour' | 'minute' | 'meridiem', val: string) => {
    if (!canManage) return;
    const updated = { ...closeTime, [field]: val };
    setFormData(prev => ({
      ...prev,
      closingTime: formatTime(updated.hour, updated.minute, updated.meridiem),
    }));
  };

  const handleSetHoursPreset = (open: string, close: string) => {
    if (!canManage) return;
    setFormData(prev => ({
      ...prev,
      openingTime: open,
      closingTime: close,
    }));
  };

  const handleResetDefaults = () => {
    setFormData(DEFAULT_OPERATING_SCHEDULE);
    toast.success('Operating schedule & shop hours reset to default (Mon–Sat 9:00 AM – 7:00 PM, Sunday closed)');
  };

  const handleAddClosure = () => {
    const newClosure: SpecialClosureItem = {
      id: `closure-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: '',
      dateRange: '',
      days: 1,
      startDate: '',
      endDate: '',
    };
    setFormData(prev => ({
      ...prev,
      specialClosures: [...(prev.specialClosures || []), newClosure],
    }));
  };

  const handleApplyTemplate = (id: string, templateIndex: number) => {
    const tpl = COMMON_TEMPLATES[templateIndex];
    if (!tpl) return;
    setFormData(prev => ({
      ...prev,
      specialClosures: (prev.specialClosures || []).map(item => {
        if (item.id === id) {
          return {
            ...item,
            name: tpl.name,
            startDate: tpl.startDate,
            endDate: tpl.endDate,
            dateRange: tpl.dateRange,
            days: tpl.days,
          };
        }
        return item;
      }),
    }));
  };

  const handleDateChange = (id: string, type: 'start' | 'end', dateValue: string) => {
    setFormData(prev => ({
      ...prev,
      specialClosures: (prev.specialClosures || []).map(item => {
        if (item.id === id) {
          const startDate = type === 'start' ? dateValue : (item.startDate || '');
          const endDate = type === 'end' ? dateValue : (item.endDate || '');
          let calculatedDays = item.days;
          let rangeText = item.dateRange;

          if (startDate && endDate) {
            const s = new Date(startDate);
            const e = new Date(endDate);
            if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
              const diffTime = Math.abs(e.getTime() - s.getTime());
              calculatedDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
              const sFormatted = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
              const eFormatted = e.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              rangeText = `${sFormatted} – ${eFormatted}`;
            }
          } else if (startDate && !endDate) {
            const s = new Date(startDate);
            if (!isNaN(s.getTime())) {
              rangeText = s.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              calculatedDays = 1;
            }
          }

          return {
            ...item,
            startDate,
            endDate,
            days: calculatedDays,
            dateRange: rangeText,
          };
        }
        return item;
      }),
    }));
  };

  const handleUpdateClosure = (id: string, field: keyof SpecialClosureItem, value: any) => {
    setFormData(prev => ({
      ...prev,
      specialClosures: (prev.specialClosures || []).map(item => {
        if (item.id === id) {
          return { ...item, [field]: value };
        }
        return item;
      }),
    }));
  };

  const handleDeleteClosure = (id: string) => {
    setFormData(prev => ({
      ...prev,
      specialClosures: (prev.specialClosures || []).filter(item => item.id !== id),
    }));
  };

  const handleSave = () => {
    onSave(formData);
    onClose();
  };

  const openDaysCount = Object.values(formData.weeklyDays).filter(Boolean).length;
  const totalClosureDays = (formData.specialClosures || []).reduce(
    (acc, curr) => acc + (Number(curr.days) || 0),
    0,
  );

  return (
    <Dialog open={isOpen} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent className="w-[96vw] max-w-xl max-h-[92vh] flex flex-col p-3 sm:p-4 rounded-2xl shadow-xl border-0 bg-white overflow-hidden">
        {/* HEADER */}
        <DialogHeader className="pb-2 border-b border-gray-100 shrink-0">
          <div className="flex items-center justify-between pr-8">
            <DialogTitle className="font-black uppercase text-xs sm:text-sm flex items-center flex-wrap gap-1.5 text-gray-900 tracking-wider">
              <Clock className="h-4 w-4 text-red-600 shrink-0" />
              <span>Operating Schedule &amp; Shop Hours</span>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1 h-5 px-2 text-[10px] font-bold text-gray-600 hover:text-red-700 bg-gray-100 hover:bg-red-50 border border-gray-200 hover:border-red-300 rounded-md transition-all cursor-pointer select-none shrink-0 normal-case tracking-normal ml-1"
                title="Reset hours & schedule to default"
              >
                <RotateCcw className="h-2.5 w-2.5 text-gray-500 hover:text-red-600 shrink-0" />
                <span>Reset</span>
              </button>
            </DialogTitle>
          </div>
          <DialogDescription className="text-[10px] sm:text-[10.5px] text-gray-500 mt-0.5">
            Slide days to activate, choose hours &amp; minutes, and configure holiday closures.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 pt-1 flex-1 overflow-y-auto pr-1.5 visible-vertical-scroll min-h-0">
          {/* SECTION 1: OPERATING DAYS (SWIPE / SLIDE INTERACTIVE BAR - MON-SAT REMOVED) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <Label className="font-black uppercase text-[11px] tracking-wider text-gray-900">
                  Operating Days
                </Label>
                <span className="text-[10px] text-gray-500 font-semibold ml-1">
                  ({openDaysCount}/7 active {!formData.weeklyDays.sunday && '• Sun off'})
                </span>
              </div>
              <div className="flex items-center gap-1">
                <span className="text-[9.5px] text-gray-400 italic mr-1 hidden sm:inline">
                  Slide or tap days to toggle
                </span>
                <button
                  type="button"
                  onClick={() => handleSetPreset('all')}
                  className="h-5 px-2 text-[9.5px] font-bold rounded border border-gray-200 bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-red-600 transition-colors cursor-pointer"
                >
                  All 7 Days
                </button>
              </div>
            </div>

            {/* 7-Day Slide / Swipe Bar */}
            <div
              className="grid grid-cols-7 gap-1 bg-gray-50/90 p-1.5 rounded-xl border border-gray-200 select-none touch-none"
            >
              {DAYS.map(({ key, label, full }) => {
                const isActive = formData.weeklyDays[key];
                return (
                  <button
                    key={key}
                    type="button"
                    title={`Click or slide over ${full} (${isActive ? 'Open' : 'Closed'})`}
                    disabled={!canManage}
                    onPointerDown={() => handleDayPointerDown(key)}
                    onPointerEnter={() => handleDayPointerEnter(key)}
                    className={`py-1.5 px-0.5 rounded-lg flex flex-col items-center justify-center transition-all cursor-pointer select-none text-center min-w-0 ${
                      isActive
                        ? 'bg-red-600 text-white shadow-xs font-black ring-1 ring-red-600/30 hover:bg-red-700'
                        : 'bg-white text-gray-400 border border-gray-200/80 hover:bg-gray-100 hover:text-gray-700'
                    }`}
                  >
                    <span className="text-[11px] leading-tight font-black">{label}</span>
                    <span
                      className={`text-[8px] font-bold tracking-tight mt-0.5 leading-none ${
                        isActive ? 'text-red-100' : 'text-gray-400'
                      }`}
                    >
                      {isActive ? 'OPEN' : 'OFF'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SECTION 2: SHOP HOURS (CHOOSE HOUR & MINUTES + QUICK PRESETS) */}
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-1.5">
              <div className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <Label className="font-black uppercase text-[11px] tracking-wider text-gray-900">
                  Shop Hours (Hour &amp; Minutes)
                </Label>
              </div>
              {/* Quick shift presets (2 Presets: 9 AM - 7 PM and 9 AM - 9 PM) */}
              <div className="flex items-center gap-1.5 shrink-0">
                {HOUR_PRESETS.map(p => (
                  <button
                    key={p.label}
                    type="button"
                    onClick={() => handleSetHoursPreset(p.open, p.close)}
                    className={`h-5.5 px-2 text-[9.5px] font-bold rounded-md border transition-colors cursor-pointer ${
                      formData.openingTime === p.open && formData.closingTime === p.close
                        ? 'bg-red-50 text-red-700 border-red-300 font-black ring-1 ring-red-200'
                        : 'bg-gray-50 hover:bg-gray-100 text-gray-600 border-gray-200'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Time Pickers for Hour, Minute, and AM/PM */}
            <div className="flex flex-col sm:flex-row items-center gap-2 bg-gray-50/90 p-2 rounded-xl border border-gray-200">
              {/* Opening Time */}
              <div className="flex items-center justify-between gap-1.5 w-full sm:w-auto flex-1 bg-white p-1 rounded-lg border border-gray-300">
                <span className="text-[11px] font-black text-gray-600 pl-1 shrink-0">Open:</span>
                <div className="flex items-center gap-1">
                  <select
                    value={openTime.hour}
                    disabled={!canManage}
                    onChange={e => updateOpenTime('hour', e.target.value)}
                    className="h-6 w-11 text-center text-xs font-black text-gray-900 bg-gray-50 border border-gray-200 rounded px-0.5 cursor-pointer focus:outline-none"
                  >
                    {HOURS.map(h => (
                      <option key={`open-h-${h}`} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="text-xs font-black text-gray-600">:</span>
                  <select
                    value={openTime.minute}
                    disabled={!canManage}
                    onChange={e => updateOpenTime('minute', e.target.value)}
                    className="h-6 w-11 text-center text-xs font-black text-gray-900 bg-gray-50 border border-gray-200 rounded px-0.5 cursor-pointer focus:outline-none"
                  >
                    {MINUTES.map(m => (
                      <option key={`open-m-${m}`} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => updateOpenTime('meridiem', openTime.meridiem === 'AM' ? 'PM' : 'AM')}
                    className="h-6 px-1.5 text-[10px] font-black rounded bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-800 transition-colors cursor-pointer border border-gray-200 shrink-0"
                  >
                    {openTime.meridiem}
                  </button>
                </div>
              </div>

              <span className="text-gray-400 text-xs font-bold hidden sm:inline">–</span>

              {/* Closing Time */}
              <div className="flex items-center justify-between gap-1.5 w-full sm:w-auto flex-1 bg-white p-1 rounded-lg border border-gray-300">
                <span className="text-[11px] font-black text-gray-600 pl-1 shrink-0">Close:</span>
                <div className="flex items-center gap-1">
                  <select
                    value={closeTime.hour}
                    disabled={!canManage}
                    onChange={e => updateCloseTime('hour', e.target.value)}
                    className="h-6 w-11 text-center text-xs font-black text-gray-900 bg-gray-50 border border-gray-200 rounded px-0.5 cursor-pointer focus:outline-none"
                  >
                    {HOURS.map(h => (
                      <option key={`close-h-${h}`} value={h}>{h}</option>
                    ))}
                  </select>
                  <span className="text-xs font-black text-gray-600">:</span>
                  <select
                    value={closeTime.minute}
                    disabled={!canManage}
                    onChange={e => updateCloseTime('minute', e.target.value)}
                    className="h-6 w-11 text-center text-xs font-black text-gray-900 bg-gray-50 border border-gray-200 rounded px-0.5 cursor-pointer focus:outline-none"
                  >
                    {MINUTES.map(m => (
                      <option key={`close-m-${m}`} value={m}>{m}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => updateCloseTime('meridiem', closeTime.meridiem === 'AM' ? 'PM' : 'AM')}
                    className="h-6 px-1.5 text-[10px] font-black rounded bg-gray-100 hover:bg-red-50 hover:text-red-700 text-gray-800 transition-colors cursor-pointer border border-gray-200 shrink-0"
                  >
                    {closeTime.meridiem}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: SPECIAL CLOSURES & HOLIDAYS (CALENDAR DATES INSERTED + NON-CONSECUTIVE DAYS SUPPORT) */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5 text-red-600 shrink-0" />
                <Label className="font-black uppercase text-[11px] tracking-wider text-gray-900">
                  Special Closures &amp; Holidays
                </Label>
                <span className="text-[10px] text-gray-500 font-semibold ml-1">
                  ({totalClosureDays} days total)
                </span>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={handleAddClosure}
                  className="h-5 px-2 text-[9.5px] font-black rounded border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Plus className="h-3 w-3" /> Add Holiday / Closure
                </button>
              )}
            </div>

            {/* List of dynamic closure cards */}
            <div 
              className="space-y-1.5 bg-slate-50/80 p-1.5 sm:p-2 rounded-xl border border-slate-200 max-h-[185px] sm:max-h-[210px] overflow-y-auto pr-1.5 visible-vertical-scroll"
              style={{ scrollbarGutter: 'stable', scrollbarWidth: 'thin' }}
            >
              {(!formData.specialClosures || formData.specialClosures.length === 0) ? (
                <div className="py-3 text-center text-gray-400 text-[11px] italic">
                  No special closures configured. Click &ldquo;+ Add Holiday / Closure&rdquo; above.
                </div>
              ) : (
                formData.specialClosures.map((closure, idx) => (
                  <div
                    key={closure.id || idx}
                    className="bg-white p-2 rounded-lg border border-slate-200 shadow-2xs space-y-1.5"
                  >
                    {/* Top Row: Template shortcut + Holiday Name + Days counter + Delete */}
                    <div className="flex items-center gap-1.5">
                      <select
                        defaultValue=""
                        onChange={e => {
                          if (e.target.value !== '') {
                            handleApplyTemplate(closure.id, parseInt(e.target.value, 10));
                            e.target.value = '';
                          }
                        }}
                        disabled={!canManage}
                        className="h-6 text-[10px] font-bold text-gray-600 bg-gray-50 border border-gray-200 rounded px-1.5 cursor-pointer max-w-[125px] shrink-0"
                      >
                        <option value="" disabled>Templates...</option>
                        {COMMON_TEMPLATES.map((tpl, tIdx) => (
                          <option key={tpl.name} value={tIdx}>{tpl.name}</option>
                        ))}
                      </select>

                      <Input
                        value={closure.name}
                        onChange={e => handleUpdateClosure(closure.id, 'name', e.target.value)}
                        placeholder="Holiday / Event Name"
                        disabled={!canManage}
                        className="h-6 text-xs font-bold text-gray-900 border-gray-300 placeholder:text-gray-400 flex-1 min-w-0"
                      />

                      <div className="flex items-center gap-1 shrink-0">
                        <Input
                          type="number"
                          min="0"
                          max="30"
                          value={closure.days}
                          onChange={e =>
                            handleUpdateClosure(
                              closure.id,
                              'days',
                              Math.max(0, parseInt(e.target.value, 10) || 0),
                            )
                          }
                          disabled={!canManage}
                          className="h-6 w-11 text-center font-black text-xs text-gray-900 border-gray-300 px-0.5"
                        />
                        <span className="text-[10px] font-bold text-gray-500">days</span>
                      </div>

                      {canManage && (
                        <button
                          type="button"
                          onClick={() => handleDeleteClosure(closure.id)}
                          title="Delete closure"
                          className="h-6 w-6 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded flex items-center justify-center shrink-0 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {/* Bottom Row: Calendar Date Pickers (Concrete Dates pre-filled & auto-calculated) */}
                    <div className="flex flex-wrap sm:flex-nowrap items-center gap-1.5 pt-0.5 text-[10.5px]">
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500 font-semibold shrink-0">From:</span>
                        <MMDDYYYYDateInput
                          value={closure.startDate || ''}
                          disabled={!canManage}
                          onChange={val => handleDateChange(closure.id, 'start', val)}
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-gray-500 font-semibold shrink-0">To:</span>
                        <MMDDYYYYDateInput
                          value={closure.endDate || ''}
                          disabled={!canManage}
                          onChange={val => handleDateChange(closure.id, 'end', val)}
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <Input
                          value={closure.dateRange}
                          onChange={e => handleUpdateClosure(closure.id, 'dateRange', e.target.value)}
                          placeholder="or custom description (e.g. Maundy Thu–Sat)"
                          disabled={!canManage}
                          className="h-5 text-[10px] text-gray-600 border-gray-200 placeholder:text-gray-400 px-1.5"
                        />
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Helpful guidance note on non-consecutive closures */}
            <div className="flex items-center gap-1 text-[9.5px] text-gray-500 px-1">
              <Info className="h-3 w-3 text-gray-400 shrink-0" />
              <span>
                For non-consecutive closures (e.g. Christmas &amp; New Year), add each date period as a separate entry so working days in-between remain open.
              </span>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="flex items-center justify-between gap-3 pt-2 mt-1 border-t border-gray-100 w-full">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            className="flex-1 h-8.5 text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-100 rounded-lg cursor-pointer"
          >
            Cancel
          </Button>
          {canManage && (
            <Button
              type="button"
              onClick={handleSave}
              className="flex-1 h-8.5 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase tracking-wider rounded-lg shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Save
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
