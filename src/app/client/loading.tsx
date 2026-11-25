import { ScreenLoader } from '@/components/shared/loading';

/** Global loading screen inside the client portal while a route page loads. */
export default function ClientLoading() {
  return <ScreenLoader variant="page" />;
}
