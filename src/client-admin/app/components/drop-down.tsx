import React from "react";

interface DropDownItem {
  title: string;
  link: string;
  onClick?: () => void;
}

interface DropDownProps {
  items: DropDownItem[];
  handleLogout: () => void;
}

const DropDown: React.FC<DropDownProps> = ({ items, handleLogout }) => {
  return (
    <div className="absolute right-0 top-full mt-2 w-56 bg-white text-gray-800 shadow-lg rounded-lg z-20">
      <ul className="list-none p-0 m-0">
        {items.map((item, index) => (
          <li key={index}>
            <a
              href={item.link}
              onClick={(e) => {
                if (item.title === "Desconectar") {
                  e.preventDefault();
                  handleLogout();
                } else if (item.onClick) {
                  e.preventDefault();
                  item.onClick();
                }
              }}
              className="block px-4 py-2 hover:bg-gray-200"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default DropDown;
