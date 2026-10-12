const { createClient } = require('@supabase/supabase-js');
const { ROLE_ADMIN, ROLE_VIEWER, requireRole } = require('../lib/admin-auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireRole(req, res, supabase, [ROLE_ADMIN, ROLE_VIEWER]);
  if (!auth) return;

  const { data, error } = await supabase
    .from('registrations')
    .select('id, name, phone, email, organization, department, position, status, created_at, checked_in, checked_in_at, qr_token')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase admin list error:', error);
    return res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }

  return res.status(200).json({ ok: true, role: auth.role, registrations: data });
};
