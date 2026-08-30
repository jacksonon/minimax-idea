'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// /dreams used to be a standalone list page. It has been folded into
// the /me dashboard (Profile / Dreams / API key). Old links keep
// working: this page just bounces the user to the right tab.
export default function DreamsPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/me?tab=dreams');
  }, [router]);
  return null;
}
