'use client';


/**
 * # Fields
 *
 * ## What this file is for
 * This file helps run the simulator experience and shows the controls and results people use to test scenarios.
 *
 * ## What it does
 * - Helps the app show the right page, section, or feature.
 * - Accepts or sends data needed by the rest of the app.
 * - Keeps the code organized so it is easier to understand and update.
 *
 * ## Main pieces in this file
 * - `SelectField`: the main thing this file provides to the app.
 * - Other small helper functions or values support that main work.
 *
 * ## Important tools and connections
 * - Uses project code and libraries that help the app run smoothly.
 * - Works with the rest of the simulator, dashboard, or UI layers.
 *
 * ## How data moves through it
 * Data usually comes in from a user action or from another part of the app. This file reads that information, applies the needed logic, and then sends it on or displays it on screen.
 *
 * ## Errors and edge cases
 * The code checks for missing, unusual, or invalid values and tries to handle them safely. If something is not valid, it usually falls back to a safe default or prevents the bad input from continuing.
 *
 * ## How it fits into the app
 * This file is one small part of the larger system. It connects to other sections so the app feels like one working tool instead of separate pieces.
 *
 * ## Helpful notes
 * The goal here is to keep the code simple, clear, and easy to maintain without changing how the app behaves.
 */
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
