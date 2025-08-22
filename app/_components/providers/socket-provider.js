"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { io as IoClient } from "socket.io-client";

const SocketContext = createContext({
  socket: null,
  connected: false,
});

export const useSocket = () => useContext(SocketContext);

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    // Connect to the backend Socket.IO server as specified in requirements
    const socketUrl = process.env.NEXT_PUBLIC_SOCKET_URL || "http://0.0.0.0:8200";
    console.log("Attempting to connect to Socket.IO server at:", socketUrl);
    const socket = IoClient(socketUrl);

    socket.on("connect", () => {
      console.log("✅ Connected to backend Socket.IO server");
      console.log("Socket ID:", socket.id);
      setConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from backend Socket.IO server");
      setConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Socket connection error:", error);
      console.error("Error details:", {
        message: error.message,
        description: error.description,
        context: error.context
      });
      setConnected(false);
    });

    setSocket(socket);

    return () => {
      console.log("Cleaning up socket connection");
      socket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider
      value={{
        socket,
        connected,
      }}
    >
      {children}
    </SocketContext.Provider>
  );
};
