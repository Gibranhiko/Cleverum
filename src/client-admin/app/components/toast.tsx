import React from "react";

type ToastProps = {
  type: "success" | "error";
  message: string;
  actionMessage?: React.ReactNode;
};

const Toast: React.FC<ToastProps> = ({ type, message, actionMessage }) => {
  return (
    <div
      className={`px-4 py-3 rounded shadow-md mb-4 max-w-md w-full text-center ${
        type === "success" ? "bg-green-500 text-white" : "bg-red-500 text-white"
      }`}
    >
      {message}
      {actionMessage && <div className="text-sm mt-2">{actionMessage}</div>}
    </div>
  );
};

export default Toast;
