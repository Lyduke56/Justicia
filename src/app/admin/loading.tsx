import { ScreenLoader } from '@/components/shared/loading';

/** Global loading screen inside the admin portal while a route page loads. */
export default function AdminLoading() {
  return <ScreenLoader variant="page" background="#EFE5D8" />;
}
