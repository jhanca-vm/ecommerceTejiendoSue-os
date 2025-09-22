import { io } from "socket.io-client";

// Asegúrate de que coincida con el backend
const URL = "http://localhost:5000"; 

export const socket = io(URL, {
  autoConnect: false,
  transports: ["websocket"], 
});
