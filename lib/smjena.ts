export type ShiftStatus = 'open' | 'claimed' | 'in_progress' | 'completed' | 'cancelled';
export type ShiftAudience = 'crew' | 'public';

export type Shift = {
  id: string;
  role: string;
  employer: string;
  area: string;
  city: string;
  distance: string;
  dayLabel: string;
  start: string;
  end: string;
  startsIn: string;
  startsAt?: string;
  pay: number;
  basePay: number;
  bonus: number;
  tips: boolean;
  workersNeeded: number;
  claimedCount: number;
  claimedWorkers: string[];
  urgent: boolean;
  audience: ShiftAudience;
  notifiedCount: number;
  viewers: number;
  employerRating: number | null;
  employerRatingCount: number;
  employerVerified: boolean;
  status: ShiftStatus;
  requirements: string[];
  fillTime?: string;
  template?: boolean;
  replacementActive?: boolean;
  assignments?: Array<{ id: string; workerId: string; workerName: string; status: string }>;
};

export type WorkerProfile = {
  id: string;
  name: string;
  initials: string;
  verified: boolean;
  score: number;
  rating: number | null;
  ratingCount: number;
  completedShifts: number;
  attendance: number | null;
  earningsWeek: number;
  paidWeek: number;
  pendingWeek: number;
  available: boolean;
  notificationsEnabled: boolean;
  skills: string[];
  crewEmployers: string[];
};

export type EmployerProfile = {
  id: string;
  name: string;
  city: string;
  verified: boolean;
  rating: number | null;
  ratingCount: number;
  crewCount: number;
  completedShifts: number;
  ledgerPending: number;
  ledgerPaid: number;
  crewWorkers: Array<{ id: string; name: string; score: number; role: string }>;
  fillMedianMinutes: number | null;
  attendancePercent: number | null;
  repeatRate: number | null;
  fillRate: number | null;
  cancellationRate: number | null;
};

export type SmjenaState = {
  shifts: Shift[];
  worker: WorkerProfile;
  employer: EmployerProfile;
  activeShiftId: string | null;
};

export type NewShiftInput = {
  role: string;
  workersNeeded: number;
  date: string;
  start: string;
  end: string;
  pay: number;
  area: string;
  requirements: string[];
  urgent: boolean;
  crewFirst: boolean;
};

export const roles = [
  'Konobar/ica',
  'Barmen/ica',
  'Pomoćni kuhar/ica',
  'Pomoćni radnik/ca u kuhinji',
  'Čistač/ica',
  'Sobar/ica',
];

export function openShifts(state: SmjenaState) {
  return state.shifts.filter((shift) => shift.status === 'open');
}

export function employerShifts(state: SmjenaState) {
  return state.shifts.filter((shift) => shift.employer === state.employer.name);
}

export function remainingSpots(shift: Shift) {
  return Math.max(shift.workersNeeded - shift.claimedCount, 0);
}

export function completionPercent(shift: Shift) {
  if (shift.workersNeeded <= 0) return 0;
  return Math.min((shift.claimedCount / shift.workersNeeded) * 100, 100);
}

export function parseRequirements(value: string) {
  return [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))].slice(0, 8);
}
