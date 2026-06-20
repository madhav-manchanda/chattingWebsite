import { db } from '../db/db';

class SyncEngine {
  constructor(socket) {
    this.socket = socket;
    this.isSyncing = false;
    
    // Listen for reconnection to trigger sync
    this.socket.on('connect', () => {
      this.syncOutbox();
    });

    // Listen for message status updates (e.g. SENT, DELIVERED)
    this.socket.on('message_status', async (data) => {
      const msg = await db.messages.get(data.id);
      if (msg) {
        const levels = { 'SENT': 1, 'DELIVERED': 2, 'READ': 3 };
        const currentLevel = levels[msg.status] || 0;
        const newLevel = levels[data.status] || 0;
        
        if (newLevel > currentLevel) {
          await db.messages.update(data.id, { status: data.status, syncStatus: 'synced' });
        }
      }
    });

    // Handle edits and deletions
    this.socket.on('message_edited', async (data) => {
      const msg = await db.messages.get(data.id);
      if (msg) await db.messages.update(data.id, { content: data.content, isEdited: true });
    });

    this.socket.on('message_deleted', async (data) => {
      const msg = await db.messages.get(data.id);
      if (msg) {
        if (data.scope === 'everyone') {
          await db.messages.update(data.id, { isDeleted: true, content: '🚫 This message was deleted.' });
        }
      }
    });

    this.socket.on('message_reacted', async (data) => {
      const msg = await db.messages.get(data.id);
      if (msg) {
        const currentReactions = msg.reactions || {};
        if (data.isAdd) {
          if (!currentReactions[data.emoji]) currentReactions[data.emoji] = [];
          if (!currentReactions[data.emoji].includes(data.userId)) currentReactions[data.emoji].push(data.userId);
        } else {
          if (currentReactions[data.emoji]) {
            currentReactions[data.emoji] = currentReactions[data.emoji].filter(id => id !== data.userId);
            if (currentReactions[data.emoji].length === 0) delete currentReactions[data.emoji];
          }
        }
        await db.messages.update(data.id, { reactions: currentReactions });
      }
    });
  }

  // Save to local DB instantly, then try to send
  async enqueueMessage(messagePayload) {
    // 1. Save locally with PENDING status
    await db.messages.put({
      ...messagePayload,
      status: 'PENDING',
      syncStatus: 'pending'
    });

    // 2. Add to outbox queue
    await db.outbox.add({
      messageId: messagePayload.id,
      payload: messagePayload,
      timestamp: new Date().toISOString()
    });

    // 3. Attempt to sync immediately
    this.syncOutbox();
  }

  // Receive message from others
  async handleIncomingMessage(msg) {
    const exists = await db.messages.get(msg.id);
    if (!exists) {
      await db.messages.put({
        ...msg,
        status: 'DELIVERED',
        syncStatus: 'synced'
      });
    }
  }

  // Process the outbox queue
  async syncOutbox() {
    if (this.isSyncing || !this.socket.connected) return;
    this.isSyncing = true;

    try {
      const pendingItems = await db.outbox.orderBy('timestamp').toArray();
      
      for (const item of pendingItems) {
        if (!this.socket.connected) break;
        
        // Emit via socket
        this.socket.emit('send_message', item.payload);
        
        // Assume success for now, real app uses a callback or ack
        // Remove from outbox
        await db.outbox.delete(item.id);
      }
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      this.isSyncing = false;
    }
  }
}

export default SyncEngine;
