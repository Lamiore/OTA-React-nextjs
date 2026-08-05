import { Suspense } from 'react';
import TopNav from '@/components/desktop/TopNav';
import BottomNav from '@/components/mobile/BottomNav';
import ProfileContent from '@/components/profile/ProfileContent';

export default function Profile() {
  return (
    <main className="flex min-h-dvh flex-col bg-shore-50 pb-24 md:pb-0">
      <TopNav compact />
      <Suspense>
        <ProfileContent />
      </Suspense>
      <BottomNav />
    </main>
  );
}
