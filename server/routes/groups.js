const express = require('express');
const router = express.Router();
const Group = require('../models/Group');
const GroupMember = require('../models/GroupMember');
const User = require('../models/User');
const authenticateToken = require('../middleware/auth');

// Create a new group
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { name, description, memberIds } = req.body;
    
    // Create the group
    const group = await Group.create({
      name,
      description,
      adminId: req.user.id
    });

    // Add creator as admin
    await GroupMember.create({
      groupId: group.id,
      userId: req.user.id,
      role: 'admin'
    });

    // Add other members
    if (memberIds && Array.isArray(memberIds)) {
      const membersToCreate = memberIds
        .filter(id => id !== req.user.id)
        .map(id => ({
          groupId: group.id,
          userId: id,
          role: 'member'
        }));
      if (membersToCreate.length > 0) {
        await GroupMember.bulkCreate(membersToCreate);
      }
    }

    const createdGroup = await Group.findByPk(group.id, {
      include: [{ model: User, as: 'Members', attributes: ['id', 'name', 'username', 'avatar', 'isOnline', 'lastSeen'] }]
    });

    res.status(201).json(createdGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all groups for the current user
router.get('/', authenticateToken, async (req, res) => {
  try {
    const userGroups = await GroupMember.findAll({
      where: { userId: req.user.id },
      attributes: ['groupId']
    });
    const groupIds = userGroups.map(gm => gm.groupId);

    const groups = await Group.findAll({
      where: { id: groupIds },
      include: [{ model: User, as: 'Members', attributes: ['id', 'name', 'username', 'avatar', 'isOnline', 'lastSeen'] }]
    });

    res.json(groups);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add members to an existing group
router.post('/:id/members', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { memberIds } = req.body;

    const group = await Group.findByPk(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    // Ensure requester is admin
    const requesterMember = await GroupMember.findOne({ where: { groupId: id, userId: req.user.id } });
    if (!requesterMember || requesterMember.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can add members' });
    }

    if (memberIds && Array.isArray(memberIds)) {
      // Find existing members to avoid duplicates
      const existingMembers = await GroupMember.findAll({ where: { groupId: id } });
      const existingIds = existingMembers.map(m => m.userId);

      const membersToCreate = memberIds
        .filter(uid => !existingIds.includes(uid))
        .map(uid => ({
          groupId: id,
          userId: uid,
          role: 'member'
        }));
        
      if (membersToCreate.length > 0) {
        await GroupMember.bulkCreate(membersToCreate);
      }
    }

    const updatedGroup = await Group.findByPk(id, {
      include: [{ model: User, as: 'Members', attributes: ['id', 'name', 'username', 'avatar', 'isOnline', 'lastSeen'] }]
    });

    res.json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update group details
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, avatar } = req.body;
    
    const group = await Group.findByPk(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    
    const requesterMember = await GroupMember.findOne({ where: { groupId: id, userId: req.user.id } });
    if (!requesterMember || requesterMember.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can update group details' });
    }

    await group.update({ name, description, avatar });
    
    const updatedGroup = await Group.findByPk(id, {
      include: [{ model: User, as: 'Members', attributes: ['id', 'name', 'username', 'avatar', 'isOnline', 'lastSeen'] }]
    });
    res.json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete group
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const group = await Group.findByPk(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });
    
    const requesterMember = await GroupMember.findOne({ where: { groupId: id, userId: req.user.id } });
    if (!requesterMember || requesterMember.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can delete the group' });
    }

    await GroupMember.destroy({ where: { groupId: id } });
    await group.destroy();
    
    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Leave group
router.post('/:id/leave', authenticateToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    const requesterMember = await GroupMember.findOne({ where: { groupId: id, userId: req.user.id } });
    if (!requesterMember) return res.status(400).json({ error: 'You are not in this group' });

    const group = await Group.findByPk(id);
    if (!group) return res.status(404).json({ error: 'Group not found' });

    const allMembers = await GroupMember.findAll({ where: { groupId: id }, order: [['createdAt', 'ASC']] });
    
    // If last member, delete group
    if (allMembers.length === 1) {
      await GroupMember.destroy({ where: { groupId: id } });
      await group.destroy();
      return res.json({ message: 'Left and deleted empty group' });
    }

    // If admin is leaving and they are the ONLY admin
    if (requesterMember.role === 'admin') {
      const admins = allMembers.filter(m => m.role === 'admin');
      if (admins.length === 1) {
        // Promote the oldest member who is not the current user
        const newAdmin = allMembers.find(m => m.userId !== req.user.id);
        if (newAdmin) {
          await newAdmin.update({ role: 'admin' });
          if (group.adminId === req.user.id) {
            await group.update({ adminId: newAdmin.userId });
          }
        }
      }
    }

    await requesterMember.destroy();
    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Remove member
router.delete('/:id/members/:userId', authenticateToken, async (req, res) => {
  try {
    const { id, userId } = req.params;
    
    const requesterMember = await GroupMember.findOne({ where: { groupId: id, userId: req.user.id } });
    if (!requesterMember || requesterMember.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can remove members' });
    }
    
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Use the leave endpoint to leave the group' });
    }

    await GroupMember.destroy({ where: { groupId: id, userId: userId } });
    
    const updatedGroup = await Group.findByPk(id, {
      include: [{ model: User, as: 'Members', attributes: ['id', 'name', 'username', 'avatar', 'isOnline', 'lastSeen'] }]
    });
    res.json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Change role
router.put('/:id/members/:userId/role', authenticateToken, async (req, res) => {
  try {
    const { id, userId } = req.params;
    const { role } = req.body; // 'admin' or 'member'
    
    if (!['admin', 'member'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const requesterMember = await GroupMember.findOne({ where: { groupId: id, userId: req.user.id } });
    if (!requesterMember || requesterMember.role !== 'admin') {
      return res.status(403).json({ error: 'Only admins can change roles' });
    }
    
    const targetMember = await GroupMember.findOne({ where: { groupId: id, userId: userId } });
    if (!targetMember) return res.status(404).json({ error: 'User is not in this group' });

    await targetMember.update({ role });
    
    const updatedGroup = await Group.findByPk(id, {
      include: [{ model: User, as: 'Members', attributes: ['id', 'name', 'username', 'avatar', 'isOnline', 'lastSeen'] }]
    });
    res.json(updatedGroup);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
