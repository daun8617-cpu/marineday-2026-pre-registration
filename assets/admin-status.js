// Single source of truth for how a registration's status is classified
// across the admin registrants list, detail page, and CSV/Excel export.
// Derived from the existing `status` and `checked_in` columns only.
(function (global) {
  function getStatusInfo(record) {
    if (record.status === 'cancelled') {
      return { key: 'cancelled', label: '등록취소' };
    }
    if (record.checked_in) {
      return { key: 'checked_in', label: '체크인 완료' };
    }
    return { key: 'registered', label: '등록완료' };
  }

  global.AdminRegistrationStatus = { getStatusInfo };
})(window);
