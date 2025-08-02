
export interface FormData {
  name: string;
  email: string;
  contactNumber: string;
}

export interface FormErrors {
  email?: string;
  contactNumber?: string;
}

export interface TimeSlot {
  id: string;
  label: string;
}

export interface BookedSlots {
  [key: string]: string[];
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isPast: boolean;
  isWeekend: boolean;
}
