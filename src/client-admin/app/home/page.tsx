import React from "react";
import Module from "../components/module";
import Navbar from "../components/navbar";

const HomePage = () => {
  return (
    <>
    <Navbar />
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Module title="Module 1" content="This is the content for module 1." />
        <Module title="Module 2" content="This is the content for module 2." />
        <Module title="Module 3" content="This is the content for module 3." />
      </div>
    </div>
    </>
  );
};

export default HomePage;
