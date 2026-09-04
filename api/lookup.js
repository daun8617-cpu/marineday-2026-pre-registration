const { createClient } = require('@supabase/supabase-js');
const { normalizePhone } = require('../lib/phone');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PHONE_PATTERN = /^[0-9-]{9,13}$/;

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { name, phone } = req.body || {};

  if (!name || !phone) {
    return res.status(400).json({ error: '이름과 연락처를 입력해 주세요.' });
  }
  if (!PHONE_PATTERN.test(phone)) {
    return res.status(400).json({ error: '연락처 형식이 올바르지 않습니다.' });
  }

  const { data: rows, error } = await supabase
    .from('registrations')
    .select('name, phone, email, organization, status, created_at, qr_token')
    .eq('name', String(name).trim());

  if (error) {
    console.error('Supabase lookup error:', error);
    return res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }

  const normalizedInput = normalizePhone(phone);
  const matches = (rows || []).filter((r) => normalizePhone(r.phone) === normalizedInput);

  if (matches.length === 0) {
    return res.status(404).json({ error: '일치하는 사전등록 내역을 찾을 수 없습니다.' });
  }

  // Same priority as the registration duplicate check: an active (non-cancelled)
  // registration always wins over any cancelled history for this phone number,
  // and if several active rows exist (shouldn't normally happen once duplicate
  // prevention is in place, but historical data may still have some) the most
  // recently created one is returned.
  const active = matches.filter((r) => r.status !== 'cancelled');

  if (active.length === 0) {
    return res.status(404).json({ error: '이미 취소된 사전등록입니다.' });
  }

  active.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const data = active[0];

  return res.status(200).json({
    ok: true,
    name: data.name,
    phone: data.phone,
    email: data.email,
    organization: data.organization,
    created_at: data.created_at,
    qr_token: data.qr_token,
  });
};
