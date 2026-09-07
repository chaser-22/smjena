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
  contactPhone: string | null;
  state: SmjenaState;
};

export async function getDashboardData(user: User): Promise<DashboardData> {
  const supabase = await createClient();
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id, role, full_name, city, verified_at')
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
  const [workerResult, feedResult, assignmentResult, trustedResult, ledgerResult, ownContactResult] = await Promise.all([
    supabase.from('worker_profiles').select('*').eq('user_id', userId).single(),
    supabase.from('shifts').select('*').eq('status', 'published').eq('city', String(profile.city)).gt('ends_at', now.toISOString()).order('starts_at').limit(50),
    supabase.from('shift_assignments').select('*').eq('worker_id', userId).order('claimed_at', { ascending: false }).limit(100),
    supabase.from('trusted_workers').select('employer_id').eq('worker_id', userId),
    supabase.from('payment_ledger').select('assignment_id, amount_cents, created_at, status').eq('worker_id', userId).order('created_at', { ascending: false }).limit(200),
    supabase.from('worker_contacts').select('phone').eq('user_id', userId).maybeSingle(),
  ]);

  if (workerResult.error || !workerResult.data) throw new Error('Radnički profil nije pronađen.');
  if (feedResult.error) throw feedResult.error;
  if (assignmentResult.error) throw assignmentResult.error;
  if (ownContactResult.error) throw ownContactResult.error;

  const assignments = (assignmentResult.data ?? []) as Row[];
  const assignedShiftIds = [...new Set(assignments.map((row) => String(row.shift_id)))];
  const assignedShiftResult = assignedShiftIds.length
    ? await supabase.from('shifts').select('*').in('id', assignedShiftIds)
    : { data: [], error: null };
  if (assignedShiftResult.error) throw assignedShiftResult.error;

  const shiftRows = dedupeRows([...(feedResult.data ?? []), ...(assignedShiftResult.data ?? [])] as Row[]);
  const employerIds = [...new Set(shiftRows.map((row) => String(row.employer_id)))];
  const [employerResult, employerContactResult] = employerIds.length
    ? await Promise.all([
        supabase.from('employer_marketplace_profiles').select('id, name, average_rating, rating_count, verified_at').in('id', employerIds),
        supabase.from('employer_contacts').select('employer_id, phone').in('employer_id', employerIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }];
  if (employerResult.error || employerContactResult.error) throw new Error('Podaci poslodavca nijesu dostupni.');

  const employers = new Map(((employerResult.data ?? []) as Row[]).map((row) => [String(row.id), row]));
  const employerContactPhones = new Map(((employerContactResult.data ?? []) as Row[]).map((row) => [String(row.employer_id), String(row.phone)]));
  const assignmentByShift = new Map<string, Row>();
  assignments.forEach((row) => {
    const shiftId = String(row.shift_id);
    if (!assignmentByShift.has(shiftId)) assignmentByShift.set(shiftId, row);
  });
  const workerRow = workerResult.data as Row;
  const ledgerRows = (ledgerResult.data ?? []) as Row[];
  const ledgerByAssignment = new Map(ledgerRows.map((row) => [String(row.assignment_id), String(row.status)]));
  const shifts = shiftRows
    .map((row) => {
      const assignment = assignmentByShift.get(String(row.id));
      return mapShift(
        row,
        employers.get(String(row.employer_id)),
        assignment,
        undefined,
        assignment ? ledgerByAssignment.get(String(assignment.id)) : undefined,
        assignment && ['claimed', 'checked_in'].includes(String(assignment.status))
          ? { counterpart_name: String(employers.get(String(row.employer_id))?.name ?? 'Poslodavac'), counterpart_phone: employerContactPhones.get(String(row.employer_id)) }
          : undefined,
      );
    })
    .sort((left, right) => (left.startsAt ?? '').localeCompare(right.startsAt ?? ''));
  const assignedShiftRows = new Map(shiftRows.map((row) => [String(row.id), row]));
  const activeAssignment = assignments
    .filter((row) => ['claimed', 'checked_in'].includes(String(row.status)))
    .sort((left, right) => {
      if (left.status === 'checked_in') return -1;
      if (right.status === 'checked_in') return 1;
      return String(assignedShiftRows.get(String(left.shift_id))?.starts_at ?? '')
        .localeCompare(String(assignedShiftRows.get(String(right.shift_id))?.starts_at ?? ''));
    })[0];
  const trustedEmployerIds = (trustedResult.data ?? []).map((row) => String((row as Row).employer_id));
  const trustedEmployerResult = trustedEmployerIds.length
    ? await supabase.from('employer_marketplace_profiles').select('name').in('id', trustedEmployerIds)
    : { data: [], error: null };

  const worker: WorkerProfile = {
    id: userId,
    name: String(profile.full_name),
    city: String(profile.city),
    initials: initials(String(profile.full_name)),
    verified: Boolean(profile.verified_at),
    score: Number(workerRow.reliability_score),
    rating: Number(workerRow.rating_count) > 0 ? Number(workerRow.average_rating) : null,
    ratingCount: Number(workerRow.rating_count),
    completedShifts: Number(workerRow.completed_shifts),
    scoreKnown: assignments.some((row) => ['completed', 'no_show'].includes(String(row.status))),
    attendance: assignments.some((row) => ['completed', 'no_show'].includes(String(row.status))) ? Number(workerRow.attendance_percent) : null,
    earningsWeek: sumLedger(ledgerRows, weekStart, now, ['pending', 'authorized', 'paid']),
    paidWeek: sumLedger(ledgerRows, weekStart, now, ['paid']),
    pendingWeek: sumLedger(ledgerRows, weekStart, now, ['pending']),
    authorizedWeek: sumLedger(ledgerRows, weekStart, now, ['authorized']),
    available: Boolean(workerRow.available),
    notificationsEnabled: Boolean(workerRow.notifications_enabled),
    skills: Array.isArray(workerRow.skills) ? workerRow.skills.map(String) : [],
    crewEmployers: (trustedEmployerResult.data ?? []).map((row) => String((row as Row).name)),
  };

  return {
    role: 'worker',
    userId,
    employerId: null,
    profileName: worker.name,
    contactPhone: ownContactResult.data?.phone ? String(ownContactResult.data.phone) : null,
    state: {
      shifts,
      worker,
      employer: emptyEmployer(),
      activeShiftId: activeAssignment ? String(activeAssignment.shift_id) : null,
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
  const [employerResult, shiftResult, trustedResult, ledgerResult, ownContactResult] = await Promise.all([
    supabase.from('employers').select('*').eq('id', employerId).single(),
    supabase.from('shifts').select('*').eq('employer_id', employerId).order('starts_at', { ascending: false }).limit(100),
    supabase.from('trusted_workers').select('worker_id').eq('employer_id', employerId),
    supabase.from('payment_ledger').select('assignment_id, amount_cents, status').eq('employer_id', employerId),
    supabase.from('employer_contacts').select('phone').eq('employer_id', employerId).maybeSingle(),
  ]);
  if (employerResult.error || !employerResult.data) throw new Error('Poslodavac nije pronađen.');
  if (shiftResult.error) throw shiftResult.error;
  if (ledgerResult.error) throw ledgerResult.error;
  if (ownContactResult.error) throw ownContactResult.error;

  const shiftRows = (shiftResult.data ?? []) as Row[];
  const shiftIds = shiftRows.map((row) => String(row.id));
  const assignmentsResult = shiftIds.length
    ? await supabase.from('shift_assignments').select('*').in('shift_id', shiftIds)
    : { data: [], error: null };
  if (assignmentsResult.error) throw assignmentsResult.error;
  const assignments = (assignmentsResult.data ?? []) as Row[];
  const ledgerByAssignment = new Map(((ledgerResult.data ?? []) as Row[]).map((row) => [String(row.assignment_id), String(row.status)]));

  const workerIds = [...new Set([
    ...assignments.map((row) => String(row.worker_id)),
    ...(trustedResult.data ?? []).map((row) => String((row as Row).worker_id)),
  ])];
  const [profileResult, workerResult, workerContactResult] = workerIds.length
    ? await Promise.all([
        supabase.from('profiles').select('id, full_name').in('id', workerIds),
        supabase.from('worker_profiles').select('user_id, reliability_score, skills').in('user_id', workerIds),
        supabase.from('worker_contacts').select('user_id, phone').in('user_id', workerIds),
      ])
    : [{ data: [], error: null }, { data: [], error: null }, { data: [], error: null }];

  if (profileResult.error || workerResult.error || workerContactResult.error) throw new Error('Podaci radnika nijesu dostupni.');

  const workerNames = new Map(((profileResult.data ?? []) as Row[]).map((row) => [String(row.id), String(row.full_name)]));
  const workerPhones = new Map(((workerContactResult.data ?? []) as Row[]).map((row) => [String(row.user_id), String(row.phone)]));
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
    verified: Boolean(employerRow.verified_at),
    rating: Number(employerRow.rating_count) > 0 ? Number(employerRow.average_rating) : null,
    ratingCount: Number(employerRow.rating_count),
    crewCount: (trustedResult.data ?? []).length,
    completedShifts: Number(employerRow.completed_shifts),
    ledgerAwaiting: sumLedgerStatuses((ledgerResult.data ?? []) as Row[], ['pending']),
    ledgerAuthorized: sumLedgerStatuses((ledgerResult.data ?? []) as Row[], ['authorized']),
    ledgerPaid: sumLedgerStatuses((ledgerResult.data ?? []) as Row[], ['paid']),
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

  const employerSummary = { id: employerId, name: employer.name, average_rating: employer.rating, rating_count: employer.ratingCount, verified_at: employer.verified ? true : null };
  const shifts = shiftRows.map((row) => {
    const allAssignments = assignmentsByShift.get(String(row.id)) ?? [];
    const activeAssignments = allAssignments.filter((assignment) => !['cancelled', 'no_show'].includes(String(assignment.status)));
    const mapped = mapShift(row, employerSummary, undefined, activeAssignments.map((assignment) => workerNames.get(String(assignment.worker_id)) ?? 'Radnik'));
    mapped.assignments = allAssignments.map((assignment) => ({
      id: String(assignment.id),
      workerId: String(assignment.worker_id),
      workerName: workerNames.get(String(assignment.worker_id)) ?? 'Radnik',
      contactPhone: ['claimed', 'checked_in'].includes(String(assignment.status))
        ? workerPhones.get(String(assignment.worker_id))
        : undefined,
      status: String(assignment.status),
      pay: Number(assignment.pay_cents) / 100,
      paymentStatus: normalizeLedgerStatus(ledgerByAssignment.get(String(assignment.id))),
    }));
    return mapped;
  });

  return {
    role: 'employer',
    userId,
    employerId,
    profileName: String(profile.full_name),
    contactPhone: ownContactResult.data?.phone ? String(ownContactResult.data.phone) : null,
    state: { shifts, worker: emptyWorker(), employer, activeShiftId: null },
  };
}

function mapShift(row: Row, employer: Row | undefined, assignment?: Row, claimedNames?: string[], paymentStatus?: string, contact?: Row): Shift {
  const startsAt = new Date(String(row.starts_at));
  const endsAt = new Date(String(row.ends_at));
  const claimedCount = Number(row.claimed_count ?? claimedNames?.length ?? 0);
  const names = claimedNames ?? [];
  const status = assignment?.status === 'checked_in'
    ? 'in_progress'
    : assignment?.status === 'claimed'
      ? 'claimed'
      : assignment?.status === 'completed'
        ? 'completed'
        : ['cancelled', 'no_show'].includes(String(assignment?.status))
          ? 'cancelled'
          : mapStatus(String(row.status));

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
    endsAt: endsAt.toISOString(),
    pay: Number(row.pay_cents) / 100,
    basePay: Number(row.base_pay_cents) / 100,
    bonus: Number(row.bonus_cents) / 100,
    tips: Boolean(row.tips_expected),
    workersNeeded: Number(row.workers_needed),
    claimedCount,
    claimedWorkers: names,
    urgent: Boolean(row.urgent),
    audience: row.audience === 'crew' ? 'crew' : 'public',
    notifiedCount: Number(row.notified_count),
    viewers: Number(row.viewer_count),
    employerRating: Number(employer?.rating_count ?? 0) > 0 ? Number(employer?.average_rating) : null,
    employerRatingCount: Number(employer?.rating_count ?? 0),
    employerVerified: Boolean(employer?.verified_at),
    status,
    requirements: Array.isArray(row.requirements) ? row.requirements.map(String) : [],
    fillTime: fillTime(row),
    template: status === 'completed',
    replacementActive: Boolean(row.replacement_requested_at),
    assignmentStatus: assignment ? String(assignment.status) : undefined,
    cancellationReason: assignment?.cancellation_reason ? String(assignment.cancellation_reason) : undefined,
    paymentStatus: normalizeLedgerStatus(paymentStatus),
    contactName: contact?.counterpart_name ? String(contact.counterpart_name) : undefined,
    contactPhone: contact?.counterpart_phone ? String(contact.counterpart_phone) : undefined,
  };
}

function normalizeLedgerStatus(status?: string): Shift['paymentStatus'] {
  return ['pending', 'authorized', 'paid', 'failed', 'refunded'].includes(status ?? '')
    ? status as Shift['paymentStatus']
    : undefined;
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

function sumLedger(rows: Row[], start: Date, end: Date, statuses: string[]) {
  return rows.filter((row) => {
    const created = new Date(String(row.created_at));
    return created >= start && created < end && statuses.includes(String(row.status));
  }).reduce((sum, row) => sum + Number(row.amount_cents) / 100, 0);
}

function sumLedgerStatuses(rows: Row[], statuses: string[]) {
  return rows.filter((row) => statuses.includes(String(row.status))).reduce((sum, row) => sum + Number(row.amount_cents) / 100, 0);
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
  return { id: '', name: '', city: '', initials: '', verified: false, score: 0, rating: null, ratingCount: 0, completedShifts: 0, scoreKnown: false, attendance: null, earningsWeek: 0, paidWeek: 0, pendingWeek: 0, authorizedWeek: 0, available: false, notificationsEnabled: false, skills: [], crewEmployers: [] };
}

function emptyEmployer(): EmployerProfile {
  return { id: '', name: '', city: '', verified: false, rating: null, ratingCount: 0, crewCount: 0, completedShifts: 0, ledgerAwaiting: 0, ledgerAuthorized: 0, ledgerPaid: 0, crewWorkers: [], fillMedianMinutes: null, attendancePercent: null, repeatRate: null, fillRate: null, cancellationRate: null };
}
