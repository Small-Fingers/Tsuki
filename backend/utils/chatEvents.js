const subscribers = new Map();

export function subscribeToChatUpdates(userId, response) {
  const key = String(userId);
  const connections = subscribers.get(key) || new Set();
  connections.add(response);
  subscribers.set(key, connections);
  response.write(': connected\n\n');

  return () => {
    connections.delete(response);
    if (connections.size === 0) subscribers.delete(key);
  };
}

export function publishChatUpdate(userIds, chatId) {
  const payload = `event: chat-update\ndata: ${JSON.stringify({ chatId: String(chatId) })}\n\n`;
  for (const userId of new Set(userIds.map(String))) {
    for (const response of subscribers.get(userId) || []) {
      if (response.destroyed || response.writableEnded) continue;
      try { response.write(payload); }
      catch {
        subscribers.get(userId)?.delete(response);
      }
    }
  }
}
