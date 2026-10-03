import { io } from "socket.io-client";

// Same host/port as the backend, but WITHOUT the /api suffix (sockets connect
// at the server root, not under the REST API path). Derived from VITE_API_URL
// so you only have to configure one env var.
const SOCKET_URL = import.meta.env.VITE_API_URL.replace(/\/api\/?$/, "");

const socket = io(SOCKET_URL, {
  autoConnect: true,
});

export default socket;