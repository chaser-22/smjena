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
  endsAt?: string;
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
  assignmentStatus?: string;
  cancellationReason?: string;
  paymentStatus?: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
  assignments?: Array<{
    id: string;
    workerId: string;
    workerName: string;
    status: string;
    pay: number;
    paymentStatus?: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
  }>;
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
  scoreKnown: boolean;
  attendance: number | null;
  earningsWeek: number;
  paidWeek: number;
  pendingWeek: number;
  authorizedWeek: number;
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
  ledgerAwaiting: number;
  ledgerAuthorized: number;
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
  requestId: string;
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

export function isCheckInAvailable(shift: Pick<Shift, 'startsAt' | 'endsAt'>, now = new Date()) {
  if (!shift.startsAt || !shift.endsAt) return false;
  const startsAt = new Date(shift.startsAt).getTime();
  const endsAt = new Date(shift.endsAt).getTime();
  return now.getTime() >= startsAt - 60 * 60 * 1000 && now.getTime() <= endsAt;
}

export function isCheckOutAvailable(shift: Pick<Shift, 'endsAt'>, now = new Date()) {
  if (!shift.endsAt) return false;
  return now.getTime() >= new Date(shift.endsAt).getTime() - 30 * 60 * 1000;
}

export function cancellationScorePenalty(shift: Pick<Shift, 'startsAt'>, now = new Date()) {
  if (!shift.startsAt) return 5;
  return new Date(shift.startsAt).getTime() - now.getTime() < 24 * 60 * 60 * 1000 ? 5 : 1;
}

export function shiftsOverlap(
  left: Pick<Shift, 'startsAt' | 'endsAt'>,
  right: Pick<Shift, 'startsAt' | 'endsAt'>,
) {
  if (!left.startsAt || !left.endsAt || !right.startsAt || !right.endsAt) return false;
  return new Date(left.startsAt) < new Date(right.endsAt)
    && new Date(right.startsAt) < new Date(left.endsAt);
}
