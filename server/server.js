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
const Group = require('./models/Group');
const GroupMember = require('./models/GroupMember');

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

Group.belongsToMany(User, { through: GroupMember, as: 'Members', foreignKey: 'groupId' });
User.belongsToMany(Group, { through: GroupMember, as: 'Groups', foreignKey: 'userId' });
Group.belongsTo(User, { as: 'Admin', foreignKey: 'adminId' });
GroupMember.belongsTo(User, { as: 'User', foreignKey: 'userId' });
GroupMember.belongsTo(Group, { as: 'Group', foreignKey: 'groupId' });

const app = express();
const server = http.createServer(app);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  credentials: true
}));
app.use(express.json());
const path = require('path');
const supabase = require('./supabase');
// Serve static files (uploads, stickers)
app.use(express.static(path.join(__dirname, 'public')));

// Serve the compiled React frontend
app.use(express.static(path.join(__dirname, '../client/dist')));

const usersRoutes = require('./routes/users');

const friendsRoutes = require('./routes/friends');
const blocksRoutes = require('./routes/blocks');
const stickersRoutes = require('./routes/stickers');
const uploadsRoutes = require('./routes/uploads');
const groupsRoutes = require('./routes/groups');

app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/blocks', blocksRoutes);
app.use('/api/stickers', stickersRoutes);
app.use('/api/uploads', uploadsRoutes);
app.use('/api/groups', groupsRoutes);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST']
  }
});

// Socket.io Authentication Middleware
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error'));
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) return next(new Error('Authentication error'));
    
    const dbUser = await User.findByPk(user.id);
    if (!dbUser) return next(new Error('User not found'));
    
    socket.user = dbUser;
    next();
  } catch (err) {
    next(new Error('Authentication error'));
  }
});

io.on('connection', async (socket) => {
  console.log(`User connected: ${socket.user.name} (${socket.id})`);
  
  // User joins a personal room based on their ID for targeted messaging
  socket.join(socket.user.id.toString());

  // Join group rooms
  try {
    const GroupMember = require('./models/GroupMember');
    const userGroups = await GroupMember.findAll({ where: { userId: socket.user.id } });
    userGroups.forEach(gm => socket.join(gm.groupId.toString()));
  } catch(e) {
    console.error("Error joining group rooms:", e);
  }
  
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
    // Send to receiver (user or group) AND sender's other devices
    socket.to(data.receiverId.toString()).to(socket.user.id.toString()).emit('receive_message', data);
    
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

  socket.on('react_message', (data) => {
    socket.to(data.receiverId.toString()).to(socket.user.id.toString()).emit('message_reacted', data);
  });

  socket.on('typing_start', (data) => {
    socket.to(data.receiverId.toString()).emit('typing_start', { receiverId: data.receiverId, senderId: socket.user.id });
  });

  socket.on('typing_stop', (data) => {
    socket.to(data.receiverId.toString()).emit('typing_stop', { receiverId: data.receiverId, senderId: socket.user.id });
  });

  // WebRTC Signaling (Targeted instead of Broadcast)
  socket.on('offer', (data) => {
    socket.to(data.targetId.toString()).emit('offer', data);
  });

  socket.on('answer', (data) => {
    socket.to(data.targetId.toString()).emit('answer', data);
  });

  socket.on('ice-candidate', (data) => {
    socket.to(data.targetId.toString()).emit('ice-candidate', data);
  });

  socket.on('call_initiated', (data) => {
    socket.to(data.targetId.toString()).emit('call_initiated', data);
  });

  socket.on('call_accepted', (data) => {
    socket.to(data.targetId.toString()).emit('call_accepted', data);
  });

  socket.on('call_rejected', (data) => {
    socket.to(data.targetId.toString()).emit('call_rejected', data);
  });

  socket.on('call_ended', (data) => {
    socket.to(data.targetId.toString()).emit('call_ended', data);
  });
});

// Catch-all route to serve the React app for any other request (SPA routing)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../client/dist/index.html'));
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
