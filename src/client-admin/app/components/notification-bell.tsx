import React, { useCallback, useState } from "react";
import { BellIcon } from "@heroicons/react/24/outline";
import Order from "../interfaces/Order";
import DropDown from "./drop-down";
interface NotificationBellProps {
  notifications: Order[];
}

const NotificationBell: React.FC<NotificationBellProps> = ({
  notifications,
}) => {
  const [isDropDownOpen, setIsDropdownOpen] = useState(false);

  const toggleDropdown = useCallback(() => {
    setIsDropdownOpen((prev) => !prev);
  }, []);

  const notificationsList = notifications?.map((notification) => ({
    title: `${notification.nombre} - "${notification.telefono}"`,
    link: "/pedidos",
  }));

  return (
    <>
      <div className="relative">
        <button
          onClick={toggleDropdown}
          className="flex items-center"
          aria-label="Notifications"
        >
          <BellIcon className="h-6 w-6 text-white cursor-pointer" />
          {notifications?.length > 0 && (
            <span className="absolute top-[-0.5rem] right-[-0.5rem] flex items-center justify-center h-4 w-4 text-xs font-bold text-white bg-red-500 rounded-full">
              {notifications.length}
            </span>
          )}
        </button>
        {isDropDownOpen && <DropDown items={notificationsList} />}
      </div>
    </>
  );
};

export default NotificationBell;
