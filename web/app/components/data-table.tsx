import React from "react";

interface DataTableProps<T> {
  columns: string[];
  rows: T[];
}

const DataTable = <T,>({ columns, rows }: DataTableProps<T>) => {
  return (
    <>
      {/* Desktop and Tablet Table View */}
      <div className="hidden md:block overflow-x-auto">
        <table className="min-w-full border">
          <thead>
            <tr>
              {columns.map((col, index) => (
                <th key={index} className="py-2 px-4 border bg-gray-50 font-semibold text-left">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-gray-50">
                {columns.map((col, colIndex) => {
                  return row[col] !== null && row[col] !== undefined ? (
                    <td key={colIndex} className="py-2 px-4 border">
                      {row[col]}
                    </td>
                  ) : null;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile Card View */}
      <div className="md:hidden space-y-4">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
            <div className="space-y-2">
              {columns.map((col, colIndex) => {
                if (row[col] !== null && row[col] !== undefined) {
                  return (
                    <div key={colIndex} className="flex justify-between items-start">
                      <span className="font-medium text-gray-600 text-sm mr-2 min-w-0 flex-shrink-0">
                        {col}:
                      </span>
                      <div className="flex-1 text-right break-words">
                        {row[col]}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default DataTable;
