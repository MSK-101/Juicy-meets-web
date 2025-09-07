interface DataTableProps {
  columns: Array<{
    key: string;
    label: string;
    render?: (value: unknown, row: Record<string, unknown>) => React.ReactNode;
  }>;
  data: Record<string, unknown>[];
  className?: string;
}

export default function DataTable({ columns, data, className = "" }: DataTableProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-md overflow-hidden ${className}`}>
      <table className="min-w-full">
        <thead className="">
          <tr className="bg-white border-b border-gray-300">
            {columns.map((column) => (
              <th
                key={column.key}
                className="px-6 py-3 text-left text-sm font-semibold text-gray-900 font-poppins"
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-gray-100">
          {data.map((row, index) => (
            <tr key={index} className="border-b border-gray-300 last:border-none">
              {columns.map((column) => (
                <td
                  key={column.key}
                  className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-poppins"
                >
                  {column.render
                    ? column.render(row[column.key], row)
                    : String(row[column.key] || "-")}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
