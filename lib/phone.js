// Shared phone normalization used by every server-side lookup/duplicate-check
// so registration, duplicate detection, and lookup all agree on what counts
// as "the same number" regardless of hyphen formatting.
function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

// Partial unique index on the normalized phone of non-cancelled registrations
// (digits only, same rule as normalizePhone). It is the backstop for two
// requests with the same number arriving at the same moment: both pass the
// read-then-write duplicate check, but the database accepts only one.
const ACTIVE_PHONE_UNIQUE_CONSTRAINT = 'registrations_active_phone_key';

function isActivePhoneConflict(error) {
  return Boolean(error) && error.code === '23505' &&
    String(error.message || '').includes(ACTIVE_PHONE_UNIQUE_CONSTRAINT);
}

module.exports = { normalizePhone, isActivePhoneConflict };
