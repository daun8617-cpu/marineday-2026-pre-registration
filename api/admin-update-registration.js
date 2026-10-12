const { createClient } = require('@supabase/supabase-js');
const { ROLE_ADMIN, requireRole } = require('../lib/admin-auth');
const { isActivePhoneConflict } = require('../lib/phone');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PHONE_PATTERN = /^[0-9-]{9,13}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireRole(req, res, supabase, [ROLE_ADMIN]);
  if (!auth) return;

  const { id, name, phone, email, org, department, position } = req.body || {};
  const numericId = Number(id);

  if (!numericId || !Number.isInteger(numericId)) {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }
  // Same rule as api/register.js: every field is required and whitespace-only
  // values count as empty.
  const isBlank = (value) => typeof value !== 'string' || value.trim() === '';

  if (isBlank(name) || isBlank(phone) || isBlank(email) || isBlank(org) || isBlank(position)) {
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  }
  if (!PHONE_PATTERN.test(phone)) {
    return res.status(400).json({ error: '연락처 형식이 올바르지 않습니다.' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });
  }

  const { data, error } = await supabase
    .from('registrations')
    .update({
      name: String(name).trim(),
      phone: String(phone).trim(),
      email: String(email).trim(),
      organization: String(org).trim(),
      // Optional here: registrations made before the field existed have none.
      department: isBlank(department) ? null : department.trim(),
      position: String(position).trim(),
    })
    .eq('id', numericId)
    .select('id')
    .maybeSingle();

  if (error) {
    // The new number already belongs to another active registration.
    if (isActivePhoneConflict(error)) {
      return res.status(409).json({ error: '이미 다른 등록자가 사용 중인 전화번호입니다.' });
    }
    console.error('Supabase admin update error:', error);
    return res.status(500).json({ error: '수정 처리 중 오류가 발생했습니다.' });
  }

  if (!data) {
    return res.status(404).json({ error: '해당 등록 내역을 찾을 수 없습니다.' });
  }

  return res.status(200).json({ ok: true });
};
