
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { FormData, FormErrors, BookedSlots, TimeSlot, CalendarDay, Database } from './types';
import { TIME_SLOTS, MONTH_NAMES, DAY_NAMES_SHORT, COLLEGE_LIST } from './constants';

const formatDateKey = (date: Date): string => {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const day = date.getDate().toString().padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// --- SUPABASE CLIENT & API ---
let supabase: SupabaseClient<Database> | null = null;
let supabaseError: string | null = null;

try {
  const supabaseUrl = 'https://eirngbytscbxrjyqxgsz.supabase.co';
  const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVpcm5nYnl0c2NieHJqeXF4Z3N6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxMTE2MjksImV4cCI6MjA2OTY4NzYyOX0.LR_L2UscKjTmlTJROP3jC9nadCvxL35l6PRLH2_sKLs';
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase URL or anonymous key is missing. Cannot connect to the database.");
  }
  supabase = createClient<Database>(supabaseUrl, supabaseAnonKey);
} catch (e) {
  supabaseError = (e as Error).message;
  console.error(e);
}

const api = {
  /**
   * Fetches booked slots for a given month from the Supabase 'bookings' table.
   * @param date The date indicating the month and year to fetch.
   */
  fetchBookedSlotsForMonth: async (date: Date): Promise<BookedSlots> => {
    if (!supabase) return {};

    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDayKey = formatDateKey(new Date(year, month, 1));
    const lastDayKey = formatDateKey(new Date(year, month + 1, 0));

    console.log(`Fetching bookings for ${firstDayKey} to ${lastDayKey}...`);

    const { data, error } = await supabase
      .from('bookings')
      .select('date, slot_id')
      .gte('date', firstDayKey)
      .lte('date', lastDayKey);

    if (error) {
      console.error("Error fetching bookings:", error);
      // It might be beneficial to show an error to the user here
      return {};
    }

    const newBookedSlots: BookedSlots = {};
    for (const booking of data) {
      if (!newBookedSlots[booking.date]) {
        newBookedSlots[booking.date] = [];
      }
      newBookedSlots[booking.date].push(booking.slot_id);
    }
    return newBookedSlots;
  },

  /**
   * Submits a new booking to the Supabase 'bookings' table.
   * @param bookingDetails The details of the new booking.
   */
  createBooking: async (bookingDetails: { date: Date, slotId: string, user: FormData }): Promise<{ success: boolean, error?: string }> => {
     if (!supabase) return { success: false, error: 'Database connection not available.' };
    
    console.log('Saving booking to Supabase:', bookingDetails);
    
    const { date, slotId, user } = bookingDetails;
    const dateKey = formatDateKey(date);
    
    const { error } = await supabase.from('bookings').insert({
        date: dateKey,
        slot_id: slotId,
        name: user.name,
        email: user.email,
        contact_number: user.contactNumber,
        college: user.college
    });

    if (error) {
        console.error("Error creating booking:", error);
        if (error.code === '23505') { // Unique constraint violation
            return { success: false, error: "This time slot has just been booked by someone else. Please select another slot." };
        }
        return { success: false, error: "Could not save your booking. Please try again." };
    }

    return { success: true };
  }
};
// --- END SUPABASE API ---

const generateCalendarDays = (date: Date): CalendarDay[] => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const firstDayOfWeek = firstDayOfMonth.getDay();
  const daysInMonth = lastDayOfMonth.getDate();

  const days: CalendarDay[] = [];

  for (let i = 0; i < firstDayOfWeek; i++) {
    const prevMonthDay = new Date(year, month, i - firstDayOfWeek + 1);
    const dayOfWeek = prevMonthDay.getDay();
    days.push({
      date: prevMonthDay,
      isCurrentMonth: false,
      isToday: false,
      isPast: prevMonthDay < today,
      isWeekend: dayOfWeek === 0,
    });
  }

  for (let i = 1; i <= daysInMonth; i++) {
    const currentDate = new Date(year, month, i);
    const dayOfWeek = currentDate.getDay();
    days.push({
      date: currentDate,
      isCurrentMonth: true,
      isToday: formatDateKey(currentDate) === formatDateKey(today),
      isPast: currentDate < today,
      isWeekend: dayOfWeek === 0,
    });
  }
  
  const remainingCells = 42 - days.length;
  for (let i = 1; i <= remainingCells; i++) {
    const nextMonthDay = new Date(year, month + 1, i);
    const dayOfWeek = nextMonthDay.getDay();
     days.push({
       date: nextMonthDay,
       isCurrentMonth: false,
       isToday: false,
       isPast: nextMonthDay < today,
       isWeekend: dayOfWeek === 0,
     });
  }

  return days;
};

