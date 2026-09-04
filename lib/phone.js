// Shared phone normalization used by every server-side lookup/duplicate-check
// so registration, duplicate detection, and lookup all agree on what counts
// as "the same number" regardless of hyphen formatting.
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

module.exports = { normalizePhone };
