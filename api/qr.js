const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// register.js issues 64 hex chars, but rows created before that may carry a
// token in another shape (e.g. a UUID), so only reject values that clearly
// can't be a token before touching the database.
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

// Public endpoint behind the participant QR page (qr.html?t=<qr_token>).
// Knowing the token is the only credential, so this returns just enough to
// render that page: the participant's name and whether the registration is
// still active. Check-in itself stays in admin-checkin.js.
module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'no-store');

  const { token } = req.body || {};
  const qrToken = typeof token === 'string' ? token.trim() : '';

  if (!TOKEN_PATTERN.test(qrToken)) {
    return res.status(404).json({ error: 'QR 정보를 찾을 수 없습니다.' });
  }

  const { data, error } = await supabase
    .from('registrations')
    .select('name, status')
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (error) {
    console.error('Supabase QR lookup error:', error);
    return res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }

  if (!data) {
    return res.status(404).json({ error: 'QR 정보를 찾을 수 없습니다.' });
  }

  return res.status(200).json({
    ok: true,
    name: data.name,
    cancelled: data.status === 'cancelled',
  });
};
