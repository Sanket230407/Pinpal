// Answers questions about how two users are related. Several routes need the same answers.
import { getBlocks, getConnections } from '../db.js';

export function findBlock(blockerId, blockedId) {
  const block = getBlocks().find(
    (item) => item.blockerId === blockerId && item.blockedId === blockedId
  );
  return block ?? null;
}

export function isBlockedEitherWay(userA, userB) {
  return Boolean(findBlock(userA, userB) || findBlock(userB, userA));
}

// A request can go either way, so both directions are checked.
export function findConnectionBetween(userA, userB) {
  const connection = getConnections().find(
    (item) =>
      (item.fromId === userA && item.toId === userB) ||
      (item.fromId === userB && item.toId === userA)
  );
  return connection ?? null;
}

export function areConnected(userA, userB) {
  return findConnectionBetween(userA, userB)?.status === 'accepted';
}

// Describes the connection from one person's point of view, for choosing which button to show.
export function connectionStatus(viewerId, otherId) {
  const connection = findConnectionBetween(viewerId, otherId);
  if (!connection) {
    return { status: 'none', id: null };
  }
  if (connection.status === 'accepted') {
    return { status: 'connected', id: connection.id };
  }
  const didViewerSend = connection.fromId === viewerId;
  return { status: didViewerSend ? 'sent' : 'received', id: connection.id };
}
