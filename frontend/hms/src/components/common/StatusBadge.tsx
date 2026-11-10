import React from 'react';
import { Badge } from '../ui/Badge';
import { RoomOperationalStatus, RoomHousekeepingStatus, ReservationStatus, StayStatus } from '../../types/pms';

interface StatusBadgeProps {
  type: 'room_occupancy' | 'room_housekeeping' | 'reservation' | 'stay' | 'payment' | 'table';
  value: string;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ type, value, size = 'sm' }) => {
  // 1. Room Occupancy
  if (type === 'room_occupancy') {
    const val = value as RoomOperationalStatus;
    switch (val) {
      case 'VACANT':
        return <Badge variant="success" size={size}>Vacant</Badge>;
      case 'OCCUPIED':
        return <Badge variant="destructive" size={size}>Occupied</Badge>;
      case 'OUT_OF_ORDER':
        return <Badge variant="default" size={size} className="bg-slate-800 text-white">OOO</Badge>;
      case 'OUT_OF_SERVICE':
        return <Badge variant="warning" size={size}>OOS</Badge>;
      default:
        return <Badge size={size}>{value}</Badge>;
    }
  }

  // 2. Room Housekeeping
  if (type === 'room_housekeeping') {
    const val = value as RoomHousekeepingStatus;
    switch (val) {
      case 'CLEAN':
        return <Badge variant="info" size={size}>Clean</Badge>;
      case 'DIRTY':
        return <Badge variant="warning" size={size}>Dirty</Badge>;
      case 'CLEANING':
        return <Badge variant="purple" size={size}>Cleaning</Badge>;
      case 'INSPECTED':
        return <Badge variant="success" size={size}>Inspected</Badge>;
      case 'TOUCH_UP':
        return <Badge variant="default" size={size}>Touch Up</Badge>;
      default:
        return <Badge size={size}>{value}</Badge>;
    }
  }

  // 3. Commercial Reservation Status
  if (type === 'reservation') {
    const val = value as ReservationStatus;
    switch (val) {
      case 'CONFIRMED':
        return <Badge variant="success" size={size}>Confirmed</Badge>;
      case 'PENDING':
        return <Badge variant="warning" size={size}>Pending</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive" size={size}>Cancelled</Badge>;
      case 'NO_SHOW':
        return <Badge variant="default" size={size}>No-Show</Badge>;
      case 'COMPLETED':
        return <Badge variant="default" size={size} className="bg-slate-200 text-slate-800">Completed</Badge>;
      default:
        return <Badge size={size}>{value}</Badge>;
    }
  }

  // 4. Operational Stay Status
  if (type === 'stay') {
    const val = value as StayStatus;
    switch (val) {
      case 'SCHEDULED':
        return <Badge variant="info" size={size}>Scheduled</Badge>;
      case 'CHECKED_IN':
        return <Badge variant="success" size={size} className="bg-emerald-600 text-white">In-House</Badge>;
      case 'CHECKED_OUT':
        return <Badge variant="default" size={size}>Departed</Badge>;
      default:
        return <Badge size={size}>{value}</Badge>;
    }
  }

  // 5. Payment Status
  if (type === 'payment') {
    switch (value) {
      case 'PAID':
      case 'SUCCESS':
        return <Badge variant="success" size={size}>Paid</Badge>;
      case 'PARTIALLY_PAID':
        return <Badge variant="warning" size={size}>Partially Paid</Badge>;
      case 'UNPAID':
      case 'PENDING':
        return <Badge variant="destructive" size={size}>Unpaid</Badge>;
      case 'REFUNDED':
        return <Badge variant="purple" size={size}>Refunded</Badge>;
      default:
        return <Badge size={size}>{value}</Badge>;
    }
  }

  // 6. POS Table Status
  if (type === 'table') {
    switch (value) {
      case 'AVAILABLE':
        return <Badge variant="success" size={size}>Available</Badge>;
      case 'SEATED':
        return <Badge variant="info" size={size}>Seated</Badge>;
      case 'ORDERED':
        return <Badge variant="warning" size={size}>Ordered</Badge>;
      case 'BILLED':
        return <Badge variant="destructive" size={size}>Billed</Badge>;
      default:
        return <Badge size={size}>{value}</Badge>;
    }
  }

  return <Badge size={size}>{value}</Badge>;
};
