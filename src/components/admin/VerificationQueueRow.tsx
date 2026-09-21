import { StatusBadge } from '@/components/shared/StatusBadge';

/**
 * VerificationQueueRow — Admin-facing component
 * A single row in the lawyer verification queue table.
 * TODO: Add credential documents preview (open in modal)
 * TODO: Add rejection reason input in the reject flow
 * TODO: Confirmation dialog before approving/rejecting
 */
interface VerificationQueueRowProps {
  lawyerId: string;
  name: string;
  email: string;
  ibpNumber: string;
  submittedAt: string;
  status: 'pending' | 'verified' | 'rejected';
  onApprove: (lawyerId: string) => void;
  onReject: (lawyerId: string) => void;
}

export function VerificationQueueRow({
  lawyerId,
  name,
  email,
  ibpNumber,
  submittedAt,
  status,
  onApprove,
  onReject,
}: VerificationQueueRowProps) {
  return (
    <tr className="border-b hover:bg-muted/50 transition-colors">
      <td className="px-4 py-3 text-sm font-medium">{name}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{email}</td>
      <td className="px-4 py-3 text-xs font-mono">{ibpNumber}</td>
      <td className="px-4 py-3 text-xs text-muted-foreground">{submittedAt}</td>
      <td className="px-4 py-3">
        <StatusBadge status={status} />
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <a
            href={`/admin/lawyers/${lawyerId}`}
            className="text-xs rounded border px-2 py-1 hover:bg-muted transition"
            aria-label={`Review ${name}'s application`}
          >
            Review
          </a>
          {status === 'pending' && (
            <>
              <button
                onClick={() => onApprove(lawyerId)}
                className="text-xs rounded border border-green-300 bg-green-50 text-green-700 px-2 py-1 hover:bg-green-100 transition"
                type="button"
                aria-label={`Approve ${name}`}
              >
                Approve
              </button>
              <button
                onClick={() => onReject(lawyerId)}
                className="text-xs rounded border border-red-300 bg-red-50 text-red-700 px-2 py-1 hover:bg-red-100 transition"
                type="button"
                aria-label={`Reject ${name}`}
              >
                Reject
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}
