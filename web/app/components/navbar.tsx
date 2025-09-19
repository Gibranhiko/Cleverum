"use client";

import React, { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { useAppContext } from "../context/AppContext";
import NotificationBell from "./notification-bell";
import DropDown from "./drop-down";
import { useRouter, usePathname } from "next/navigation";

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
  const pathname = usePathname();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [imageError, setImageError] = useState(false);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const toggleMobileMenu = useCallback(() => {
    setIsMobileMenuOpen((prev) => !prev);
  }, []);

  const closeMobileMenu = useCallback(() => {
    setIsMobileMenuOpen(false);
  }, []);

  // Function to map pathname to page title
  const getPageTitleFromPath = useCallback((path: string): string => {
    const pathMap: { [key: string]: string } = {
      '/clientes': 'Clientes',
      '/pedidos': 'Pedidos',
      '/productos': 'Productos',
      '/chatbot': 'Chatbot',
      '/perfil': 'Perfil',
    };
    return pathMap[path] || '';
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

  // Update currentPage based on pathname changes
  useEffect(() => {
    const pageTitle = getPageTitleFromPath(pathname);
    if (pageTitle && pageTitle !== state.currentPage) {
      updateCurrentPage(pageTitle);
    } else if (!pageTitle && pathname !== '/' && state.currentPage) {
      // Clear currentPage if we're on a non-navigation page
      updateCurrentPage('');
    }
    // Close mobile menu when route changes
    setIsMobileMenuOpen(false);
  }, [pathname, getPageTitleFromPath, state.currentPage, updateCurrentPage]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (isMobileMenuOpen && !target.closest('nav')) {
        setIsMobileMenuOpen(false);
      }
    };

    if (isMobileMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isMobileMenuOpen]);

  const getNavLinkClasses = (page: string, isMobile: boolean = false) =>
    `block ${isMobile ? 'px-4 py-2 text-left hover:bg-gray-700' : 'mt-4 lg:inline-block lg:mt-0'} ${
      state.currentPage === page ? (isMobile ? "bg-yellow-400 text-gray-900" : "border-b-2 border-yellow-400") : ""
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
      <div className="flex items-center space-x-8 w-full lg:w-auto">
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
        {/* Desktop Navigation */}
        <ul className="hidden lg:flex space-x-4 ml-8">
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

        {/* Mobile Hamburger Button */}
        <button
          onClick={toggleMobileMenu}
          className="lg:hidden ml-auto mr-4 focus:outline-none"
          aria-label="Toggle mobile menu"
          aria-expanded={isMobileMenuOpen}
        >
          <svg
            className="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            {isMobileMenuOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>

        {/* Mobile Navigation Menu */}
        {isMobileMenuOpen && (
          <div className="lg:hidden absolute top-full left-0 right-0 bg-gray-900 border-t border-gray-700 z-20">
            <ul className="py-2">
              {navMenu.map((item: Menu, index: number) => (
                <li key={index}>
                  <Link
                    href={item.link}
                    className={getNavLinkClasses(item.title, true)}
                    onClick={() => {
                      updateCurrentPage(item.title);
                      closeMobileMenu();
                    }}
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
        )}
      </div>
      <div className="hidden lg:flex items-center space-x-6 z-10">
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

      {/* Mobile User Section */}
      <div className="lg:hidden flex items-center space-x-4 z-10">
        <NotificationBell notifications={currentOrders} />

        <div className="w-8 h-8 rounded-full overflow-hidden bg-white">
          {(!profileData.imageUrl || imageError) ? (
            <div className="w-full h-full bg-blue-500 rounded-full flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
              </svg>
            </div>
          ) : (
            <img
              src={profileData.imageUrl}
              alt="Store Logo"
              width={32}
              height={32}
              onError={() => setImageError(true)}
            />
          )}
        </div>

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
          <div className="absolute top-full right-0 mt-2 w-48 bg-white rounded-md shadow-lg z-50">
            <div className="py-1">
              <div className="px-4 py-2 text-sm text-gray-700 border-b">
                <div className="font-medium">{profileData.companyName || "Company Name"}</div>
              </div>
              {dropDownMenu.map((item, index) => (
                <button
                  key={index}
                  onClick={item.title === "Desconectar" ? handleLogout : () => router.push(item.link)}
                  className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  {item.title}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}
