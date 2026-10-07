import React, { useState, useEffect, useRef } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';

interface MMDDYYYYDatePickerProps {
  value: string; // ISO date 'YYYY-MM-DD' or ''
  onChange: (isoDate: string) => void;
  className?: string;
  placeholder?: string;
  disabled?: boolean;
  'aria-label'?: string;
  variant?: 'default' | 'embedded';
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

export default function MMDDYYYYDatePicker({
  value,
  onChange,
  className = '',
  placeholder = 'MM/DD/YYYY',
  disabled = false,
  'aria-label': ariaLabel,
  variant = 'default',
}: MMDDYYYYDatePickerProps) {
  const [localText, setLocalText] = useState(formatIsoToMMDDYYYY(value));
  const nativePickerRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLocalText(formatIsoToMMDDYYYY(value));
  }, [value]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const inputVal = e.target.value;
    if (!inputVal.trim()) {
      setLocalText('');
      onChange('');
      return;
    }

    let digits = inputVal.replace(/[^0-9]/g, '');
    if (digits.length > 8) digits = digits.substring(0, 8);

    let formatted = digits;
    if (digits.length > 2) {
      formatted = digits.substring(0, 2) + '/' + digits.substring(2);
    }
    if (digits.length > 4) {
      formatted = digits.substring(0, 2) + '/' + digits.substring(2, 4) + '/' + digits.substring(4);
    }

    setLocalText(formatted);

    if (digits.length === 8) {
      const mm = digits.substring(0, 2);
      const dd = digits.substring(2, 4);
      const yyyy = digits.substring(4, 8);
      const mNum = parseInt(mm, 10);
      const dNum = parseInt(dd, 10);
      const yNum = parseInt(yyyy, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31 && yNum >= 1900 && yNum <= 2100) {
        const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        onChange(iso);
      }
    }
  };

  const handleBlur = () => {
    if (!localText.trim()) {
      onChange('');
      return;
    }
    const digits = localText.replace(/[^0-9]/g, '');
    if (digits.length === 8) {
      const mm = digits.substring(0, 2);
      const dd = digits.substring(2, 4);
      const yyyy = digits.substring(4, 8);
      const mNum = parseInt(mm, 10);
      const dNum = parseInt(dd, 10);
      const yNum = parseInt(yyyy, 10);
      if (mNum >= 1 && mNum <= 12 && dNum >= 1 && dNum <= 31 && yNum >= 1900 && yNum <= 2100) {
        const iso = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
        onChange(iso);
        setLocalText(`${mm}/${dd}/${yyyy}`);
        return;
      }
    }
    // Revert to current prop value if invalid
    setLocalText(formatIsoToMMDDYYYY(value));
  };

  const handleNativePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const isoVal = e.target.value;
    if (isoVal) {
      setLocalText(formatIsoToMMDDYYYY(isoVal));
      onChange(isoVal);
    } else {
      setLocalText('');
      onChange('');
    }
  };

  const openPicker = () => {
    if (disabled) return;
    if (nativePickerRef.current) {
      try {
        if (typeof nativePickerRef.current.showPicker === 'function') {
          nativePickerRef.current.showPicker();
        } else {
          nativePickerRef.current.focus();
        }
      } catch {
        nativePickerRef.current.focus();
      }
    }
  };

  const hasCustomWidth = className.includes('w-');
  const widthClass = hasCustomWidth
    ? ''
    : variant === 'embedded'
    ? 'w-24 sm:w-28'
    : 'w-32 sm:w-36';

  const inputStyle =
    variant === 'embedded'
      ? 'mmddyyyy-datepicker-input h-8 w-full border-0 bg-transparent px-1.5 pr-6 text-xs font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-bold focus:outline-none focus:ring-0 cursor-pointer'
      : 'mmddyyyy-datepicker-input h-10 w-full rounded-md border border-red-300 hover:border-red-400 bg-white px-2.5 pr-8 text-xs font-bold text-gray-900 placeholder:text-gray-400 placeholder:font-bold focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500 cursor-pointer';

  const iconRightClass = variant === 'embedded' ? 'right-1' : 'right-2';

  return (
    <div className={`relative inline-flex items-center ${widthClass} ${className}`}>
      <input
        type="text"
        placeholder={placeholder}
        value={localText}
        onChange={handleInputChange}
        onBlur={handleBlur}
        disabled={disabled}
        onClick={openPicker}
        aria-label={ariaLabel}
        className={inputStyle}
      />
      <button
        type="button"
        tabIndex={-1}
        disabled={disabled}
        onClick={openPicker}
        className={`absolute ${iconRightClass} top-1/2 -translate-y-1/2 text-red-600 hover:text-red-700 cursor-pointer p-0.5`}
        title="Open calendar"
      >
        <CalendarIcon className="h-4 w-4" />
      </button>
      <input
        ref={nativePickerRef}
        type="date"
        value={value || ''}
        disabled={disabled}
        onChange={handleNativePickerChange}
        className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 opacity-0 cursor-pointer z-10"
        tabIndex={-1}
        aria-hidden="true"
      />
    </div>
  );
}
