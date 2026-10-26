import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Settings' };

export default function SettingsPage() {
  return (
    <div className="p-6 sm:p-10 lg:p-12 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="font-cormorant text-4xl sm:text-5xl font-medium text-[#34150F]">
          Account <span className="text-[#C58B3C]">Settings</span>
        </h1>
        <p className="text-sm text-[#7D6855] mt-1">
          Preferences, notification settings, and privacy controls.
        </p>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl p-6 bg-[#EFE5D8] shadow-[5px_5px_12px_rgba(0,0,0,0.06),-5px_-5px_12px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 space-y-4">
          <h3 className="font-cormorant font-bold text-lg text-[#34150F]">
            Notifications
          </h3>
          <div className="space-y-3 text-xs text-[#5C4535]">
            <label className="flex items-center justify-between cursor-pointer py-1">
              <span>Email updates for scheduled attorney consultations</span>
              <input type="checkbox" defaultChecked className="accent-[#C58B3C] w-4 h-4 rounded" />
            </label>
            <label className="flex items-center justify-between cursor-pointer py-1 border-t border-[#E5D7C5]">
              <span>In-app notifications for AI assistant recommendations</span>
              <input type="checkbox" defaultChecked className="accent-[#C58B3C] w-4 h-4 rounded" />
            </label>
            <label className="flex items-center justify-between cursor-pointer py-1 border-t border-[#E5D7C5]">
              <span>SMS alerts for urgent hearing notices</span>
              <input type="checkbox" className="accent-[#C58B3C] w-4 h-4 rounded" />
            </label>
          </div>
        </div>

        <div className="rounded-2xl p-6 bg-[#EFE5D8] shadow-[5px_5px_12px_rgba(0,0,0,0.06),-5px_-5px_12px_rgba(255,255,255,0.85)] border border-[#E8DCCB]/60 space-y-4">
          <h3 className="font-cormorant font-bold text-lg text-[#34150F]">
            Security & Session
          </h3>
          <p className="text-xs text-[#7D6855]">
            Your session automatically expires after 30 minutes of inactivity for client confidentiality.
          </p>
          <div className="pt-2">
            <span className="inline-block px-3 py-1.5 rounded-lg bg-[#E5D7C5] text-[#34150F] text-xs font-medium">
              🔒 Inactivity Protection: Active (30 mins)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
