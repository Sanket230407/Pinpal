// Real-time delivery with Socket.IO. Browsers only listen here. They send messages through the API.
import { Server } from 'socket.io';
import { getUserById } from './db.js';

let io = null;

export function setUpSocket(httpServer, sessionMiddleware) {
  io = new Server(httpServer);

  // Runs the same session code as Express, so the socket knows who is logged in from their cookie.
  io.engine.use(sessionMiddleware);

  io.use((socket, next) => {
    const userId = socket.request.session?.userId;
    if (!userId || !getUserById(userId)) {
      return next(new Error('Please log in first'));
    }
    socket.data.userId = userId;
    next();
  });

  // A room named after the user lets the server reach all of that person's open tabs.
  io.on('connection', (socket) => {
    socket.join(socket.data.userId);
  });
}

export function sendToUsers(userIds, eventName, payload) {
  // Socket.IO sends only once to a socket that is in more than one of these rooms.
  io.to(userIds).emit(eventName, payload);
}

// Without this, a tab left open after logout would keep receiving messages.
export function disconnectUser(userId) {
  io.in(userId).disconnectSockets();
}
