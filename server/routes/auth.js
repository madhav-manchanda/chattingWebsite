const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Check if username is available (unprotected)
router.get('/check-username/:username', async (req, res) => {
  try {
    const { username } = req.params;
    const formattedUsername = username.startsWith('@') ? username : `@${username}`;
    const user = await User.findOne({ where: { username: formattedUsername } });
    res.json({ available: !user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/sync', auth, async (req, res) => {
  try {
    const { id } = req.user;
    
    let user = await User.findByPk(id);
    
    if (!user) {
      const { email, name, username, avatar } = req.body;
      user = await User.create({
        id,
        email,
        name: name || email.split('@')[0],
        username: username || `@${email.split('@')[0]}`,
        avatar: avatar || null
      });
    } else {
      // Optionally update name/avatar if they logged in with Google
      const { name, avatar } = req.body;
      let updated = false;
      if (name && user.name !== name) { user.name = name; updated = true; }
      if (avatar && user.avatar !== avatar) { user.avatar = avatar; updated = true; }
      if (updated) await user.save();
    }

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
