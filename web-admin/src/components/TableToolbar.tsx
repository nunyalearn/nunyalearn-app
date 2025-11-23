"use client";

import { ReactNode } from "react";

type TableToolbarProps = {
  title?: string;
  children?: ReactNode;
  actions?: ReactNode;
};

const TableToolbar = ({ children, actions }: TableToolbarProps) => (
  <div className="border border-[#919D9D]/30">
    <div className="border-b border-[#919D9D]/20 px-4 py-3">
      <h2 className="text-base text-[#004976]">Filters</h2>
    </div>
    <div className="grid gap-4 px-4 py-4 sm:grid-cols-2 xl:grid-cols-4">
      {children}
      {actions}
    </div>
  </div>
);

export default TableToolbar;
