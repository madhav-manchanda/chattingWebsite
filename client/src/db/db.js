import Dexie from 'dexie';

export const db = new Dexie('RetroChatDB');

// Define database schema
db.version(1).stores({
  messages: 'id, content, senderId, timestamp, status, syncStatus',
  outbox: '++id, messageId, payload, timestamp'
});

// Version 2 adds ownerId for multi-user isolation on the same browser
db.version(2).stores({
  messages: 'id, ownerId, content, senderId, timestamp, status, syncStatus',
  outbox: '++id, ownerId, messageId, payload, timestamp'
}).upgrade(tx => {
  // Clear old data as it lacks ownerId
  return tx.table('messages').clear().then(() => tx.table('outbox').clear());
});
