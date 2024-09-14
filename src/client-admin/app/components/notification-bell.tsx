import React from "react";
import { BellIcon } from "@heroicons/react/24/outline";

interface NotificationBellProps {
  notifications: number;
  onClick: () => void;
}

const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, onClick }) => {
  return (
    <div className="relative">
      <button
        onClick={onClick}
        className="flex items-center"
        aria-label="Notifications"
      >
        <BellIcon className="h-6 w-6 text-white cursor-pointer" />
        {notifications > 0 && (
          <span className="absolute top-[-0.5rem] right-[-0.5rem] flex items-center justify-center h-4 w-4 text-xs font-bold text-white bg-red-500 rounded-full">
            {notifications}
          </span>
        )}
      </button>
    </div>
  );
};

export default NotificationBell;
