import type { ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  empty,
  onRowClick,
  dense = false,
}: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  dense?: boolean;
}) {
  if (rows.length === 0 && empty) {
    return (
      <div className="rounded-lg border-2 border-dashed border-silver-metal p-6 text-center text-sm text-muted">
        {empty}
      </div>
    );
  }
  const pad = dense ? "px-3 py-1.5" : "px-3 py-2.5";
  return (
    <div className="overflow-x-auto rounded-lg border border-silver-metal">
      <table className="w-full border-collapse text-left text-sm">
        <thead className="sticky top-0 bg-ink text-white">
          <tr>
            {columns.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`${pad} font-semibold whitespace-nowrap ${
                  c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""
                }`}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row)}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={`${i % 2 === 1 ? "bg-silver/60" : "bg-white"} ${
                onRowClick ? "cursor-pointer hover:bg-gold/20" : ""
              } border-t border-silver`}
            >
              {columns.map((c) => (
                <td
                  key={c.key}
                  className={`${pad} align-middle ${c.className ?? ""} ${
                    c.align === "right" ? "text-right" : c.align === "center" ? "text-center" : ""
                  }`}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
