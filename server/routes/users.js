const express = require('express');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const User = require('../models/User');
const Block = require('../models/Block');
const Relationship = require('../models/Relationship');
const CustomSticker = require('../models/CustomSticker');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_retro_secret_key';

// Auth middleware
const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.id;
    next();
  });
};

// Get all users except the current user
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.findAll({
      where: {
        id: { [Op.ne]: req.userId }
      },
      attributes: ['id', 'name', 'username', 'email', 'isOnline', 'lastSeen', 'avatar']
    });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update user profile
router.put('/profile', auth, async (req, res) => {
  try {
    const { name, username, avatar } = req.body;
    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Check if username is taken by someone else
    if (username && username !== user.username) {
      const existing = await User.findOne({ where: { username, id: { [Op.ne]: req.userId } } });
      if (existing) return res.status(400).json({ error: 'Username is already taken' });
    }

    if (name) user.name = name;
    if (username) user.username = username;
    if (avatar !== undefined) user.avatar = avatar;
    await user.save();

    res.json({ id: user.id, name: user.name, email: user.email, username: user.username, avatar: user.avatar });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete user profile
router.delete('/profile', auth, async (req, res) => {
  try {
    const userId = req.userId;
    
    // Delete associations first to avoid foreign key constraint errors
    await Block.destroy({ where: { [Op.or]: [{ blockerId: userId }, { blockedId: userId }] } });
    await Relationship.destroy({ where: { [Op.or]: [{ senderId: userId }, { receiverId: userId }] } });
    await CustomSticker.destroy({ where: { userId } });
    
    // Delete user
    const deleted = await User.destroy({ where: { id: userId } });
    if (!deleted) return res.status(404).json({ error: 'User not found' });
    
    res.json({ message: 'User deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
