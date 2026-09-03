const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: '인증이 필요합니다.' });
  }

  const { data: userData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !userData.user) {
    return res.status(401).json({ error: '인증이 만료되었습니다. 다시 로그인해 주세요.' });
  }

  const { data, error } = await supabase
    .from('registrations')
    .select('id, name, phone, email, organization, position, status, created_at, checked_in')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Supabase admin list error:', error);
    return res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }

  return res.status(200).json({ ok: true, registrations: data });
};
