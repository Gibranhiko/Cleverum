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
  selectedClient: {
    id: string;
    name: string;
    imageUrl?: string;
  } | null;
  loading: boolean;
}

interface AppContextType {
  state: AppState;
  setState: React.Dispatch<React.SetStateAction<AppState>>;
  loaders: { [key: string]: boolean };
  setLoader: (key: string, state: boolean) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [state, setState] = useState<AppState>({
    isAuthenticated: false,
    currentPage: "/",
    notifications: [],
    orders: [],
    selectedClient: null,
    loading: true, // Nuevo estado para manejar carga inicial
  });

  const [loaders, setLoaders] = useState<{ [key: string]: boolean }>({});

  const setLoader = (key: string, state: boolean) => {
    setLoaders((prev) => ({ ...prev, [key]: state }));
  };

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const res = await fetch("/", { method: "HEAD" }); // Fetch headers only
        const isAuthenticated = res.headers.get("X-Authenticated") === "true";
  
        if (!isAuthenticated) {
          setState((prev) => ({ ...prev, isAuthenticated: false, loading: false }));
          return;
        }
  
        // If authenticated, set isAuthenticated to true
        setState((prev) => ({ ...prev, isAuthenticated: true, loading: false }));
      } catch (error) {
        console.error("Error checking auth status:", error);
        setState((prev) => ({ ...prev, loading: false }));
      }
    };
  
    checkAuthStatus();
  }, []);

  // No longer persist selected client - rely on API data only

  // Effect to fetch orders when selectedClient changes
  useEffect(() => {
    if (state.isAuthenticated && state.selectedClient?.id) {
      const fetchOrders = async () => {
        try {
          const ordersUrl = `/api/orders?clientId=${state.selectedClient.id}`;

          const ordersRes = await fetch(ordersUrl, { cache: "no-store" });

          if (!ordersRes.ok) throw new Error("Error fetching orders");

          const orders = await ordersRes.json();

          setState((prev) => ({
            ...prev,
            orders: orders.filter(order => order != null),
            notifications: [], // Clear notifications for new client
          }));
        } catch (error) {
          console.error("Error fetching orders:", error);
        }
      };

      fetchOrders();
    } else if (!state.selectedClient) {
      // Clear orders if no client
      setState((prev) => ({
        ...prev,
        orders: [],
        notifications: [],
      }));
    }
  }, [state.selectedClient?.id, state.isAuthenticated]);

  useEffect(() => {
    if (!state.isAuthenticated) return;

    const socket: Socket = io(
      `${process.env.NEXT_PUBLIC_WEB_SOCKET_URL}:${process.env.NEXT_PUBLIC_WEB_SOCKET_PORT}`,
      { transports: ["websocket"] }
    );

    // Join client-specific room if client is selected
    const clientId = state.selectedClient?.id;
    if (clientId) {
      socket.emit("join-client", clientId);
    }

    socket.on("new-order", (data: { clientId?: string; order: IOrder }) => {
      // Only process orders for the current client
      if (data && (!clientId || (data.clientId && data.clientId === clientId)) && data.order) {
        setState((prevState) => ({
          ...prevState,
          notifications: [...prevState.notifications, data.order],
          orders: [...prevState.orders, data.order],
        }));
      }
    });

    // Listen for client-specific order events
    if (clientId) {
      socket.on(`new-order-${clientId}`, (order: IOrder) => {
        if (order && order.clientId === clientId) {
          setState((prevState) => ({
            ...prevState,
            notifications: [...prevState.notifications, order],
            orders: [...prevState.orders, order],
          }));
        }
      });
    }

    return () => {
      if (clientId) {
        socket.emit("leave-client", clientId);
      }
      socket.disconnect();
    };
  }, [state.isAuthenticated, state.selectedClient]);

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
