const { createClient } = require('@supabase/supabase-js');

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

  const { name, phone, email, org, position, consent } = req.body || {};

  if (!name || !phone || !email || !consent) {
    return res.status(400).json({ error: '필수 항목이 누락되었습니다.' });
  }
  if (!PHONE_PATTERN.test(phone)) {
    return res.status(400).json({ error: '연락처 형식이 올바르지 않습니다.' });
  }
  if (!EMAIL_PATTERN.test(email)) {
    return res.status(400).json({ error: '이메일 형식이 올바르지 않습니다.' });
  }

  const { error } = await supabase.from('registrations').insert({
    name: String(name).trim(),
    phone: String(phone).trim(),
    email: String(email).trim(),
    organization: org ? String(org).trim() : null,
    position: position ? String(position).trim() : null,
  });

  if (error) {
    console.error('Supabase insert error:', error);
    return res.status(500).json({ error: '등록 처리 중 오류가 발생했습니다.' });
  }

  return res.status(200).json({ ok: true });
};
