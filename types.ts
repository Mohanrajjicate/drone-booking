
export interface FormData {
  name: string;
  email: string;
  contactNumber: string;
  college: string;
  eventName: string;
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

// Type for data sent to the Edge Function
export interface BookingDetails {
    name: string;
    email: string;
    date: string; // ISO string
    slotId: string;
    slotLabel: string;
    college: string;
    eventName: string;
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
          event_name: string;
        };
        Insert: {
          date: string;
          slot_id: string;
          name: string;
          email: string;
          contact_number: string;
          college: string;
          event_name: string;
        };
        Update: {
          date?: string;
          slot_id?: string;
          name?: string;
          email?: string;
          contact_number?: string;
          college?: string;
          event_name?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
  };
}