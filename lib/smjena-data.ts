import 'server-only';

import type { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import type { EmployerProfile, Shift, ShiftStatus, SmjenaState, WorkerProfile } from '@/lib/smjena';

type Row = Record<string, unknown>;

export type DashboardData = {
  role: 'worker' | 'employer';
  userId: string;
  employerId: string | null;
  profileName: string;
  state: SmjenaState;
};

export async function getDashboardData(user: User): Promise<DashboardData> {
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name, city')
    .eq('id', user.id)
    .single();

  if (profileError || !profile) throw new Error('Profil nije pronađen.');

  return profile.role === 'employer'
    ? getEmployerDashboard(user.id, profile as Row)
    : getWorkerDashboard(user.id, profile as Row);
}

async function getWorkerDashboard(userId: string, profile: Row): Promise<DashboardData> {
  const supabase = await createClient();
  const now = new Date();
  const weekStart = startOfWeek(now);
  const previousWeekStart = new Date(weekStart.getTime() - 7 * 86400000);

  const [workerResult, feedResult, assignmentResult, trustedResult, ledgerResult] = await Promise.all([
    supabase.from('worker_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('shifts').select('*').eq('status', 'published').eq('city', String(profile.city)).gt('starts_at', now.toISOString()).order('starts_at').limit(50),
    supabase.from('shift_assignments').select('*').eq('worker_id', userId).order('claimed_at', { ascending: false }).limit(100),
    supabase.from('trusted_workers').select('employer_id').eq('worker_id', userId),
    supabase.from('payment_ledger').select('amount_cents, created_at').eq('worker_id', userId).gte('created_at', previousWeekStart.toISOString()),
  ]);

  if (workerResult.error || !workerResult.data) throw new Error('Radnički profil nije pronađen.');
  if (feedResult.error) throw feedResult.error;
  if (assignmentResult.error) throw assignmentResult.error;

  const assignments = (assignmentResult.data ?? []) as Row[];
  const assignedShiftIds = [...new Set(assignments.map((row) => String(row.shift_id)))];
  const assignedShiftResult = assignedShiftIds.length
    ? await supabase.from('shifts').select('*').in('id', assignedShiftIds)
    : { data: [], error: null };
  if (assignedShiftResult.error) throw assignedShiftResult.error;

  const shiftRows = dedupeRows([...(feedResult.data ?? []), ...(assignedShiftResult.data ?? [])] as Row[]);
  const employerIds = [...new Set(shiftRows.map((row) => String(row.employer_id)))];
  const employerResult = employerIds.length
    ? await supabase.from('employer_marketplace_profiles').select('id, name, average_rating').in('id', employerIds)
    : { data: [], error: null };
  if (employerResult.error) throw employerResult.error;

  const employers = new Map(((employerResult.data ?? []) as Row[]).map((row) => [String(row.id), row]));
  const assignmentByShift = new Map(assignments.map((row) => [String(row.shift_id), row]));
  const shifts = shiftRows.map((row) => mapShift(row, employers.get(String(row.employer_id)), assignmentByShift.get(String(row.id))));
  const activeAssignment = assignments.find((row) => ['claimed', 'checked_in'].includes(String(row.status)));
  const workerRow = workerResult.data as Row;
  const ledgerRows = (ledgerResult.data ?? []) as Row[];
  const trustedEmployerIds = (trustedResult.data ?? []).map((row) => String((row as Row).employer_id));
  const trustedEmployerResult = trustedEmployerIds.length
    ? await supabase.from('employer_marketplace_profiles').select('name').in('id', trustedEmployerIds)
    : { data: [], error: null };

  const worker: WorkerProfile = {
    id: userId,
    name: String(profile.full_name),
    initials: initials(String(profile.full_name)),
    score: Number(workerRow.reliability_score),
    rating: Number(workerRow.average_rating),
    completedShifts: Number(workerRow.completed_shifts),
    attendance: Number(workerRow.attendance_percent),
    earningsWeek: sumLedger(ledgerRows, weekStart, now),
    previousWeek: sumLedger(ledgerRows, previousWeekStart, weekStart),
    available: Boolean(workerRow.available),
    notificationsEnabled: Boolean(workerRow.notifications_enabled),
    premiumUnlocked: Boolean(workerRow.premium_unlocked),
    skills: Array.isArray(workerRow.skills) ? workerRow.skills.map(String) : [],
    crewEmployers: (trustedEmployerResult.data ?? []).map((row) => String((row as Row).name)),
  };

  return {
    role: 'worker',
    userId,
    employerId: null,
    profileName: worker.name,
    state: {
      shifts,
      worker,
      employer: emptyEmployer(),
      activeShiftId: activeAssignment ? String(activeAssignment.shift_id) : null,
      lastReward: null,
    },
  };
}

async function getEmployerDashboard(userId: string, profile: Row): Promise<DashboardData> {
  const supabase = await createClient();
  const { data: membership, error: membershipError } = await supabase
    .from('employer_members')
    .select('employer_id')
    .eq('user_id', userId)
    .limit(1)
    .single();
  if (membershipError || !membership) throw new Error('Poslodavac nije povezan sa nalogom.');

  const employerId = String(membership.employer_id);
  const [employerResult, shiftResult, trustedResult] = await Promise.all([
    supabase.from('employers').select('*').eq('id', employerId).single(),
    supabase.from('shifts').select('*').eq('employer_id', employerId).order('starts_at', { ascending: false }).limit(100),
    supabase.from('trusted_workers').select('worker_id').eq('employer_id', employerId),
  ]);
  if (employerResult.error || !employerResult.data) throw new Error('Poslodavac nije pronađen.');
  if (shiftResult.error) throw shiftResult.error;

  const shiftRows = (shiftResult.data ?? []) as Row[];
  const shiftIds = shiftRows.map((row) => String(row.id));
  const assignmentsResult = shiftIds.length
    ? await supabase.from('shift_assignments').select('*').in('shift_id', shiftIds)
    : { data: [], error: null };
  if (assignmentsResult.error) throw assignmentsResult.error;
  const assignments = (assignmentsResult.data ?? []) as Row[];

  const workerIds = [...new Set([
    ...assignments.map((row) => String(row.worker_id)),
    ...(trustedResult.data ?? []).map((row) => String((row as Row).worker_id)),
  ])];
  const [profileResult, workerResult] = workerIds.length
    ? await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', workerIds),
        supabase.from('worker_profiles').select('user_id, reliability_score, skills').in('user_id', workerIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];

  const workerNames = new Map(((profileResult.data ?? []) as Row[]).map((row) => [String(row.id), String(row.full_name)]));
  const workers = new Map(((workerResult.data ?? []) as Row[]).map((row) => [String(row.user_id), row]));
  const assignmentsByShift = new Map<string, Row[]>();
  assignments.forEach((row) => {
    const key = String(row.shift_id);
    assignmentsByShift.set(key, [...(assignmentsByShift.get(key) ?? []), row]);
  });

  const employerRow = employerResult.data as Row;
  const attendanceRows = assignments.filter((row) => ['completed', 'no_show'].includes(String(row.status)));
  const finalizedAssignments = assignments.filter((row) => ['completed', 'cancelled', 'no_show'].includes(String(row.status)));
  const employer: EmployerProfile = {
    id: employerId,
    name: String(employerRow.name),
    city: String(employerRow.city),
    rating: Number(employerRow.average_rating),
    crewCount: (trustedResult.data ?? []).length,
    completedShifts: Number(employerRow.completed_shifts),
    crewWorkers: (trustedResult.data ?? []).map((row) => {
      const id = String((row as Row).worker_id);
      const worker = workers.get(id);
      return { id, name: workerNames.get(id) ?? 'Radnik', score: Number(worker?.reliability_score ?? 0), role: firstSkill(worker?.skills) };
    }),
    fillMedianMinutes: medianFillMinutes(shiftRows),
    attendancePercent: percentage(attendanceRows, (row) => String(row.status) === 'completed'),
    repeatRate: repeatWorkerRate(assignments),
    fillRate: percentage(shiftRows, (row) => ['filled', 'in_progress', 'completed'].includes(String(row.status))),
    cancellationRate: percentage(finalizedAssignments, (row) => ['cancelled', 'no_show'].includes(String(row.status))),
  };

  const employerSummary = { id: employerId, name: employer.name, average_rating: employer.rating };
  const shifts = shiftRows.map((row) => {
    const activeAssignments = (assignmentsByShift.get(String(row.id)) ?? []).filter((assignment) => !['cancelled', 'no_show'].includes(String(assignment.status)));
    const mapped = mapShift(row, employerSummary, undefined, activeAssignments.map((assignment) => workerNames.get(String(assignment.worker_id)) ?? 'Radnik'));
    mapped.assignments = activeAssignments.map((assignment) => ({
      id: String(assignment.id),
      workerId: String(assignment.worker_id),
      workerName: workerNames.get(String(assignment.worker_id)) ?? 'Radnik',
      status: String(assignment.status),
    }));
    return mapped;
  });

  return {
    role: 'employer',
    userId,
    employerId,
    profileName: String(profile.full_name),
    state: { shifts, worker: emptyWorker(), employer, activeShiftId: null, lastReward: null },
  };
}

function mapShift(row: Row, employer: Row | undefined, assignment?: Row, claimedNames?: string[]): Shift {
  const startsAt = new Date(String(row.starts_at));
  const endsAt = new Date(String(row.ends_at));
  const claimedCount = Number(row.claimed_count ?? claimedNames?.length ?? 0);
  const names = claimedNames ?? Array.from({ length: claimedCount }, () => 'Provjeren radnik');
  const status = assignment?.status === 'checked_in' ? 'in_progress' : assignment?.status === 'claimed' ? 'claimed' : mapStatus(String(row.status));

  return {
    id: String(row.id),
    role: String(row.role),
    employer: String(employer?.name ?? 'Poslodavac'),
    area: String(row.area),
    city: String(row.city),
    distance: String(row.city),
    dayLabel: dayLabel(startsAt),
    start: timeLabel(startsAt),
    end: timeLabel(endsAt),
    startsIn: relativeTime(startsAt),
    startsAt: startsAt.toISOString(),
    pay: Number(row.pay_cents) / 100,
    basePay: Number(row.base_pay_cents) / 100,
    bonus: Number(row.bonus_cents) / 100,
    tips: Boolean(row.tips_expected),
    workersNeeded: Number(row.workers_needed),
    claimedWorkers: names,
    urgent: Boolean(row.urgent),
    audience: row.audience === 'crew' ? 'crew' : 'public',
    notifiedCount: Number(row.notified_count),
    viewers: Number(row.viewer_count),
    employerRating: Number(employer?.average_rating ?? 0),
    status,
    requirements: Array.isArray(row.requirements) ? row.requirements.map(String) : [],
    fillTime: fillTime(row),
    template: status === 'completed',
    replacementActive: Boolean(row.replacement_of),
  };
}

function mapStatus(status: string): ShiftStatus {
  if (status === 'published' || status === 'draft') return 'open';
  if (status === 'filled') return 'claimed';
  if (status === 'in_progress') return 'in_progress';
  if (status === 'completed') return 'completed';
  return 'cancelled';
}

function startOfWeek(date: Date) {
  const result = new Date(date);
  const day = (result.getDay() + 6) % 7;
  result.setHours(0, 0, 0, 0);
  result.setDate(result.getDate() - day);
  return result;
}

function sumLedger(rows: Row[], start: Date, end: Date) {
  return rows.filter((row) => {
    const created = new Date(String(row.created_at));
    return created >= start && created < end;
  }).reduce((sum, row) => sum + Number(row.amount_cents) / 100, 0);
}

function dedupeRows(rows: Row[]) {
  return [...new Map(rows.map((row) => [String(row.id), row])).values()];
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('');
}

function dayLabel(date: Date) {
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);
  const key = dateKey(date);
  if (key === dateKey(today)) return 'Danas';
  if (key === dateKey(tomorrow)) return 'Sutra';
  return new Intl.DateTimeFormat('sr-Latn-ME', { timeZone: 'Europe/Podgorica', weekday: 'short', day: 'numeric', month: 'short' }).format(date);
}

function timeLabel(date: Date) {
  return new Intl.DateTimeFormat('sr-Latn-ME', { timeZone: 'Europe/Podgorica', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

function dateKey(date: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Podgorica', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function relativeTime(date: Date) {
  const minutes = Math.max(0, Math.round((date.getTime() - Date.now()) / 60000));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
  return `${Math.floor(minutes / 1440)}d ${Math.floor((minutes % 1440) / 60)}h`;
}

function fillTime(row: Row) {
  if (!row.published_at || !row.filled_at) return undefined;
  const seconds = Math.max(0, Math.round((new Date(String(row.filled_at)).getTime() - new Date(String(row.published_at)).getTime()) / 1000));
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function medianFillMinutes(rows: Row[]) {
  const values = rows.map((row) => {
    if (!row.published_at || !row.filled_at) return null;
    return Math.round((new Date(String(row.filled_at)).getTime() - new Date(String(row.published_at)).getTime()) / 60000);
  }).filter((value): value is number => value !== null).sort((a, b) => a - b);
  if (!values.length) return null;
  return values[Math.floor(values.length / 2)];
}

function percentage(rows: Row[], predicate: (row: Row) => boolean) {
  if (!rows.length) return null;
  return Math.round((rows.filter(predicate).length / rows.length) * 1000) / 10;
}

function repeatWorkerRate(assignments: Row[]) {
  const counts = new Map<string, number>();
  assignments.forEach((row) => counts.set(String(row.worker_id), (counts.get(String(row.worker_id)) ?? 0) + 1));
  if (!counts.size) return null;
  return Math.round(([...counts.values()].filter((count) => count > 1).length / counts.size) * 1000) / 10;
}

function firstSkill(skills: unknown) {
  return Array.isArray(skills) && skills.length ? String(skills[0]) : 'Radnik';
}

function emptyWorker(): WorkerProfile {
  return { id: '', name: '', initials: '', score: 0, rating: 0, completedShifts: 0, attendance: 0, earningsWeek: 0, previousWeek: 0, available: false, notificationsEnabled: false, premiumUnlocked: false, skills: [], crewEmployers: [] };
}

function emptyEmployer(): EmployerProfile {
  return { id: '', name: '', city: '', rating: 0, crewCount: 0, completedShifts: 0, crewWorkers: [], fillMedianMinutes: null, attendancePercent: null, repeatRate: null, fillRate: null, cancellationRate: null };
}
