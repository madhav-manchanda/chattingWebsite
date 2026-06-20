const express = require('express');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Relationship = require('../models/Relationship');
const { Op } = require('sequelize');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_retro_secret_key';

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.id;
    next();
  });
};

// Get all friends and pending requests
router.get('/', auth, async (req, res) => {
  try {
    const relationships = await Relationship.findAll({
      where: {
        [Op.or]: [
          { senderId: req.userId },
          { receiverId: req.userId }
        ]
      },
      include: [
        { model: User, as: 'Sender', attributes: ['id', 'name', 'username', 'isOnline', 'lastSeen'] },
        { model: User, as: 'Receiver', attributes: ['id', 'name', 'username', 'isOnline', 'lastSeen'] }
      ]
    });
    res.json(relationships);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Send a friend request
router.post('/request', auth, async (req, res) => {
  try {
    const { receiverId } = req.body;
    if (receiverId === req.userId) return res.status(400).json({ error: 'Cannot send request to yourself' });

    const existing = await Relationship.findOne({
      where: {
        [Op.or]: [
          { senderId: req.userId, receiverId },
          { senderId: receiverId, receiverId: req.userId }
        ]
      }
    });

    if (existing) return res.status(400).json({ error: 'Relationship already exists' });

    const rel = await Relationship.create({
      senderId: req.userId,
      receiverId
    });
    res.json(rel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Accept a friend request
router.post('/accept', auth, async (req, res) => {
  try {
    const { id } = req.body;
    const rel = await Relationship.findOne({ where: { id, receiverId: req.userId, status: 'pending' } });
    if (!rel) return res.status(404).json({ error: 'Request not found' });

    rel.status = 'accepted';
    await rel.save();
    res.json(rel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Reject a friend request
router.post('/reject', auth, async (req, res) => {
  try {
    const { id } = req.body;
    const rel = await Relationship.findOne({ where: { id, receiverId: req.userId, status: 'pending' } });
    if (!rel) return res.status(404).json({ error: 'Request not found' });

    rel.status = 'rejected';
    await rel.save();
    res.json(rel);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
