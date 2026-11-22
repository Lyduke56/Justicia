export const ADMIN_REFRESH_EVENT = 'justicia:admin-refresh';

export function refreshAdminTabs() {
  window.dispatchEvent(new Event(ADMIN_REFRESH_EVENT));
}
