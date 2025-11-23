"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type DifficultyOption = {
  label: string;
  value: string;
};

type DifficultyFilterProps = {
  value: string;
  onChange: (value: string) => void;
  options: DifficultyOption[];
};

const DifficultyFilter = ({ value, onChange, options }: DifficultyFilterProps) => {
  return (
    <div className="space-y-1">
      <label className="text-sm text-muted-foreground">Difficulty</label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="All difficulties" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default DifficultyFilter;
