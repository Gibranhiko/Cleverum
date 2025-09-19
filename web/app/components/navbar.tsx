"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useAppContext } from "../context/AppContext";
import NotificationBell from "./notification-bell";
import DropDown from "./drop-down";
import { useRouter } from "next/navigation";

interface Menu {
  title: string;
  link: string;
}

const navMenu = [
  { title: "Pedidos", link: "/pedidos" },
  { title: "Productos", link: "/productos" },
  { title: "Chatbot", link: "/chatbot" },
  { title: "Clientes", link: "/clientes" },
];

const dropDownMenu = [
  { title: "Perfil", link: "/perfil" },
  { title: "Desconectar", link: "#" },
];

interface Client {
  _id: string;
  name: string;
  description?: string;
  whatsappPhone?: string;
  email?: string;
  isActive: boolean;
}

export default function Navbar() {
  const { state, setState } = useAppContext();
  const { profileData } = state;
  const currentOrders = [
    ...state.orders.filter((order) => order.status === false),
  ];
  const router = useRouter();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
  const [clients, setClients] = useState<Client[]>([]);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const toggleClientDropdown = useCallback(() => {
    setIsClientDropdownOpen((prev) => !prev);
  }, []);

  // Fetch clients when component mounts
  useEffect(() => {
    const fetchClients = async () => {
      if (state.isAuthenticated) {
        try {
          const response = await fetch('/api/clients');
          if (response.ok) {
            const data = await response.json();
            setClients(data);
          }
        } catch (error) {
          console.error('Error fetching clients:', error);
        }
      }
    };

    fetchClients();
  }, [state.isAuthenticated]);

  const handleClientSwitch = (client: Client) => {
    // Update AppContext state
    setState((prevState) => ({
      ...prevState,
      selectedClient: { id: client._id, name: client.name },
      // Clear current data to force refetch for new client
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
    }));

    // Update localStorage
    localStorage.setItem('selectedClientId', client._id);
    localStorage.setItem('selectedClientName', client.name);

    // Close dropdown
    setIsClientDropdownOpen(false);

    // Force page reload to refetch data
    window.location.reload();
  };

  const updateCurrentPage = useCallback(
    (page: string) => {
      setState((prevState) => ({
        ...prevState,
        currentPage: page,
      }));
    },
    [setState]
  );

  const getNavLinkClasses = (page: string) =>
    `block mt-4 lg:inline-block lg:mt-0 ${
      state.currentPage === page ? "border-b-2 border-yellow-400" : ""
    }`;

  const handleLogout = async () => {
    // Call logout API endpoint (clears httpOnly cookie server-side)
    try {
      await fetch("/api/auth/logout", { method: "POST" });

      // Clear localStorage (client-side data only)
      localStorage.removeItem('selectedClientId');
      localStorage.removeItem('selectedClientName');

      // Clear user state
      setState({
        ...state,
        notifications: [],
        orders: [],
        isAuthenticated: false,
        selectedClient: null,
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
      });

      // Redirect to home page (middleware will handle authentication)
      router.push("/");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <nav className="bg-gray-900 text-white p-4 flex items-center justify-between relative">
      <div className="flex items-center space-x-8">
          <img
            src="https://cleverum.nyc3.digitaloceanspaces.com/public/cleverum-brain.png"
            alt="Cleverum Logo"
            width={40}
            height={40}
            className="mr-2"
          />
        <div className="flex flex-col">
          <span className="text-xl font-bold">Cleverum 1.0</span>
          {state.selectedClient && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-300">
                Cliente: {state.selectedClient.name}
              </span>
              <button
                onClick={toggleClientDropdown}
                className="text-xs text-gray-400 hover:text-white focus:outline-none"
                title="Cambiar cliente"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
          )}
        </div>
        <ul className="flex space-x-4 ml-8">
          {navMenu.map((item: Menu, index: number) => (
            <li key={index}>
              <Link
                href={item.link}
                className={getNavLinkClasses(item.title)}
                onClick={() => updateCurrentPage(item.title)}
                aria-current={
                  state.currentPage === item.title ? "page" : undefined
                }
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </div>
      <div className="relative flex items-center space-x-6 z-10">
        <NotificationBell notifications={currentOrders} />

        <div className="w-10 h-10 rounded-full overflow-hidden bg-white">
          <img
            src={
              profileData.imageUrl
                ? profileData.imageUrl
                : "https://cleverum.nyc3.digitaloceanspaces.com/public/logo-company.png"
            }
            alt="Store Logo"
            width={40}
            height={40}
          />
        </div>
        <span className="font-bold">
          {profileData.companyName ? profileData.companyName : "Company Name"}
        </span>
        <button
          onClick={toggleDropdown}
          className="focus:outline-none flex items-center"
          aria-haspopup="true"
          aria-expanded={isDropdownOpen}
        >
          <svg
            className={`w-4 h-4 transition-transform duration-300 ${
              isDropdownOpen ? "transform rotate-180" : "transform rotate-0"
            }`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {isDropdownOpen && (
          <DropDown items={dropDownMenu} handleLogout={handleLogout} />
        )}

        {/* Client Switcher Dropdown */}
        {isClientDropdownOpen && state.selectedClient && (
          <div className="absolute right-0 mt-2 w-64 bg-gray-800 rounded-md shadow-lg z-50 border border-gray-700">
            <div className="py-1">
              <div className="px-4 py-2 text-sm text-gray-300 border-b border-gray-700">
                Cambiar Cliente
              </div>
              {clients.map((client) => (
                <button
                  key={client._id}
                  onClick={() => handleClientSwitch(client)}
                  className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 focus:outline-none ${
                    state.selectedClient?.id === client._id
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{client.name}</span>
                    {state.selectedClient?.id === client._id && (
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  {client.description && (
                    <div className="text-xs text-gray-400 mt-1 truncate">
                      {client.description}
                    </div>
                  )}
                </button>
              ))}
              <div className="border-t border-gray-700 mt-1">
                <Link
                  href="/clientes"
                  className="block w-full text-left px-4 py-2 text-sm text-blue-400 hover:bg-gray-700 focus:outline-none"
                  onClick={() => setIsClientDropdownOpen(false)}
                >
                  Gestionar Clientes
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
