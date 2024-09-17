import Link from "next/link";
import React from "react";

interface DropDownItem {
  title: string;
  link: string;
}

interface DropdownProps {
  items: DropDownItem[];
}

const DropDown: React.FC<DropdownProps> = ({items}) => {
  return (
    <>
      <ul className="absolute right-0 top-full mt-2 w-56 bg-white text-gray-800 shadow-lg rounded-lg z-20">
        {items.map((item: DropDownItem, index: number) => (
          <li key={index} className="hover:bg-gray-200">
            <Link href={item.link} className="block px-4 py-2">
              {item.title}
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
};

export default DropDown;
