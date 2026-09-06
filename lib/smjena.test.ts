import assert from 'node:assert/strict';
import test from 'node:test';
import { cancellationScorePenalty, completionPercent, isCheckInAvailable, isCheckOutAvailable, parseRequirements, remainingSpots, shiftsOverlap, type Shift } from './smjena.ts';

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
    startsAt: '2026-09-05T16:00:00.000Z',
    endsAt: '2026-09-05T22:00:00.000Z',
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

test('parseRequirements trims, deduplicates and caps employer input', () => {
  assert.deepEqual(parseRequirements('Crna košulja, POS kasa\nCrna košulja'), ['Crna košulja', 'POS kasa']);
  assert.equal(parseRequirements('1,2,3,4,5,6,7,8,9').length, 8);
});

test('attendance controls match the database time windows', () => {
  const item = shift();
  assert.equal(isCheckInAvailable(item, new Date('2026-09-05T14:59:00.000Z')), false);
  assert.equal(isCheckInAvailable(item, new Date('2026-09-05T15:00:00.000Z')), true);
  assert.equal(isCheckOutAvailable(item, new Date('2026-09-05T21:29:00.000Z')), false);
  assert.equal(isCheckOutAvailable(item, new Date('2026-09-05T21:30:00.000Z')), true);
});

test('cancellation penalty is explicit at the 24-hour boundary', () => {
  const item = shift();
  assert.equal(cancellationScorePenalty(item, new Date('2026-09-04T15:59:59.000Z')), 1);
  assert.equal(cancellationScorePenalty(item, new Date('2026-09-04T16:00:01.000Z')), 5);
});

test('overlap detection permits back-to-back work but blocks intersecting shifts', () => {
  const item = shift();
  assert.equal(shiftsOverlap(item, shift({ startsAt: '2026-09-05T22:00:00.000Z', endsAt: '2026-09-06T02:00:00.000Z' })), false);
  assert.equal(shiftsOverlap(item, shift({ startsAt: '2026-09-05T21:00:00.000Z', endsAt: '2026-09-06T01:00:00.000Z' })), true);
});
