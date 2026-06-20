const express = require('express');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const CustomSticker = require('../models/CustomSticker');

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'fallback_retro_secret_key';

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, '../public/stickers');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure multer
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only images are allowed'));
    }
  }
});

const auth = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Invalid token' });
    req.userId = decoded.id;
    next();
  });
};

// Get user's custom stickers
router.get('/', auth, async (req, res) => {
  try {
    const stickers = await CustomSticker.findAll({
      where: { userId: req.userId },
      order: [['createdAt', 'DESC']]
    });
    res.json(stickers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Upload a new custom sticker
router.post('/upload', auth, upload.single('sticker'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image provided' });
    }

    const imageUrl = `/stickers/${req.file.filename}`;
    const sticker = await CustomSticker.create({
      userId: req.userId,
      imageUrl
    });

    res.json(sticker);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete a custom sticker
router.delete('/:id', auth, async (req, res) => {
  try {
    const sticker = await CustomSticker.findOne({
      where: { id: req.params.id, userId: req.userId }
    });

    if (!sticker) return res.status(404).json({ error: 'Sticker not found' });

    // Try to delete the file
    const filePath = path.join(__dirname, '../public', sticker.imageUrl);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await sticker.destroy();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
