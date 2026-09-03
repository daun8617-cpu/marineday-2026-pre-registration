const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
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

  const { qr_token } = req.body || {};
  const qrToken = typeof qr_token === 'string' ? qr_token.trim() : '';

  if (!qrToken) {
    return res.status(400).json({ error: 'QR 코드를 인식하지 못했습니다.' });
  }

  const { data: existing, error: lookupError } = await supabase
    .from('registrations')
    .select('id, name, organization, status, checked_in, checked_in_at, checked_in_by')
    .eq('qr_token', qrToken)
    .maybeSingle();

  if (lookupError) {
    console.error('Supabase check-in lookup error:', lookupError);
    return res.status(500).json({ error: '조회 중 오류가 발생했습니다.' });
  }

  if (!existing) {
    return res.status(404).json({ error: '등록 정보를 찾을 수 없는 QR 코드입니다.' });
  }

  if (existing.status === 'cancelled') {
    return res.status(409).json({
      error: '취소된 사전등록입니다.',
      name: existing.name,
      organization: existing.organization,
    });
  }

  if (existing.checked_in) {
    return res.status(200).json({
      ok: true,
      already: true,
      name: existing.name,
      organization: existing.organization,
      checked_in_at: existing.checked_in_at,
      checked_in_by: existing.checked_in_by,
    });
  }

  const adminIdentifier = userData.user.email || userData.user.id;

  const { data: updated, error: updateError } = await supabase
    .from('registrations')
    .update({
      checked_in: true,
      checked_in_at: new Date().toISOString(),
      checked_in_by: adminIdentifier,
    })
    .eq('id', existing.id)
    .eq('checked_in', false)
    .select('name, organization, checked_in_at, checked_in_by')
    .maybeSingle();

  if (updateError) {
    console.error('Supabase check-in update error:', updateError);
    return res.status(500).json({ error: '체크인 처리 중 오류가 발생했습니다.' });
  }

  if (!updated) {
    // Another scan won the race between our lookup and update; report as already-checked-in.
    return res.status(200).json({
      ok: true,
      already: true,
      name: existing.name,
      organization: existing.organization,
    });
  }

  return res.status(200).json({
    ok: true,
    already: false,
    name: updated.name,
    organization: updated.organization,
    checked_in_at: updated.checked_in_at,
    checked_in_by: updated.checked_in_by,
  });
};
