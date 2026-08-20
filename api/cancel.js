const { createClient } = require('@supabase/supabase-js');

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

  const { data, error } = await supabase
    .from('registrations')
    .update({ status: 'cancelled' })
    .eq('name', String(name).trim())
    .eq('phone', String(phone).trim())
    .neq('status', 'cancelled')
    .select('name')
    .maybeSingle();

  if (error) {
    console.error('Supabase cancel error:', error);
    return res.status(500).json({ error: '취소 처리 중 오류가 발생했습니다.' });
  }

  if (!data) {
    return res.status(404).json({ error: '일치하는 사전등록 내역을 찾을 수 없습니다.' });
  }

  return res.status(200).json({ ok: true });
};
