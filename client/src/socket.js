// src/socket.js
import { io } from "socket.io-client";

// Usa tu URL real si la tienes en .env
const URL = import.meta.env?.VITE_SOCKET_URL || "http://localhost:5000";

export const socket = io(URL, {
  autoConnect: false,
  transports: ["websocket"],
});

export function connectSocketWithToken(token) {
  try {
    if (token) {
      socket.auth = { token };
    }
    if (!socket.connected) {
      socket.connect();
    }
  } catch (e) {
    // silencioso
  }
}

export function disconnectSocket() {
  try {
    if (socket.connected) socket.disconnect();
  } catch (e) {
    // silencioso
  }
}
