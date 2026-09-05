import assert from 'node:assert/strict';
import test from 'node:test';
import { completionPercent, remainingSpots, type Shift } from './smjena.ts';

function shift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: 'shift-1',
    role: 'Konobar/ica',
    employer: 'Hotel',
    area: 'Budva',
    city: 'Budva',
    distance: 'Budva',
    dayLabel: 'Danas',
    start: '18:00',
    end: '23:00',
    startsIn: '2h',
    pay: 80,
    basePay: 80,
    bonus: 0,
    tips: false,
    workersNeeded: 2,
    claimedCount: 0,
    claimedWorkers: [],
    urgent: false,
    audience: 'public',
    notifiedCount: 0,
    viewers: 0,
    employerRating: null,
    employerRatingCount: 0,
    employerVerified: false,
    status: 'open',
    requirements: [],
    ...overrides,
  };
}

test('remainingSpots uses the database count without invented worker names', () => {
  assert.equal(remainingSpots(shift({ workersNeeded: 3, claimedCount: 2, claimedWorkers: [] })), 1);
});

test('remainingSpots never becomes negative when concurrent claims fill the shift', () => {
  assert.equal(remainingSpots(shift({ workersNeeded: 1, claimedCount: 2 })), 0);
});

test('completionPercent is capped and handles invalid zero-capacity data safely', () => {
  assert.equal(completionPercent(shift({ workersNeeded: 4, claimedCount: 3 })), 75);
  assert.equal(completionPercent(shift({ workersNeeded: 1, claimedCount: 2 })), 100);
  assert.equal(completionPercent(shift({ workersNeeded: 0, claimedCount: 0 })), 0);
});
