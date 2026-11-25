import type { DocumentFolderItem } from '@/app/actions/consultationActions';

/**
 * A My Documents / Client Documents folder as served by GET /api/live/documents. Folders of
 * documents shared for a consultation say who shared them:
 *  - client view: "Shared to Atty. Maria Santos"
 *  - lawyer view: "Shared by Juan Dela Cruz"
 */
export interface DocumentFolderView extends DocumentFolderItem {
  sharedLabel?: string | null;
}
