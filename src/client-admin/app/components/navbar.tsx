"use client";

import React, { useState, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useAppContext } from "../context/AppContext";
import NotificationBell from "./notification-bell";
import DropDown from "./drop-down";

interface Menu {
  title: string;
  link: string;
}

const navMenu = [
  { title: "Pedidos", link: "/pedidos" },
  { title: "Productos", link: "/productos" },
  { title: "Promociones", link: "/promociones" },
  { title: "Chatbot", link: "/chatbot" },
];

const dropDownMenu = [
  { title: "Perfil", link: "/perfil" },
  { title: "API keys", link: "/api-keys" },
  { title: "Desconectar", link: "/logout" },
];

export default function Navbar() {
  const { state, setState } = useAppContext();
  const currentOrders = [
    ...state.orders.filter((order) => order.status === false),
  ];

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

  return (
    <nav className="bg-gray-900 text-white p-4 flex items-center justify-between relative">
      <div className="flex items-center space-x-8">
        <Image
          src="/images/cleverum-brain.png"
          alt="Cleverum Logo"
          width={40}
          height={40}
          className="mr-2"
        />
        <div className="flex flex-col">
          <Link href="/">
            <span className="text-xl font-bold">Cleverum</span>
          </Link>
          <span className="text-sm font-bold">Restaurant 1.0</span>
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
          <Image
            src="/images/rey-pollo-logo.png"
            alt="Store Logo"
            width={40}
            height={40}
          />
        </div>
        <span className="font-bold">El rey del pollito</span>
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
        {isDropdownOpen && <DropDown items={dropDownMenu} />}
      </div>
    </nav>
  );
}
