const express = require('express');
const jwt = require('jsonwebtoken');
const Block = require('../models/Block');
const User = require('../models/User');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_retro_secret_key';

const auth = require('../middleware/auth');

// Get blocked users
router.get('/', auth, async (req, res) => {
  try {
    const blocks = await Block.findAll({
      where: { blockerId: req.userId },
      include: [{ model: User, as: 'Blocked', attributes: ['id', 'name'] }]
    });
    res.json(blocks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Block a user
router.post('/block', auth, async (req, res) => {
  try {
    const { blockedId } = req.body;
    if (blockedId === req.userId) return res.status(400).json({ error: 'Cannot block yourself' });

    const existing = await Block.findOne({ where: { blockerId: req.userId, blockedId } });
    if (existing) return res.status(400).json({ error: 'User already blocked' });

    const block = await Block.create({ blockerId: req.userId, blockedId });
    res.json(block);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Unblock a user
router.post('/unblock', auth, async (req, res) => {
  try {
    const { blockedId } = req.body;
    await Block.destroy({ where: { blockerId: req.userId, blockedId } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
