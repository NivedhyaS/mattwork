import React from 'react';

interface Column<T> {
  header: string;
  accessor: keyof T;
  render?: (value: any, row: T) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
}

export function Table<T extends Record<string, any>>({ columns, data }: TableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
      <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-800 text-sm">
        <thead className="bg-slate-100 dark:bg-slate-900">
          <tr>
            {columns.map((col) => (
              <th
                key={String(col.accessor)}
                className="px-4 py-2 text-left font-medium text-slate-600 dark:text-slate-300"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
          {data.map((row, idx) => (
            <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
              {columns.map((col) => (
                <td key={String(col.accessor)} className="px-4 py-2 text-slate-700 dark:text-slate-200">
                  {col.render ? col.render(row[col.accessor], row) : String(row[col.accessor])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
