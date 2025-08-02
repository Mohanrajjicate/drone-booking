
export interface FormData {
  name: string;
  email: string;
  contactNumber: string;
  college: string;
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

export interface Database {
  public: {
    Tables: {
      bookings: {
        Row: {
          id: number;
          created_at: string;
          date: string;
          slot_id: string;
          name: string;
          email: string;
          contact_number: string;
          college: string;
        };
        Insert: {
          date: string;
          slot_id: string;
          name: string;
          email: string;
          contact_number: string;
          college: string;
        };
        Update: {
          date?: string;
          slot_id?: string;
          name?: string;
          email?: string;
          contact_number?: string;
          college?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}
