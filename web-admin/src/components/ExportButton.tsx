"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { downloadFile } from "@/lib/api";

type ExportButtonProps = {
  label: string;
  endpoint: string;
  filename: string;
};

const ExportButton = ({ label, endpoint, filename }: ExportButtonProps) => {
  const [pending, setPending] = useState(false);

  const handleExport = async () => {
    try {
      setPending(true);
      await downloadFile(endpoint, filename);
    } finally {
      setPending(false);
    }
  };

  return (
    <Button variant="outline" size="sm" className="gap-2" onClick={handleExport} disabled={pending}>
      <Download className="h-4 w-4" />
      {pending ? "Preparing..." : label}
    </Button>
  );
};

export default ExportButton;
