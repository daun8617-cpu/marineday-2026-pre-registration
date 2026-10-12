const { createClient } = require('@supabase/supabase-js');
const { ROLE_ADMIN, requireRole } = require('../lib/admin-auth');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const auth = await requireRole(req, res, supabase, [ROLE_ADMIN]);
  if (!auth) return;

  const { id } = req.body || {};
  const numericId = Number(id);

  if (!numericId || !Number.isInteger(numericId)) {
    return res.status(400).json({ error: '잘못된 요청입니다.' });
  }

  const { data, error } = await supabase
    .from('registrations')
    .update({ status: 'cancelled' })
    .eq('id', numericId)
    .neq('status', 'cancelled')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('Supabase admin cancel error:', error);
    return res.status(500).json({ error: '취소 처리 중 오류가 발생했습니다.' });
  }

  if (!data) {
    return res.status(404).json({ error: '해당 등록 내역을 찾을 수 없거나 이미 취소되었습니다.' });
  }

  return res.status(200).json({ ok: true });
};
