import { z } from 'zod';

export const DashboardContextSchema = z.discriminatedUnion('role', [
  z.object({ role: z.literal('worker') }),
  z.object({ role: z.literal('employer'), employerId: z.uuid() }),
]);
export type DashboardContext = z.infer<typeof DashboardContextSchema>;
export type AccountAccess = {
  name: string;
  city: string;
  worker: boolean;
  workspaces: { id: string; name: string; memberRole: string }[];
};

export function resolveDashboardContext(access: AccountAccess, mode?: string, workspace?: string): DashboardContext | null {
  if (mode && mode !== 'worker' && mode !== 'employer') return null;
  if (mode === 'worker') return access.worker && !workspace ? { role: 'worker' } : null;
  if (mode === 'employer' || workspace) {
    return workspace && access.workspaces.some((item) => item.id === workspace)
      ? { role: 'employer', employerId: workspace } : null;
  }
  // Compatibility for unambiguous old links only. Never pick an arbitrary firm.
  if (access.worker && access.workspaces.length === 0) return { role: 'worker' };
  if (!access.worker && access.workspaces.length === 1) return { role: 'employer', employerId: access.workspaces[0].id };
  return null;
}

export function dashboardHref(context: DashboardContext) {
  return context.role === 'worker' ? '/dashboard?mode=worker' : `/dashboard?mode=employer&workspace=${context.employerId}`;
}

// Only local product destinations. Reject encodings, backslashes and arbitrary
// query keys rather than attempting to normalize potentially hostile redirects.
export function safeReturnPath(value: unknown): string {
  if (typeof value !== 'string' || !/^\/[a-zA-Z0-9/?=&_-]*$/.test(value)) return '/dashboard';
  const url = new URL(value, 'https://smjena.invalid');
  if (url.origin !== 'https://smjena.invalid') return '/dashboard';
  if (/^\/shifts(?:\/[0-9a-f-]{36})?$/.test(url.pathname) && !url.search) return url.pathname;
  if (url.pathname === '/settings' && !url.search) return '/settings';
  if (url.pathname === '/dashboard' && [...url.searchParams.keys()].every((key) => ['mode', 'workspace', 'shift', 'source'].includes(key))) return url.pathname + url.search;
  return '/dashboard';
}
