import type { Metadata } from 'next';
import { MessagesView } from '@/components/client/views/MessagesView';

export const metadata: Metadata = { title: 'Attorney Messages & Consultations' };

export default function LawyerMessagesPage() {
  return <MessagesView role="lawyer" />;
}
