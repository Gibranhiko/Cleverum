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
  profileData: {
    adminName: string;
    companyName: string;
    companyType: string;
    companyAddress: string;
    companyEmail: string;
    whatsappPhone: string;
    facebookLink: string;
    instagramLink: string;
    imageUrl: string;
    useAi: boolean;
  };
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
    profileData: {
      adminName: "",
      companyName: "",
      companyType: "",
      companyAddress: "",
      companyEmail: "",
      whatsappPhone: "",
      facebookLink: "",
      instagramLink: "",
      imageUrl: "",
      useAi: false,
    },
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

  useEffect(() => {
    if (state.isAuthenticated) {
      const fetchData = async () => {
        try {
          const [ordersRes, profileRes] = await Promise.all([
            fetch("/api/orders", { cache: "no-store" }),
            fetch("/api/profile", { cache: "no-store" }),
          ]);
  
          if (!ordersRes.ok || !profileRes.ok) throw new Error("Error fetching data");
  
          const [orders, profileData] = await Promise.all([ordersRes.json(), profileRes.json()]);
  
          setState((prev) => ({
            ...prev,
            orders,
            profileData,
          }));
        } catch (error) {
          console.error("Error fetching data after authentication:", error);
        }
      };
  
      fetchData();
    }
  }, [state.isAuthenticated]);

  useEffect(() => {
    if (!state.isAuthenticated) return;

    const socket: Socket = io(
      `${process.env.NEXT_PUBLIC_WEB_SOCKET_URL}:${process.env.NEXT_PUBLIC_WEB_SOCKET_PORT}`,
      { transports: ["websocket"] }
    );

    socket.on("new-order", (order: IOrder) => {
      setState((prevState) => ({
        ...prevState,
        notifications: [...prevState.notifications, order],
        orders: [...prevState.orders, order],
      }));
    });

    return () => {
      socket.disconnect();
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
