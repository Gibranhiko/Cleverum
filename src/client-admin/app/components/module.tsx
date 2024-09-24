import React from 'react';

export default function Module({ title, content }) {
  return (
    <div className="bg-white p-6 rounded-lg shadow-lg flex flex-col items-center">
      <h2 className="text-2xl font-bold mb-2">{title}</h2>
      <p className="text-gray-700">{content}</p>
    </div>
  );
}
