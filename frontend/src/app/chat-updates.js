import { API } from './api.js';

export async function watchChatUpdates(onUpdate, signal) {
  let token;
  try {
    token = JSON.parse(localStorage.getItem('realstate-session'))?.token;
  } catch {
    return;
  }
  if (!token) return;

  // Reconnect the SSE stream after transient disconnects; notification polling is the fallback.
  while (!signal.aborted) {
    try {
      const response = await fetch(`${API}/api/chats/events`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!response.ok || !response.body)
        throw new Error('Chat updates are temporarily unavailable.');
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      while (!signal.aborted) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const events = buffer.split(/\r?\n\r?\n/);
        buffer = events.pop() || '';
        for (const event of events) {
          const dataLine = event.split(/\r?\n/).find((line) => line.startsWith('data:'));
          if (!dataLine) continue;
          try {
            onUpdate(JSON.parse(dataLine.slice(5).trim()));
          } catch {
            /* Ignore malformed event data. */
          }
        }
      }
      await reader.cancel().catch(() => {});
    } catch {
      if (signal.aborted) return;
    }
    if (!signal.aborted) await new Promise((resolve) => setTimeout(resolve, 1500));
  }
}
