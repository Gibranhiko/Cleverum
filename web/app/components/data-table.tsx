import React from "react";

interface DataTableProps<T> {
  columns: string[];
  rows: T[];
}

const DataTable = <T,>({ columns, rows }: DataTableProps<T>) => {
  return (
    <table className="min-w-full border">
      <thead>
        <tr>
          {columns.map((col, index) => (
            <th key={index} className="py-2 px-4 border">
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, rowIndex) => (
          <tr key={rowIndex}>
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
  );
};

export default DataTable;
