import { ScreenLoader } from '@/components/shared/loading';

/** The registration flow has no portal shell around it, so the loader covers the window. */
export default function LawyerRegisterLoading() {
  return <ScreenLoader variant="fullscreen" />;
}
