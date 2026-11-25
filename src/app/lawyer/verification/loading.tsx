import { ScreenLoader } from '@/components/shared/loading';

/** The application status page has no portal shell around it, so the loader covers the window. */
export default function LawyerVerificationLoading() {
  return <ScreenLoader variant="fullscreen" />;
}
