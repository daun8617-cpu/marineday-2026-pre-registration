// Shared authentication + role check for every admin API (api/admin-*.js).
//
// A valid Supabase session alone is not enough: the signed-in email must also
// be listed in one of two Vercel environment variables.
//   ADMIN_EMAILS  — full access (list, check-in, CSV, edit, cancel)
//   VIEWER_EMAILS — list, check-in and CSV only
// Both are comma-separated; matching ignores case and surrounding whitespace.
const ROLE_ADMIN = 'admin';
const ROLE_VIEWER = 'viewer';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Commas are the documented separator, but semicolons, spaces and line breaks
// are accepted too so a pasted list still parses.
function parseEmailList(value) {
  return String(value || '')
    .split(/[\s,;]+/)
    .map(normalizeEmail)
    .filter(Boolean);
}

// Returns { role } for a listed email, or { role: null, reason } otherwise.
function resolveRole(email) {
  const admins = parseEmailList(process.env.ADMIN_EMAILS);
  const viewers = parseEmailList(process.env.VIEWER_EMAILS);

  // No admin configured means the deployment is missing its settings, so
  // nobody gets in — viewers included.
  if (admins.length === 0) {
    return { role: null, reason: 'unconfigured' };
  }

  const normalized = normalizeEmail(email);
  if (!normalized) {
    return { role: null, reason: 'unlisted' };
  }

  const isAdmin = admins.includes(normalized);
  const isViewer = viewers.includes(normalized);

  // Listed under both roles: the intended role is ambiguous, so deny until
  // the lists are fixed rather than guess.
  if (isAdmin && isViewer) {
    return { role: null, reason: 'duplicate' };
  }
  if (isAdmin) return { role: ROLE_ADMIN };
  if (isViewer) return { role: ROLE_VIEWER };
  return { role: null, reason: 'unlisted' };
}

// Resolves to { user, role } when the request may proceed. Otherwise the
// error response has already been sent and this resolves to null, so callers
// just `return`.
// 401 = no usable session (the client may refresh and retry);
// 403 = signed in but not allowed (retrying will not help).
async function requireRole(req, res, supabase, allowedRoles) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return null;
  }

  const { data: userData, error: authError } = await supabase.auth.getUser(token);

  if (authError || !userData || !userData.user) {
    res.status(401).json({ error: '인증이 만료되었습니다. 다시 로그인해 주세요.' });
    return null;
  }

  const user = userData.user;
  const { role, reason } = resolveRole(user.email);

  if (!role) {
    if (reason === 'unconfigured') {
      console.error('Admin access denied: ADMIN_EMAILS is missing or empty.');
      res.status(403).json({ error: '관리자 권한 설정이 완료되지 않았습니다.' });
      return null;
    }
    if (reason === 'duplicate') {
      console.error('Admin access denied: an email is listed in both ADMIN_EMAILS and VIEWER_EMAILS.');
    }
    res.status(403).json({ error: '관리자 권한이 없습니다.' });
    return null;
  }

  if (!allowedRoles.includes(role)) {
    res.status(403).json({ error: '이 작업을 수행할 권한이 없습니다.' });
    return null;
  }

  return { user, role };
}

module.exports = { ROLE_ADMIN, ROLE_VIEWER, requireRole };
