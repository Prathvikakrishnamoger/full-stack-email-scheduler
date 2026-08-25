const { Router } = require('express');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const env = require('../config/env');
const { authenticate } = require('../middleware/auth');

const router = Router();
const googleClient = new OAuth2Client(env.GOOGLE_CLIENT_ID);

/**
 * POST /api/auth/google
 * Verify Google ID token, upsert user, return app JWT.
 */
router.post('/google', async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential token is required' });
    }

    // Verify the Google ID token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: env.GOOGLE_CLIENT_ID
    });

    const payload = ticket.getPayload();
    const { sub: googleId, email, name, picture } = payload;

    // Upsert user in MongoDB
    const user = await User.findOneAndUpdate(
      { googleId },
      { googleId, email, name, avatar: picture || '' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Generate application JWT
    const token = jwt.sign(
      {
        id: user._id.toString(),
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        avatar: user.avatar
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    console.log(`[Auth] User logged in: ${email}`);

    res.json({
      token,
      user: {
        id: user._id.toString(),
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('[Auth] Google token verification failed:', error.message);
    res.status(401).json({ error: 'Google authentication failed' });
  }
});

/**
 * GET /api/auth/me
 * Returns the current authenticated user.
 */
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user._id.toString(),
        googleId: user.googleId,
        email: user.email,
        name: user.name,
        avatar: user.avatar
      }
    });
  } catch (error) {
    console.error('[Auth] Error fetching user:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
