import * as Select from "@radix-ui/react-select";
import { Check, ChevronDown } from "lucide-react";

type Option<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: Option<T>[];
  onChange: (value: T) => void;
};

export function SelectField<T extends string>({ value, options, onChange }: Props<T>) {
  return (
    <Select.Root value={value} onValueChange={onChange}>
      <Select.Trigger className="select-trigger">
        <Select.Value />
        <Select.Icon><ChevronDown size={15} /></Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content className="select-content" position="popper" sideOffset={5}>
          <Select.Viewport>
            {options.map((option) => (
              <Select.Item className="select-item" key={option.value} value={option.value}>
                <Select.ItemText>{option.label}</Select.ItemText>
                <Select.ItemIndicator><Check size={14} /></Select.ItemIndicator>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}
