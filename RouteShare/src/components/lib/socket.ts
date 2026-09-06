import { io, Socket } from 'socket.io-client';
import { API_URL } from '../config';

let socket: Socket | null = null;

// Socket.IO treats a URL path as a namespace, not a REST path — API_URL
// includes /api for fetch calls, which would silently connect to a
// nonexistent "/api" namespace instead of the server's default namespace.
const SOCKET_URL = new URL(API_URL).origin;

export function getSocket() {
  if (!socket) {
    socket = io(SOCKET_URL, { transports: ['websocket'] });
  }
  return socket;
}