interface CalendarProps {
  currentMonthDate: Date;
  selectedDate: Date | null;
  bookedSlots: BookedSlots;
  isLoading: boolean;
  onDateSelect: (date: Date) => void;
  onMonthChange: (direction: 'next' | 'previous') => void;
}

const Calendar: React.FC<CalendarProps> = ({ currentMonthDate, selectedDate, bookedSlots, isLoading, onDateSelect, onMonthChange }) => {
  const calendarDays = useMemo(() => generateCalendarDays(currentMonthDate), [currentMonthDate]);
  
  const isDateFullyBooked = useCallback((date: Date) => {
    const dateKey = formatDateKey(date);
    const slots = bookedSlots[dateKey] || [];
    return slots.length >= TIME_SLOTS.length;
  }, [bookedSlots]);

  return (
    <div className="bg-white p-4 sm:p-6 rounded-2xl shadow-lg relative">
        {isLoading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center z-10 rounded-2xl">
                 <svg className="animate-spin h-8 w-8 text-sky-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
            </div>
        )}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-slate-800">
          {MONTH_NAMES[currentMonthDate.getMonth()]} {currentMonthDate.getFullYear()}
        </h2>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => onMonthChange('previous')}
            disabled={isLoading}
            className="p-2 rounded-full text-slate-600 hover:bg-sky-100 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 transition-colors disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            aria-label="Previous month"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button
            onClick={() => onMonthChange('next')}
            disabled={isLoading}
            className="p-2 rounded-full text-slate-600 hover:bg-sky-100 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2 transition-colors disabled:text-slate-300 disabled:hover:bg-transparent disabled:cursor-not-allowed"
            aria-label="Next month"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center">
        {DAY_NAMES_SHORT.map(day => (
          <div key={day} className="text-xs font-semibold text-slate-500 uppercase tracking-wider py-2">{day}</div>
        ))}
        {calendarDays.map((day, index) => {
          const isFullyBooked = isDateFullyBooked(day.date);
          const isViewOnly = (day.isPast && !day.isToday) || isFullyBooked;
          const isDisabled = !day.isCurrentMonth || day.isWeekend;
          const isSelected = selectedDate && formatDateKey(day.date) === formatDateKey(selectedDate);
          
          let baseClasses = "w-full aspect-square flex items-center justify-center rounded-full text-sm transition-all duration-200";
          let stateClasses = "";

          if (isDisabled) {
            stateClasses = !day.isCurrentMonth
                ? "text-slate-300 cursor-not-allowed"
                : "text-slate-400 bg-slate-200 cursor-not-allowed line-through";
          } else {
            if (isSelected) {
              stateClasses = "bg-sky-500 text-white font-bold shadow-md ring-2 ring-sky-300 cursor-pointer";
            } else if (isViewOnly) {
              stateClasses = "text-slate-500 bg-slate-100 hover:bg-slate-200 cursor-pointer";
            } else { // Bookable
              stateClasses = "text-slate-700 hover:bg-sky-100 cursor-pointer";
              if(day.isToday) {
                  stateClasses += " border-2 border-sky-400";
              }
            }
          }

          return (
            <div key={index} className="p-1">
              <button
                disabled={isDisabled}
                onClick={() => onDateSelect(day.date)}
                className={`${baseClasses} ${stateClasses}`}
                aria-label={isDisabled ? `Date disabled` : isViewOnly ? `View bookings for ${day.date.toDateString()}` : `Select date ${day.date.toDateString()}`}
              >
                {day.date.getDate()}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};


interface RightPanelProps {
    selectedDate: Date | null;
    selectedSlot: string | null;
    bookedSlots: BookedSlots;
    formData: FormData;
    formErrors: FormErrors;
    termsAccepted: boolean;
    isSubmitting: boolean;
    onSlotSelect: (slotId: string) => void;
    onFormChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => void;
    onTermsChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onSubmit: (e: React.FormEvent) => void;
}

const RightPanel: React.FC<RightPanelProps> = ({ selectedDate, selectedSlot, bookedSlots, formData, formErrors, termsAccepted, isSubmitting, onSlotSelect, onFormChange, onTermsChange, onSubmit }) => {
    const isFormValid = useMemo(() => {
        return formData.name && formData.email && formData.contactNumber && formData.college && Object.keys(formErrors).length === 0 && termsAccepted;
    }, [formData, formErrors, termsAccepted]);

    const slotsForSelectedDate = selectedDate ? bookedSlots[formatDateKey(selectedDate)] || [] : [];
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const isDateInPast = selectedDate ? selectedDate < today : false;
    const isDateFullyBooked = slotsForSelectedDate.length >= TIME_SLOTS.length;
    const isDateSunday = selectedDate ? selectedDate.getDay() === 0 : false;
    
    const isBookingAllowed = selectedDate && !isDateInPast && !isDateFullyBooked && !isDateSunday;

    let viewOnlyMessage = '';
    if (selectedDate) {
        if (isDateInPast) viewOnlyMessage = 'This date is in the past and cannot be booked.';
        else if (isDateFullyBooked) viewOnlyMessage = 'This date is fully booked.';
        else if (isDateSunday) viewOnlyMessage = 'Bookings are not available on Sundays.';
    }

    return (
        <div className="bg-white p-4 sm:p-8 rounded-2xl shadow-lg h-full flex flex-col">
            {!selectedDate ? (
                <div className="flex-grow flex flex-col items-center justify-center text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-sky-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                    <h3 className="text-xl font-semibold text-slate-700">Select a Date</h3>
                    <p className="text-slate-500 mt-1">Choose an available day from the calendar to see time slots.</p>
                </div>
            ) : (
                <div className="flex-grow flex flex-col">
                    <div>
                        <h3 className="text-lg font-bold text-slate-800 mb-1">Slots for:</h3>
                        <p className="text-sky-600 font-semibold mb-4">{selectedDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                    </div>

                    {isBookingAllowed ? (
                        <>
                            <div className="space-y-3">
                                {TIME_SLOTS.map(slot => {
                                    const isBooked = slotsForSelectedDate.includes(slot.id);
                                    const isSelected = selectedSlot === slot.id;
                                    
                                    return (
                                        <button
                                            key={slot.id}
                                            disabled={isBooked}
                                            onClick={() => onSlotSelect(slot.id)}
                                            className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                                                isBooked ? 'bg-slate-200 text-slate-500 cursor-not-allowed line-through' : 
                                                isSelected ? 'bg-sky-500 border-sky-500 text-white shadow-md' : 
                                                'bg-white border-slate-300 text-slate-700 hover:border-sky-400 hover:shadow-sm'
                                            }`}
                                        >
                                            <span className="font-semibold">{slot.label}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="border-t border-slate-200 mt-6 pt-6 flex-grow flex flex-col">
                                {selectedSlot ? (
                                    <div className="animate-fade-in mb-4 p-3 bg-sky-100 rounded-lg border border-sky-200">
                                        <p className="text-sm text-slate-800 font-medium">You have selected the time slot:</p>
                                        <p className="text-center font-bold text-sky-600 text-lg">
                                            {TIME_SLOTS.find(s => s.id === selectedSlot)?.label}
                                        </p>
                                    </div>
                                ) : (
                                   <div className="mb-4 p-3 bg-slate-100 rounded-lg border border-slate-200 text-center">
                                         <p className="text-sm text-slate-600 font-medium">Please select a time slot above to continue.</p>
                                    </div>
                                )}
                                <form onSubmit={onSubmit} className="space-y-4">
                                    <div>
                                        <label htmlFor="name" className="block text-sm font-medium text-slate-700">Full Name</label>
                                        <input type="text" name="name" id="name" value={formData.name} onChange={onFormChange} required className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm" />
                                    </div>
                                    <div>
                                        <label htmlFor="email" className="block text-sm font-medium text-slate-700">Email Address</label>
                                        <input type="email" name="email" id="email" value={formData.email} onChange={onFormChange} required className={`mt-1 block w-full px-3 py-2 bg-white border rounded-md shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm ${formErrors.email ? 'border-red-500' : 'border-slate-300'}`} />
                                        {formErrors.email && <p className="mt-1 text-xs text-red-600">{formErrors.email}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="contactNumber" className="block text-sm font-medium text-slate-700">Contact Number</label>
                                        <input type="tel" name="contactNumber" id="contactNumber" value={formData.contactNumber} onChange={onFormChange} required className={`mt-1 block w-full px-3 py-2 bg-white border rounded-md shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm ${formErrors.contactNumber ? 'border-red-500' : 'border-slate-300'}`} />
                                        {formErrors.contactNumber && <p className="mt-1 text-xs text-red-600">{formErrors.contactNumber}</p>}
                                    </div>
                                    <div>
                                        <label htmlFor="college" className="block text-sm font-medium text-slate-700">College</label>
                                        <select
                                            name="college"
                                            id="college"
                                            value={formData.college}
                                            onChange={onFormChange}
                                            required
                                            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-sky-500 focus:border-sky-500 sm:text-sm"
                                        >
                                            <option value="" disabled>Select your college</option>
                                            {COLLEGE_LIST.map(college => (
                                                <option key={college} value={college}>{college}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="flex items-start">
                                        <div className="flex items-center h-5">
                                            <input id="terms" name="terms" type="checkbox" checked={termsAccepted} onChange={onTermsChange} className="focus:ring-sky-500 h-4 w-4 text-sky-600 border-slate-300 rounded" />
                                        </div>
                                        <div className="ml-3 text-sm">
                                            <label htmlFor="terms" className="text-slate-600">I agree to the <a href="#" className="font-medium text-sky-600 hover:text-sky-500">terms and conditions</a> for equipment handling and safety protocols.</label>
                                        </div>
                                    </div>
                                    <button type="submit" disabled={!isFormValid || !selectedSlot || isSubmitting} className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500 disabled:bg-slate-400 disabled:cursor-not-allowed disabled:shadow-none">
                                        {isSubmitting ? (
                                            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                            </svg>
                                        ) : 'Confirm Booking'}
                                    </button>
                                </form>
                            </div>
                        </>
                    ) : (
                        <div className="flex-grow flex flex-col">
                            <div className="mb-4 p-3 bg-yellow-100 rounded-lg border border-yellow-200 text-center">
                                <p className="text-sm text-yellow-800 font-medium">{viewOnlyMessage}</p>
                            </div>
                            <h4 className="font-semibold text-slate-700 mb-3">Booked Slots:</h4>
                            <div className="space-y-2">
                                {slotsForSelectedDate.length > 0 ? (
                                    TIME_SLOTS
                                        .filter(slot => slotsForSelectedDate.includes(slot.id))
                                        .map(slot => (
                                            <div key={slot.id} className="w-full text-left p-3 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 flex justify-between items-center">
                                                <span className="font-semibold">{slot.label}</span>
                                                <span className="text-xs ml-2 py-0.5 px-1.5 bg-slate-300 text-slate-700 rounded font-medium">Booked</span>
                                            </div>
                                        ))
                                ) : (
                                    <p className="text-slate-500 italic">No slots were booked on this day.</p>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

interface ConfirmationProps {
  onReset: () => void;
  details: {name: string, date: string, slot: string};
}

const ConfirmationScreen: React.FC<ConfirmationProps> = ({ onReset, details }) => {
    const slotLabel = TIME_SLOTS.find(s => s.id === details.slot)?.label || '';
    return (
        <div className="bg-white p-8 rounded-2xl shadow-lg flex flex-col items-center justify-center text-center h-full">
            <div className="bg-green-100 rounded-full p-4 mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">Booking Confirmed!</h2>
            <p className="text-slate-600 mb-6 max-w-sm">
                Thank you, <span className="font-semibold text-sky-600">{details.name}</span>. Your drone booking for <span className="font-semibold">{details.date}</span> at <span className="font-semibold">{slotLabel}</span> is confirmed. A calendar invite will be sent to your email.
            </p>
            <button onClick={onReset} className="w-full max-w-xs py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-sky-600 hover:bg-sky-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-sky-500">
                Make Another Booking
            </button>
        </div>
    );
};

function App() {
  const [currentMonthDate, setCurrentMonthDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: '', email: '', contactNumber: '', college: '' });
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingConfirmed, setBookingConfirmed] = useState(false);
  const [confirmationDetails, setConfirmationDetails] = useState({name: '', date: '', slot: ''});
  const [bookedSlots, setBookedSlots] = useState<BookedSlots>({});
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (supabaseError) {
      setIsLoading(false);
      return;
    }
    const fetchSlots = async () => {
        setIsLoading(true);
        setSelectedDate(null);
        setSelectedSlot(null);
        const data = await api.fetchBookedSlotsForMonth(currentMonthDate);
        setBookedSlots(data);
        setIsLoading(false);
    }
    fetchSlots();
  }, [currentMonthDate]);

  useEffect(() => {
    const errors: FormErrors = {};
    if (formData.email && !/@jkkn\.ac\.in$/.test(formData.email)) {
      errors.email = "Email must end with @jkkn.ac.in";
    }
    if (formData.contactNumber && !/^\d{10}$/.test(formData.contactNumber)) {
      errors.contactNumber = "Must be a 10-digit number.";
    }
    setFormErrors(errors);
  }, [formData]);

  const handleMonthChange = (direction: 'next' | 'previous') => {
    setCurrentMonthDate(prev => {
      const newMonth = new Date(prev.getFullYear(), prev.getMonth() + (direction === 'next' ? 1 : -1), 1);
      return newMonth;
    });
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedSlot(null);
  };

  const handleSlotSelect = (slotId: string) => {
    setSelectedSlot(slotId);
  };
  
  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };
  
  const handleTermsChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTermsAccepted(e.target.checked);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (Object.keys(formErrors).length > 0 || !termsAccepted || !selectedDate || !selectedSlot) return;

    setIsSubmitting(true);
    
    const response = await api.createBooking({
        date: selectedDate,
        slotId: selectedSlot,
        user: formData,
    });
    
    setIsSubmitting(false);

    if (response.success) {
      // Optimistically update the UI before re-fetching
      const dateKey = formatDateKey(selectedDate);
      setBookedSlots(prev => ({
        ...prev,
        [dateKey]: [...(prev[dateKey] || []), selectedSlot].sort()
      }));
      setConfirmationDetails({
          name: formData.name,
          date: selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }),
          slot: selectedSlot
      });
      setBookingConfirmed(true);
    } else {
        alert(response.error || "Booking failed. Please try again.");
    }
  };

  const resetBooking = () => {
    setBookingConfirmed(false);
    setSelectedDate(null);
    setSelectedSlot(null);
    setFormData({ name: '', email: '', contactNumber: '', college: '' });
    setTermsAccepted(false);
    setConfirmationDetails({name: '', date: '', slot: ''});
  };

  if (supabaseError) {
    return (
      <div className="min-h-screen bg-slate-100 flex flex-col items-center justify-center p-4">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-6 rounded-lg shadow-lg max-w-2xl text-center">
          <h2 className="font-bold text-xl mb-2">Application Configuration Error</h2>
          <p>The application could not connect to the database. Please ensure it is configured correctly.</p>
          <p className="mt-3 text-sm font-mono bg-red-50 p-2 rounded">{supabaseError}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <header className="w-full max-w-7xl mx-auto mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-extrabold text-green-800 tracking-tight">JKKN Drone Booking Portal</h1>
        <p className="mt-2 text-lg text-slate-600">Reserve a drone for your media production projects.</p>
      </header>
      <main className="w-full max-w-7xl mx-auto flex-grow">
        {bookingConfirmed ? (
            <ConfirmationScreen onReset={resetBooking} details={confirmationDetails} />
        ) : (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
              <div className="lg:col-span-3">
                <Calendar 
                  currentMonthDate={currentMonthDate}
                  selectedDate={selectedDate}
                  bookedSlots={bookedSlots}
                  isLoading={isLoading}
                  onDateSelect={handleDateSelect}
                  onMonthChange={handleMonthChange}
                />
              </div>
              <div className="lg:col-span-2">
                 <RightPanel
                    selectedDate={selectedDate}
                    selectedSlot={selectedSlot}
                    bookedSlots={bookedSlots}
                    formData={formData}
                    formErrors={formErrors}
                    termsAccepted={termsAccepted}
                    isSubmitting={isSubmitting}
                    onSlotSelect={handleSlotSelect}
                    onFormChange={handleFormChange}
                    onTermsChange={handleTermsChange}
                    onSubmit={handleSubmit}
                 />
              </div>
            </div>
        )}
      </main>
    </div>
  );
}

export default App;
