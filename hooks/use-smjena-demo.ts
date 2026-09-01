'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  initialSmjenaState,
  type NewShiftInput,
  type SmjenaState,
} from '@/lib/smjena';

const STORAGE_KEY = 'smjena-demo-v2';

function loadState(): SmjenaState {
  if (typeof window === 'undefined') return initialSmjenaState;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored ? (JSON.parse(stored) as SmjenaState) : initialSmjenaState;
  } catch {
    return initialSmjenaState;
  }
}

export function useSmjenaDemo() {
  const [state, setState] = useState<SmjenaState>(initialSmjenaState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    queueMicrotask(() => {
      setState(loadState());
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [hydrated, state]);

  const claimShift = useCallback((shiftId: string) => {
    setState((current) => {
      if (current.activeShiftId) return current;
      return {
        ...current,
        activeShiftId: shiftId,
        lastReward: null,
        shifts: current.shifts.map((shift) => {
          if (shift.id !== shiftId || shift.status !== 'open') return shift;
          const claimedWorkers = [...shift.claimedWorkers, `${current.worker.name} K.`];
          return {
            ...shift,
            claimedWorkers,
            status: claimedWorkers.length >= shift.workersNeeded ? 'claimed' : 'open',
            fillTime: claimedWorkers.length >= shift.workersNeeded ? '3m 42s' : shift.fillTime,
          };
        }),
      };
    });
  }, []);

  const checkIn = useCallback((shiftId: string) => {
    setState((current) => ({
      ...current,
      shifts: current.shifts.map((shift) =>
        shift.id === shiftId ? { ...shift, status: 'in_progress' } : shift,
      ),
    }));
  }, []);

  const checkOut = useCallback((shiftId: string) => {
    setState((current) => {
      const shift = current.shifts.find((candidate) => candidate.id === shiftId);
      if (!shift) return current;
      const oldScore = current.worker.score;
      const newScore = Math.min(oldScore + 2, 100);
      const unlocked = !current.worker.premiumUnlocked && newScore >= 97;
      return {
        ...current,
        activeShiftId: null,
        lastReward: {
          shiftId,
          amount: shift.pay,
          oldScore,
          newScore,
          rating: 5,
          unlocked,
        },
        worker: {
          ...current.worker,
          score: newScore,
          rating: Number(((current.worker.rating * current.worker.completedShifts + 5) / (current.worker.completedShifts + 1)).toFixed(2)),
          completedShifts: current.worker.completedShifts + 1,
          earningsWeek: current.worker.earningsWeek + shift.pay,
          premiumUnlocked: current.worker.premiumUnlocked || unlocked,
          crewEmployers: current.worker.crewEmployers.includes(shift.employer)
            ? current.worker.crewEmployers
            : [...current.worker.crewEmployers, shift.employer],
        },
        employer: {
          ...current.employer,
          crewCount: shift.employer === current.employer.name
            ? current.employer.crewCount + 1
            : current.employer.crewCount,
        },
        shifts: current.shifts.map((candidate) =>
          candidate.id === shiftId ? { ...candidate, status: 'completed' } : candidate,
        ),
      };
    });
  }, []);

  const postShift = useCallback((input: NewShiftInput) => {
    const id = `shift-${Date.now()}`;
    setState((current) => ({
      ...current,
      shifts: [
        {
          id,
          role: input.role,
          employer: current.employer.name,
          area: input.area,
          city: current.employer.city,
          distance: '1,1 km',
          dayLabel: 'Danas',
          start: input.start,
          end: input.end,
          startsIn: '2h 45m',
          pay: input.pay,
          basePay: input.urgent ? input.pay - 15 : input.pay,
          bonus: input.urgent ? 15 : 0,
          tips: true,
          workersNeeded: input.workersNeeded,
          claimedWorkers: [],
          urgent: input.urgent,
          audience: input.crewFirst ? 'crew' : 'public',
          notifiedCount: input.crewFirst ? current.employer.crewCount : 47,
          viewers: input.urgent ? 9 : 3,
          employerRating: current.employer.rating,
          status: 'open',
          requirements: [],
          template: true,
        },
        ...current.shifts,
      ],
    }));
    return id;
  }, []);

  const raisePay = useCallback((shiftId: string) => {
    setState((current) => ({
      ...current,
      shifts: current.shifts.map((shift) =>
        shift.id === shiftId
          ? { ...shift, pay: shift.pay + 10, bonus: shift.bonus + 10, urgent: true, audience: 'public', notifiedCount: 47 }
          : shift,
      ),
    }));
  }, []);

  const broadcastShift = useCallback((shiftId: string) => {
    setState((current) => ({
      ...current,
      shifts: current.shifts.map((shift) =>
        shift.id === shiftId ? { ...shift, audience: 'public', notifiedCount: 47 } : shift,
      ),
    }));
  }, []);

  const activateReplacement = useCallback((shiftId: string) => {
    setState((current) => ({
      ...current,
      shifts: current.shifts.map((shift) =>
        shift.id === shiftId
          ? {
              ...shift,
              status: 'open',
              replacementActive: true,
              urgent: true,
              audience: 'public',
              notifiedCount: 47,
              claimedWorkers: shift.claimedWorkers.slice(0, -1),
            }
          : shift,
      ),
    }));
  }, []);

  const setAvailable = useCallback((available: boolean) => {
    setState((current) => ({ ...current, worker: { ...current.worker, available } }));
  }, []);

  const setNotificationsEnabled = useCallback((notificationsEnabled: boolean) => {
    setState((current) => ({
      ...current,
      worker: { ...current.worker, notificationsEnabled },
    }));
  }, []);

  const dismissReward = useCallback(() => {
    setState((current) => ({ ...current, lastReward: null }));
  }, []);

  const resetDemo = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setState(initialSmjenaState);
  }, []);

  return {
    state,
    hydrated,
    claimShift,
    checkIn,
    checkOut,
    postShift,
    raisePay,
    broadcastShift,
    activateReplacement,
    setAvailable,
    setNotificationsEnabled,
    dismissReward,
    resetDemo,
  };
}
