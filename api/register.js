const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const { normalizePhone } = require('../lib/phone');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PHONE_PATTERN = /^[0-9-]{9,13}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const QR_TOKEN_UNIQUE_CONSTRAINT = 'registrations_qr_token_key';
const MAX_QR_TOKEN_ATTEMPTS = 5;

function generateQrToken() {
  return crypto.randomBytes(32).toString('hex');
}

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

  const baseRecord = {
    name: String(name).trim(),
    phone: String(phone).trim(),
    email: String(email).trim(),
    organization: org ? String(org).trim() : null,
    position: position ? String(position).trim() : null,
  };

  const normalizedInputPhone = normalizePhone(baseRecord.phone);

  const { data: activeRecords, error: dupCheckError } = await supabase
    .from('registrations')
    .select('phone')
    .neq('status', 'cancelled');

  if (dupCheckError) {
    console.error('Supabase duplicate-check error:', dupCheckError);
    return res.status(500).json({ error: '등록 처리 중 오류가 발생했습니다.' });
  }

  const isDuplicate = (activeRecords || []).some(
    (r) => normalizePhone(r.phone) === normalizedInputPhone
  );

  if (isDuplicate) {
    return res.status(409).json({
      error: '이미 사전등록이 완료된 전화번호입니다.',
      duplicate: true,
    });
  }

  let error;
  for (let attempt = 0; attempt < MAX_QR_TOKEN_ATTEMPTS; attempt++) {
    const qrToken = generateQrToken();
    ({ error } = await supabase.from('registrations').insert({
      ...baseRecord,
      qr_token: qrToken,
    }));

    if (!error) {
      return res.status(200).json({ ok: true, qr_token: qrToken });
    }
    // Astronomically unlikely, but retry with a fresh token if the random
    // value happened to collide with an existing one; any other error
    // (including unrelated constraint violations) is not retried.
    if (error.code !== '23505' || !error.message?.includes(QR_TOKEN_UNIQUE_CONSTRAINT)) {
      break;
    }
  }

  console.error('Supabase insert error:', error);
  return res.status(500).json({ error: '등록 처리 중 오류가 발생했습니다.' });
};
