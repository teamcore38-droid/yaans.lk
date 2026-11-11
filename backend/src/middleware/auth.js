import jwt from 'jsonwebtoken';
import { getStore } from '../config/db.js';
import { getInitialSeedState } from '../seed/initialState.js';

const JWT_SECRET = process.env.JWT_SECRET || 'yaans_lk_sri_lanka_marketplace_jwt_secret_2026';

export function signToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
      sellerId: user.sellerId || null
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function signAdminToken(user) {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: 'admin',
      isAdminSession: true
    },
    JWT_SECRET,
    { expiresIn: '6h' }
  );
}

export function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Authentication required. Please sign in.' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const store = getStore();
    let user = store.users.find(
      (u) =>
        u._id === decoded.id ||
        String(u._id) === String(decoded.id) ||
        u.id === decoded.id ||
        (decoded.email && u.email && u.email.toLowerCase() === decoded.email.toLowerCase())
    );

    // Fallback: If not found in active store, check seed defaults (e.g. initial admin)
    if (!user) {
      const seed = getInitialSeedState();
      const matchedSeedUser = seed.users.find(
        (u) =>
          u._id === decoded.id ||
          String(u._id) === String(decoded.id) ||
          (decoded.email && u.email && u.email.toLowerCase() === decoded.email.toLowerCase())
      );
      if (matchedSeedUser) {
        store.users.unshift(matchedSeedUser);
        user = matchedSeedUser;
      }
    }

    if (!user || user.isActive === false) {
      return res.status(401).json({ message: 'User account not found or inactive.' });
    }
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired authentication token.' });
  }
}

export function optionalAuthenticate(req, _res, next) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      const store = getStore();
      let user = store.users.find(
        (u) =>
          u._id === decoded.id ||
          String(u._id) === String(decoded.id) ||
          u.id === decoded.id ||
          (decoded.email && u.email && u.email.toLowerCase() === decoded.email.toLowerCase())
      );
      if (!user) {
        const seed = getInitialSeedState();
        user = seed.users.find(
          (u) =>
            u._id === decoded.id ||
            (decoded.email && u.email && u.email.toLowerCase() === decoded.email.toLowerCase())
        );
      }
      if (user && user.isActive !== false) {
        req.user = user;
      }
    } catch (_err) {
      // Proceed as guest
    }
  }
  next();
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required role: ${roles.join(' or ')}.`
      });
    }
    next();
  };
}
