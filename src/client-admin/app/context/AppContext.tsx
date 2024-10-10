import React, { createContext, useContext, ReactNode, useEffect, useState } from "react";
import { io, Socket } from "socket.io-client";
import Order from "../interfaces/Order";

interface AppState {
  isAuthenticated: boolean;
  currentPage: string;
  notifications: Order[];
  orders: Order[];
}

interface AppContextType {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    isAuthenticated: false,
    currentPage: "/",
    notifications: [],
    orders: [],
  });

  // Check auth tomanage context state
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/auth/check-auth');
        const result = await res.json();
        if (result.isAuthenticated) {
          setState(prevState => ({ ...prevState, isAuthenticated: true }));
        }
      } catch (error) {
        console.error('Error checking auth:', error);
      }
    };
    
    checkAuth();
  }, []);

  // Fetch orders when authenticated
  useEffect(() => {
    const fetchOrders = async () => {
      if (!state.isAuthenticated) return;

      try {
        const res = await fetch(`api/orders`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch orders");
        }

        const fetchedOrders: Order[] = await res.json();
        setState(prevState => ({
          ...prevState,
          orders: fetchedOrders,
        }));
      } catch (error) {
        console.error("Error fetching orders:", error);
      }
    };

    fetchOrders();
  }, [state.isAuthenticated]);

  // Handle WebSocket connection for real-time orders when authenticated
  useEffect(() => {
    let socket: Socket;
    if (state.isAuthenticated) {
      socket = io(process.env.PUBLIC_URL, {
        transports: ["websocket"],
      });

      socket.on("new-order", (order: Order) => {
        setState(prevState => ({
          ...prevState,
          notifications: [...prevState.notifications, order],
          orders: [...prevState.orders, order],
        }));
      });
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [state.isAuthenticated]);

  return (
    <AppContext.Provider value={{ state, setState }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useAppContext must be used within an AppProvider");
  }
  return context;
};
