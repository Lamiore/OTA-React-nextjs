import type { UserRole } from '@/lib/useAuth';

// Peran di atas 'user' saja; pengguna biasa tidak perlu label apa pun.
// Warnanya mengikuti panel Pengguna di dashboard biar konsisten.
export const roleInfo: Partial<
  Record<UserRole, { label: string; className: string; description: string }>
> = {
  admin: {
    label: 'Admin',
    className: 'border-teal-200 bg-teal-50 text-teal-700',
    description: 'Akses penuh dashboard: destinasi, pengguna, dan kamera.',
  },
  pengelola: {
    label: 'Pengelola',
    className: 'border-warn-rule bg-warn-soft text-warn',
    description: 'Kelola destinasi yang ditetapkan admin beserta booking & kameranya.',
  },
  mitra: {
    label: 'Mitra',
    className: 'border-ok/30 bg-ok-soft text-ok',
    description: 'Boleh mendaftarkan dan memantau kamera milikmu.',
  },
};

export default function RoleBadge({ role }: { role: UserRole | null }) {
  const badge = role ? roleInfo[role] : undefined;
  if (!badge) return null;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-xs border px-3 py-1.5 text-2xs font-medium ${badge.className}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {badge.label}
    </span>
  );
}
