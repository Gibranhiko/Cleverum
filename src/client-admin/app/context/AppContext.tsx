import React, {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { IOrder } from "../api/orders/models/Order";
interface AppState {
  isAuthenticated: boolean;
  currentPage: string;
  notifications: IOrder[];
  orders: IOrder[];
}
interface AppContextType {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  loaders: {[key: string]: boolean};
  setLoader: (key: string, state: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    isAuthenticated: false,
    currentPage: "/",
    notifications: [],
    orders: [],
  });

  const [loaders, setLoaders] = useState<{ [key: string]: boolean }>({});

  const setLoader = (key: string, state: boolean) => {
    setLoaders((prev) => ({ ...prev, [key]: state }));
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/check-auth");
        const result = await res.json();
        if (result.isAuthenticated) {
          setState((prevState) => ({ ...prevState, isAuthenticated: true }));
        }
      } catch (error) {
        console.error("Error checking auth:", error);
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

        const fetchedOrders: IOrder[] = await res.json();
        setState((prevState) => ({
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

      socket.on("new-order", (order: IOrder) => {
        setState((prevState) => ({
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
    <AppContext.Provider value={{ state, setState, loaders, setLoader }}>
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
