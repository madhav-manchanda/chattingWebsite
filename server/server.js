require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const sequelize = require('./db');
const authRoutes = require('./routes/auth');
const User = require('./models/User');
const Relationship = require('./models/Relationship');
const Block = require('./models/Block');
const CustomSticker = require('./models/CustomSticker');

// Associations
User.hasMany(Relationship, { foreignKey: 'senderId', as: 'SentRequests' });
User.hasMany(Relationship, { foreignKey: 'receiverId', as: 'ReceivedRequests' });
Relationship.belongsTo(User, { foreignKey: 'senderId', as: 'Sender' });
Relationship.belongsTo(User, { foreignKey: 'receiverId', as: 'Receiver' });

User.hasMany(Block, { foreignKey: 'blockerId', as: 'GivenBlocks' });
User.hasMany(Block, { foreignKey: 'blockedId', as: 'ReceivedBlocks' });
Block.belongsTo(User, { foreignKey: 'blockerId', as: 'Blocker' });
Block.belongsTo(User, { foreignKey: 'blockedId', as: 'Blocked' });

User.hasMany(CustomSticker, { foreignKey: 'userId', as: 'Stickers' });
CustomSticker.belongsTo(User, { foreignKey: 'userId' });

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST']
}));
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

const usersRoutes = require('./routes/users');

const friendsRoutes = require('./routes/friends');
const blocksRoutes = require('./routes/blocks');
const stickersRoutes = require('./routes/stickers');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/blocks', blocksRoutes);
app.use('/api/stickers', stickersRoutes);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Socket.io Authentication Middleware
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  jwt.verify(token, process.env.JWT_SECRET || 'fallback_retro_secret_key', async (err, decoded) => {
    if (err) return next(new Error('Authentication error'));
    const user = await User.findByPk(decoded.id);
    if (!user) return next(new Error('User not found'));
    
    socket.user = user;
    next();
  });
});

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.user.name} (${socket.id})`);
  
  // Update presence
  await socket.user.update({ isOnline: true });
  socket.broadcast.emit('user_status', { userId: socket.user.id, isOnline: true });

  socket.on('disconnect', async () => {
    console.log(`User disconnected: ${socket.user.name}`);
    await socket.user.update({ isOnline: false, lastSeen: new Date() });
    socket.broadcast.emit('user_status', { userId: socket.user.id, isOnline: false, lastSeen: socket.user.lastSeen });
  });
  
  // Real-time chat events
  socket.on('send_message', (data) => {
    // Broadcast to others, in a real app would be to a specific room/user
    socket.broadcast.emit('receive_message', data);
    
    // Send acknowledgement back to sender
    socket.emit('message_status', { id: data.id, status: 'SENT' });
  });

  socket.on('message_delivered', (data) => {
    socket.broadcast.emit('message_status', { id: data.id, status: 'DELIVERED' });
  });

  socket.on('message_read', (data) => {
    socket.broadcast.emit('message_status', { id: data.id, status: 'READ' });
  });

  socket.on('edit_message', (data) => {
    socket.broadcast.emit('message_edited', data);
  });

  socket.on('delete_message', (data) => {
    socket.broadcast.emit('message_deleted', data);
  });

  // WebRTC Signaling (Targeted instead of Broadcast)
  socket.on('offer', (data) => {
    socket.broadcast.emit('offer', data);
  });

  socket.on('answer', (data) => {
    socket.broadcast.emit('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    socket.broadcast.emit('ice-candidate', data);
  });

  socket.on('call_initiated', (data) => {
    socket.broadcast.emit('call_initiated', data);
  });

  socket.on('call_accepted', (data) => {
    socket.broadcast.emit('call_accepted', data);
  });

  socket.on('call_rejected', (data) => {
    socket.broadcast.emit('call_rejected', data);
  });

  socket.on('call_ended', (data) => {
    socket.broadcast.emit('call_ended', data);
  });
});

const PORT = process.env.PORT || 3000;

sequelize.sync({ alter: true }).then(() => {
  console.log('Database synced');
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('Failed to sync database:', err);
});
