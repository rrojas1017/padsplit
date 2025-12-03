import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Booking } from '@/types';
import { mockBookings as initialMockBookings } from '@/data/mockData';

interface BookingsContextType {
  bookings: Booking[];
  addBooking: (booking: Omit<Booking, 'id'>) => void;
  updateBooking: (id: string, booking: Partial<Booking>) => void;
  deleteBooking: (id: string) => void;
  refreshBookings: () => void;
}

const BookingsContext = createContext<BookingsContextType | undefined>(undefined);

const STORAGE_KEY = 'padsplit-bookings';

function serializeBookings(bookings: Booking[]): string {
  return JSON.stringify(bookings.map(b => ({
    ...b,
    bookingDate: b.bookingDate.toISOString(),
    moveInDate: b.moveInDate.toISOString(),
  })));
}

function deserializeBookings(data: string): Booking[] {
  const parsed = JSON.parse(data);
  return parsed.map((b: any) => ({
    ...b,
    bookingDate: new Date(b.bookingDate),
    moveInDate: new Date(b.moveInDate),
  }));
}

export function BookingsProvider({ children }: { children: ReactNode }) {
  const [bookings, setBookings] = useState<Booking[]>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        return deserializeBookings(stored);
      } catch {
        return initialMockBookings;
      }
    }
    return initialMockBookings;
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, serializeBookings(bookings));
  }, [bookings]);

  const addBooking = (booking: Omit<Booking, 'id'>) => {
    const newBooking: Booking = {
      ...booking,
      id: `booking-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setBookings(prev => [newBooking, ...prev].sort((a, b) => b.bookingDate.getTime() - a.bookingDate.getTime()));
  };

  const updateBooking = (id: string, updates: Partial<Booking>) => {
    setBookings(prev => prev.map(b => b.id === id ? { ...b, ...updates } : b));
  };

  const deleteBooking = (id: string) => {
    setBookings(prev => prev.filter(b => b.id !== id));
  };

  const refreshBookings = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        setBookings(deserializeBookings(stored));
      } catch {
        // Keep current bookings if parse fails
      }
    }
  };

  return (
    <BookingsContext.Provider value={{ bookings, addBooking, updateBooking, deleteBooking, refreshBookings }}>
      {children}
    </BookingsContext.Provider>
  );
}

export function useBookings() {
  const context = useContext(BookingsContext);
  if (!context) {
    throw new Error('useBookings must be used within a BookingsProvider');
  }
  return context;
}
