"use client";

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from "react";
import Order from "../interfaces/Order";
import { io } from "socket.io-client";

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

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/orders`, {
          cache: "no-store",
        });

        if (!res.ok) {
          throw new Error("Failed to fetch orders");
        }

        const orders: Order[] = await res.json();
        setState((prevState) => ({
          ...prevState,
          orders,
        }));
      } catch (error) {
        console.error("Error fetching orders:", error);
      }
    };

    fetchOrders();
  }, []);

  useEffect(() => {
    const socket = io(process.env.PUBLIC_URL, {
      transports: ["websocket"],
    });

    socket.on("new-order", (order: Order) => {
      setState((prevState) => ({
        ...prevState,
        notifications: [...prevState.notifications, order],
        orders: [...prevState.orders, order],
      }));
    });

    return () => {
      socket.disconnect();
    };
  }, []);

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
