'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export interface SelectOption {
  value: string;
  label: string;
}

/**
 * Base UI's `Select.Value` renders the raw value unless the root is told how
 * values map to labels, so `items` is required here rather than optional.
 * `alignItemWithTrigger` is off so the list opens below the control starting at
 * the first option, instead of overlaying the current choice on the trigger.
 */
export function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <Label htmlFor={id} className="field-label">
        {label}
      </Label>
      <Select
        name={id}
        value={value}
        items={options as SelectOption[]}
        onValueChange={(next) => {
          if (next !== null) onChange(String(next));
        }}
      >
        <SelectTrigger id={id} className="w-full bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent alignItemWithTrigger={false}>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/**
 * A labelled numeric field. `unit` is rendered inside the label so it is part
 * of the accessible name instead of being a decorative overlay.
 */
export function NumberField({
  id,
  label,
  unit,
  value,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  label: string;
  unit?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <Label htmlFor={id} className="field-label">
        {label}
        {unit ? <span className="field-unit">{unit}</span> : null}
      </Label>
      <Input
        id={id}
        name={id}
        type="number"
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        min={min}
        max={max}
        step={step}
        value={Number.isFinite(value) ? value : 0}
        onChange={(event) => {
          const next = Number(event.target.value);
          if (Number.isNaN(next)) return;
          onChange(clamp(next, min, max));
        }}
        className="bg-white tabular-nums"
      />
    </div>
  );
}

/** Percent-valued field that stores a 0–1 fraction but edits whole percents. */
export function PercentField({
  id,
  label,
  value,
  max = 100,
  step = 0.1,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  max?: number;
  step?: number;
  onChange: (fraction: number) => void;
}) {
  return (
    <NumberField
      id={id}
      label={label}
      unit="%"
      value={round(value * 100, 4)}
      min={0}
      max={max}
      step={step}
      onChange={(next) => onChange(next / 100)}
    />
  );
}

function clamp(value: number, min: number, max?: number) {
  const lower = Math.max(value, min);
  return max === undefined ? lower : Math.min(lower, max);
}

function round(value: number, places: number) {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}
