import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Calendar as CalendarIcon,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Search,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

// ============================================================================
// 1. MANUAL DATE INPUT + INTERACTIVE CALENDAR PICKER
// ============================================================================

interface DateInputWithCalendarProps {
  value: string; // YYYY-MM-DD
  onChange: (isoDate: string) => void;
  label?: string;
  required?: boolean;
}

function isoToDisplayDate(iso: string): string {
  if (!iso) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso.trim());
  if (!match) return iso;
  const [, yyyy, mm, dd] = match;
  return `${mm}/${dd}/${yyyy}`;
}

function parseFlexibleDateToIso(raw: string): string | null {
  const clean = raw.trim();
  if (!clean) return null;

  // Match YYYY-MM-DD or YYYY/MM/DD
  const isoMatch = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/.exec(clean);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10);
    const day = parseInt(isoMatch[3], 10);
    if (isValidDateParts(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  // Match MM/DD/YYYY or MM-DD-YYYY or M/D/YY
  const usMatch = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})$/.exec(clean);
  if (usMatch) {
    const month = parseInt(usMatch[1], 10);
    const day = parseInt(usMatch[2], 10);
    let year = parseInt(usMatch[3], 10);
    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }
    if (isValidDateParts(year, month, day)) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}

function isValidDateParts(year: number, month: number, day: number): boolean {
  if (year < 1990 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;
  const dt = new Date(year, month - 1, day);
  return (
    dt.getFullYear() === year &&
    dt.getMonth() === month - 1 &&
    dt.getDate() === day
  );
}

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const DAY_HEADERS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export const DateInputWithCalendar: React.FC<DateInputWithCalendarProps> = ({
  value,
  onChange,
  label,
  required = false,
}) => {
  const [textValue, setTextValue] = useState<string>(() =>
    isoToDisplayDate(value)
  );
  const [isFocused, setIsFocused] = useState(false);
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  const [inputError, setInputError] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sync external value changes when not actively typing
  useEffect(() => {
    if (!isFocused) {
      setTextValue(isoToDisplayDate(value));
      setInputError(false);
    }
  }, [value, isFocused]);

  // Parse current value for calendar month/year view
  const parsedCurrent = useMemo(() => {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
    if (match) {
      return {
        year: parseInt(match[1], 10),
        month: parseInt(match[2], 10) - 1,
        day: parseInt(match[3], 10),
      };
    }
    const now = new Date();
    return {
      year: now.getFullYear(),
      month: now.getMonth(),
      day: now.getDate(),
    };
  }, [value]);

  const [viewYear, setViewYear] = useState<number>(parsedCurrent.year);
  const [viewMonth, setViewMonth] = useState<number>(parsedCurrent.month);

  useEffect(() => {
    setViewYear(parsedCurrent.year);
    setViewMonth(parsedCurrent.month);
  }, [parsedCurrent.year, parsedCurrent.month]);

  // Close calendar popover on outside click
  useEffect(() => {
    if (!isCalendarOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsCalendarOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isCalendarOpen]);

  const handleTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setTextValue(raw);
    const parsedIso = parseFlexibleDateToIso(raw);
    if (parsedIso) {
      setInputError(false);
      onChange(parsedIso);
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    const parsedIso = parseFlexibleDateToIso(textValue);
    if (parsedIso) {
      setInputError(false);
      onChange(parsedIso);
      setTextValue(isoToDisplayDate(parsedIso));
    } else if (textValue.trim() === '') {
      setTextValue(isoToDisplayDate(value));
      setInputError(false);
    } else {
      setInputError(true);
    }
  };

  const handleSelectDay = (day: number) => {
    const iso = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(
      day
    ).padStart(2, '0')}`;
    onChange(iso);
    setTextValue(isoToDisplayDate(iso));
    setInputError(false);
    setIsCalendarOpen(false);
  };

  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleQuickToday = () => {
    const todayIso = new Date().toISOString().slice(0, 10);
    onChange(todayIso);
    setTextValue(isoToDisplayDate(todayIso));
    setInputError(false);
    setIsCalendarOpen(false);
  };

  const handleQuickYesterday = () => {
    const yestIso = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    onChange(yestIso);
    setTextValue(isoToDisplayDate(yestIso));
    setInputError(false);
    setIsCalendarOpen(false);
  };

  // Build calendar grid for viewYear / viewMonth
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstDayOfMonth; i++) {
      cells.push(null);
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push(d);
    }
    return cells;
  }, [viewYear, viewMonth]);

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <label className="block text-xs font-bold text-slate-300 mb-1">
          {label}
        </label>
      )}
      <div className="relative flex items-center">
        <input
          type="text"
          required={required}
          value={textValue}
          onFocus={() => setIsFocused(true)}
          onChange={handleTextChange}
          onBlur={handleBlur}
          placeholder="MM/DD/YYYY or YYYY-MM-DD"
          className={`w-full pl-3 pr-10 py-2.5 rounded-xl bg-slateDark-950 border text-xs sm:text-sm font-bold text-white placeholder-slate-500 focus:outline-none transition ${
            inputError
              ? 'border-rose-500 focus:border-rose-400'
              : 'border-slate-700 focus:border-phoenix-500'
          }`}
        />
        <button
          type="button"
          onClick={() => setIsCalendarOpen((o) => !o)}
          title="Open Calendar Picker"
          className={`absolute right-1.5 p-1.5 rounded-lg transition ${
            isCalendarOpen
              ? 'bg-phoenix-600 text-white'
              : 'bg-slate-800 hover:bg-slate-700 text-phoenix-300'
          }`}
        >
          <CalendarIcon className="w-4 h-4" />
        </button>
      </div>

      {inputError && (
        <p className="text-[10px] text-rose-400 mt-1">
          Enter as MM/DD/YYYY (e.g. 11/14/2026) or pick from calendar
        </p>
      )}

      {/* Interactive Calendar Popover */}
      {isCalendarOpen && (
        <div className="absolute left-0 mt-1.5 z-[1200] w-72 p-3.5 rounded-2xl bg-slateDark-900 border-2 border-phoenix-500/50 shadow-2xl space-y-3">
          {/* Month / Year Navigation */}
          <div className="flex items-center justify-between gap-1">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg bg-slateDark-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-1.5">
              <select
                value={viewMonth}
                onChange={(e) => setViewMonth(Number(e.target.value))}
                className="px-2 py-1 rounded-lg bg-slateDark-950 border border-slate-700 text-xs font-extrabold text-white focus:outline-none"
              >
                {MONTH_NAMES.map((m, idx) => (
                  <option key={m} value={idx}>
                    {m}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={viewYear}
                onChange={(e) => {
                  const yr = parseInt(e.target.value, 10);
                  if (yr >= 1990 && yr <= 2100) setViewYear(yr);
                }}
                className="w-16 px-2 py-1 rounded-lg bg-slateDark-950 border border-slate-700 text-xs font-extrabold text-white text-center focus:outline-none"
              />
            </div>

            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg bg-slateDark-950 hover:bg-slate-800 text-slate-300 border border-slate-800"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday Headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {DAY_HEADERS.map((d) => (
              <div
                key={d}
                className="text-[10px] font-extrabold uppercase text-slate-400 py-0.5"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Day Cells */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((day, idx) => {
              if (day === null) {
                return <div key={`empty-${idx}`} className="h-8" />;
              }
              const isSelected =
                parsedCurrent.year === viewYear &&
                parsedCurrent.month === viewMonth &&
                parsedCurrent.day === day;

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => handleSelectDay(day)}
                  className={`h-8 rounded-lg text-xs font-bold transition flex items-center justify-center ${
                    isSelected
                      ? 'bg-phoenix-600 text-white font-black shadow-md shadow-phoenix-600/40'
                      : 'bg-slateDark-950 hover:bg-slate-800 text-slate-200 border border-slate-800/70'
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Quick Select Footer */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-800">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={handleQuickToday}
                className="px-2.5 py-1 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/30 text-[11px] font-bold"
              >
                Today
              </button>
              <button
                type="button"
                onClick={handleQuickYesterday}
                className="px-2.5 py-1 rounded-lg bg-slateDark-950 hover:bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold"
              >
                Yesterday
              </button>
            </div>
            <button
              type="button"
              onClick={() => setIsCalendarOpen(false)}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// 2. MULTI-SELECT DROPDOWN OF PREVIOUS WALKERS + ADD NEW PERSON
// ============================================================================

interface WalkParticipantsSelectorProps {
  selectedMembers: string[];
  onChangeMembers: (members: string[]) => void;
  allKnownPeople: string[];
  onAddNewPerson?: (name: string) => void;
  label?: string;
  helperText?: string;
}

export const WalkParticipantsSelector: React.FC<
  WalkParticipantsSelectorProps
> = ({
  selectedMembers,
  onChangeMembers,
  allKnownPeople,
  onAddNewPerson,
  label = 'Who Walked in This Group?',
  helperText = 'Select multiple people from previous walks using the dropdown, or add a new person',
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [newPersonName, setNewPersonName] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Merge allKnownPeople and currently selectedMembers into a deduplicated, sorted list
  const combinedPeopleList = useMemo(() => {
    const map = new Map<string, string>();
    [...allKnownPeople, ...selectedMembers].forEach((raw) => {
      const clean = (raw || '').trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!map.has(key)) {
        map.set(key, clean);
      }
    });
    return Array.from(map.values()).sort((a, b) => a.localeCompare(b));
  }, [allKnownPeople, selectedMembers]);

  const filteredPeople = useMemo(() => {
    const q = searchFilter.trim().toLowerCase();
    if (!q) return combinedPeopleList;
    return combinedPeopleList.filter((name) =>
      name.toLowerCase().includes(q)
    );
  }, [combinedPeopleList, searchFilter]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isDropdownOpen]);

  const isPersonSelected = (name: string) =>
    selectedMembers.some((m) => m.toLowerCase() === name.toLowerCase());

  const handleTogglePerson = (name: string) => {
    if (isPersonSelected(name)) {
      if (selectedMembers.length <= 1) return; // keep at least 1 person on walk
      onChangeMembers(
        selectedMembers.filter((m) => m.toLowerCase() !== name.toLowerCase())
      );
    } else {
      onChangeMembers([...selectedMembers, name]);
    }
  };

  const handleAddNewPersonSubmit = () => {
    const clean = newPersonName.trim();
    if (!clean) return;
    if (!isPersonSelected(clean)) {
      onChangeMembers([...selectedMembers, clean]);
    }
    if (onAddNewPerson) {
      onAddNewPerson(clean);
    }
    setNewPersonName('');
  };

  return (
    <div className="p-4 rounded-xl bg-slateDark-950 border border-slate-800 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <label className="text-xs sm:text-sm font-extrabold text-white flex items-center gap-1.5">
            <Users className="w-4 h-4 text-phoenix-400" />
            <span>{label}</span>
          </label>
          {helperText && (
            <p className="text-[11px] text-slate-400 mt-0.5">{helperText}</p>
          )}
        </div>

        <div className="px-3 py-1 rounded-full bg-phoenix-500/15 border border-phoenix-500/30 text-phoenix-300 text-xs font-extrabold">
          👥 {selectedMembers.length}{' '}
          {selectedMembers.length === 1 ? 'Person' : 'People'} Selected (
          {selectedMembers.length}x Vol. Hours)
        </div>
      </div>

      {/* Currently Selected Walkers Badges */}
      <div className="flex flex-wrap items-center gap-2">
        {selectedMembers.map((member, idx) => (
          <span
            key={member}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-phoenix-600/25 border border-phoenix-500/50 text-xs font-bold text-white"
          >
            <span>
              {idx === 0 ? '📱 ' : '👟 '}
              {member}
            </span>
            {selectedMembers.length > 1 && (
              <button
                type="button"
                onClick={() => handleTogglePerson(member)}
                className="text-slate-300 hover:text-rose-400 ml-0.5"
                title={`Remove ${member}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </span>
        ))}
      </div>

      {/* Controls Row: Multi-Select Dropdown of Previous Walkers + Add New Person Input */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {/* Multi-Select Dropdown */}
        <div ref={dropdownRef} className="relative">
          <button
            type="button"
            onClick={() => setIsDropdownOpen((o) => !o)}
            className={`w-full px-3.5 py-2.5 rounded-xl bg-slateDark-900 border text-xs sm:text-sm font-bold flex items-center justify-between gap-2 transition ${
              isDropdownOpen
                ? 'border-phoenix-500 text-white ring-2 ring-phoenix-500/20'
                : 'border-slate-700 hover:border-slate-600 text-slate-200'
            }`}
          >
            <span className="truncate">
              👥 Select Previous Walkers ({selectedMembers.length} of{' '}
              {combinedPeopleList.length} selected)
            </span>
            <ChevronDown
              className={`w-4 h-4 text-phoenix-400 shrink-0 transition-transform ${
                isDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isDropdownOpen && (
            <div className="absolute left-0 right-0 mt-1.5 z-[1100] rounded-2xl bg-slateDark-900 border-2 border-phoenix-500/50 shadow-2xl p-3 space-y-2.5">
              {/* Filter inside dropdown */}
              {combinedPeopleList.length > 4 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter previous walkers..."
                    className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-slateDark-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
                  />
                </div>
              )}

              {/* Checkboxes List of All Previous People Who Have Walked */}
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {filteredPeople.length === 0 ? (
                  <p className="text-xs text-slate-400 py-2 text-center">
                    No matching walkers found — add a new person on the right!
                  </p>
                ) : (
                  filteredPeople.map((person) => {
                    const checked = isPersonSelected(person);
                    return (
                      <button
                        key={person}
                        type="button"
                        onClick={() => handleTogglePerson(person)}
                        className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-between gap-2 transition ${
                          checked
                            ? 'bg-phoenix-600/25 border border-phoenix-500/50 text-white'
                            : 'bg-slateDark-950 hover:bg-slate-800 text-slate-300 border border-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className={`w-4 h-4 rounded flex items-center justify-center border ${
                              checked
                                ? 'bg-phoenix-500 border-phoenix-400 text-white'
                                : 'bg-slate-900 border-slate-600 text-transparent'
                            }`}
                          >
                            <Check className="w-3 h-3 stroke-[3]" />
                          </span>
                          <span>{person}</span>
                        </div>
                        {checked && (
                          <span className="text-[10px] text-phoenix-300 font-extrabold">
                            Selected
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>

              {/* Done Button */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800">
                <span className="text-[11px] text-slate-400">
                  Click multiple names to select/deselect
                </span>
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(false)}
                  className="px-3 py-1 rounded-lg bg-phoenix-600 hover:bg-phoenix-500 text-white text-xs font-extrabold"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Add New Person Input + Button */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newPersonName}
            onChange={(e) => setNewPersonName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddNewPersonSubmit();
              }
            }}
            placeholder="Add a new person's name..."
            className="flex-1 px-3 py-2.5 rounded-xl bg-slateDark-900 border border-slate-700 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-phoenix-500"
          />
          <button
            type="button"
            onClick={handleAddNewPersonSubmit}
            className="px-3.5 py-2.5 rounded-xl bg-gradient-to-r from-phoenix-500 to-phoenix-600 hover:from-phoenix-600 hover:to-phoenix-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 shrink-0 shadow"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Person</span>
          </button>
        </div>
      </div>
    </div>
  );
};
