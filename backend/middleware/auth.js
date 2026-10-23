import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Sign in to continue' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.id);
    if (!req.user) return res.status(401).json({ message: 'Account not found' });
    if ((payload.version ?? 0) !== (req.user.sessionVersion || 0)) return res.status(401).json({ message: 'Your session has expired. Sign in again.' });
    if (req.user.mustChangePassword && !(req.baseUrl === '/api/auth' && req.path === '/password')) {
      return res.status(403).json({ message: 'Change your temporary password before continuing.', mustChangePassword: true });
    }
    next();
  } catch { res.status(401).json({ message: 'Invalid or expired session' }); }
}

export function requireRole(...roles) {
  return (req, res, next) => roles.includes(req.user?.role) ? next() : res.status(403).json({ message: 'You do not have permission to do that' });
}
