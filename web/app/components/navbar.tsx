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
  { title: "Clientes", link: "/clientes" },
  { title: "Pedidos", link: "/pedidos" },
  { title: "Productos", link: "/productos" },
  { title: "Chatbot", link: "/chatbot" },
];

const dropDownMenu = [
  { title: "Perfil", link: "/perfil" },
  { title: "Desconectar", link: "#" },
];


export default function Navbar() {
  const { state, setState } = useAppContext();
  const { profileData } = state;
  const currentOrders = [
    ...state.orders.filter((order) => order.status === false),
  ];
  const router = useRouter();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);




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
          {(!profileData.imageUrl || imageError) ? (
            <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          ) : (
            <img
              src={profileData.imageUrl}
              alt="Store Logo"
              width={40}
              height={40}
              onError={() => setImageError(true)}
            />
          )}
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

      </div>
    </nav>
  );
}
