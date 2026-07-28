const DELETE_PASSWORD = '680717';

// Shared password gate for deleting a practice history entry. Returns
// whether the deletion should proceed.
export function confirmHistoryDeletePassword(): boolean {
  const input = window.prompt('請輸入密碼以刪除這筆紀錄：');
  if (input === null) return false;
  if (input !== DELETE_PASSWORD) {
    window.alert('密碼錯誤，無法刪除。');
    return false;
  }
  return true;
}
