export type ShiftStatus =
  | 'open'
  | 'claimed'
  | 'in_progress'
  | 'completed'
  | 'cancelled';

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
  pay: number;
  basePay: number;
  bonus: number;
  tips: boolean;
  workersNeeded: number;
  claimedWorkers: string[];
  urgent: boolean;
  audience: ShiftAudience;
  notifiedCount: number;
  viewers: number;
  employerRating: number;
  status: ShiftStatus;
  requirements: string[];
  fillTime?: string;
  template?: boolean;
  replacementActive?: boolean;
};

export type WorkerProfile = {
  id: string;
  name: string;
  initials: string;
  score: number;
  rating: number;
  completedShifts: number;
  attendance: number;
  earningsWeek: number;
  previousWeek: number;
  available: boolean;
  notificationsEnabled: boolean;
  premiumUnlocked: boolean;
  skills: string[];
  crewEmployers: string[];
};

export type EmployerProfile = {
  id: string;
  name: string;
  city: string;
  rating: number;
  crewCount: number;
  completedShifts: number;
};

export type CompletionReward = {
  shiftId: string;
  amount: number;
  oldScore: number;
  newScore: number;
  rating: number;
  unlocked: boolean;
};

export type SmjenaState = {
  shifts: Shift[];
  worker: WorkerProfile;
  employer: EmployerProfile;
  activeShiftId: string | null;
  lastReward: CompletionReward | null;
};

export type NewShiftInput = {
  role: string;
  workersNeeded: number;
  start: string;
  end: string;
  pay: number;
  area: string;
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

export const seedShifts: Shift[] = [
  {
    id: 'shift-sos-budva',
    role: 'Konobar/ica',
    employer: 'Porto Budva',
    area: 'Stari grad, Budva',
    city: 'Budva',
    distance: '900 m',
    dayLabel: 'Danas',
    start: '18:00',
    end: '00:00',
    startsIn: '3h 18m',
    pay: 84,
    basePay: 69,
    bonus: 15,
    tips: true,
    workersNeeded: 2,
    claimedWorkers: ['Mila V.'],
    urgent: true,
    audience: 'public',
    notifiedCount: 47,
    viewers: 14,
    employerRating: 4.9,
    status: 'open',
    requirements: ['Konobarsko iskustvo', 'Engleski B1'],
  },
  {
    id: 'shift-barmen-tivat',
    role: 'Barmen/ica',
    employer: 'The Spot Tivat',
    area: 'Porto Montenegro, Tivat',
    city: 'Tivat',
    distance: '18 km',
    dayLabel: 'Sutra',
    start: '19:00',
    end: '01:00',
    startsIn: '1d 4h',
    pay: 78,
    basePay: 78,
    bonus: 0,
    tips: true,
    workersNeeded: 2,
    claimedWorkers: [],
    urgent: false,
    audience: 'public',
    notifiedCount: 31,
    viewers: 8,
    employerRating: 4.8,
    status: 'open',
    requirements: ['Barmen verifikovan'],
  },
  {
    id: 'shift-kuhinja-podgorica',
    role: 'Pomoćni kuhar/ica',
    employer: 'Bokeška kužina',
    area: 'Centar, Podgorica',
    city: 'Podgorica',
    distance: '2,4 km',
    dayLabel: 'Subota',
    start: '10:00',
    end: '17:00',
    startsIn: '3d 19h',
    pay: 77,
    basePay: 77,
    bonus: 0,
    tips: false,
    workersNeeded: 1,
    claimedWorkers: [],
    urgent: false,
    audience: 'crew',
    notifiedCount: 12,
    viewers: 5,
    employerRating: 4.9,
    status: 'open',
    requirements: ['Osnove rada u kuhinji'],
  },
  {
    id: 'shift-completed',
    role: 'Pomoćni kuhar/ica',
    employer: 'Porto Budva',
    area: 'Stari grad, Budva',
    city: 'Budva',
    distance: '900 m',
    dayLabel: 'Danas',
    start: '10:00',
    end: '16:00',
    startsIn: 'završena',
    pay: 66,
    basePay: 66,
    bonus: 0,
    tips: false,
    workersNeeded: 3,
    claimedWorkers: ['Ivan M.', 'Nina K.', 'Ana J.'],
    urgent: false,
    audience: 'public',
    notifiedCount: 29,
    viewers: 0,
    employerRating: 4.9,
    status: 'completed',
    requirements: [],
    fillTime: '4m 38s',
    template: true,
  },
];

export const initialSmjenaState: SmjenaState = {
  shifts: seedShifts,
  activeShiftId: null,
  lastReward: null,
  worker: {
    id: 'worker-luka',
    name: 'Luka',
    initials: 'LK',
    score: 96,
    rating: 4.92,
    completedShifts: 27,
    attendance: 100,
    earningsWeek: 218,
    previousWeek: 154,
    available: true,
    notificationsEnabled: false,
    premiumUnlocked: false,
    skills: ['Konobar', 'Barmen', 'Engleski B2'],
    crewEmployers: ['Porto Budva', 'The Spot Tivat', 'Bokeška kužina'],
  },
  employer: {
    id: 'employer-porto',
    name: 'Porto Budva',
    city: 'Budva',
    rating: 4.9,
    crewCount: 23,
    completedShifts: 41,
  },
};

export function openShifts(state: SmjenaState) {
  return state.shifts.filter((shift) => shift.status === 'open');
}

export function employerShifts(state: SmjenaState) {
  return state.shifts.filter((shift) => shift.employer === state.employer.name);
}

export function remainingSpots(shift: Shift) {
  return Math.max(shift.workersNeeded - shift.claimedWorkers.length, 0);
}

export function completionPercent(shift: Shift) {
  return Math.min((shift.claimedWorkers.length / shift.workersNeeded) * 100, 100);
}
