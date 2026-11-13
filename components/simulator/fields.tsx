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
import { useState, type ComponentProps } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpPopover } from '@/components/simulator/help-popover';
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
  helpText,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  helpText: string;
  value: string;
  options: readonly SelectOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="field-label">
          {label}
        </Label>
        <HelpPopover id={id} title={label} description={helpText} />
      </div>
      <Select
        name={id}
        value={value}
        items={options as SelectOption[]}
        onValueChange={(next) => {
          if (next !== null) onChange(String(next));
        }}
      >
        <SelectTrigger id={id} className="w-full bg-card">
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
 * A controlled number input that keeps what the user typed while they edit.
 * Binding a number straight to `value` turns a cleared field into "0", and
 * typing after it leaves "01" on screen because React sees 01 == 1 and skips
 * the update. Valid entries still commit on every keystroke; the draft is
 * dropped on blur so the field settles on the committed, clamped value.
 */
export function NumericInput({
  value,
  onValueChange,
  format,
  ...props
}: Omit<ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> & {
  value: number;
  onValueChange: (value: number) => void;
  /**
   * Shows the committed value formatted (for example with thousands
   * separators). A number input cannot display commas, so a formatted field
   * is a text input that ignores separators when it parses what was typed.
   */
  format?: (value: number) => string;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = Number.isFinite(value)
    ? format
      ? format(value)
      : String(value)
    : '0';

  return (
    <Input
      {...props}
      type={format ? 'text' : 'number'}
      value={draft ?? shown}
      onChange={(event) => {
        const raw = event.target.value;
        setDraft(raw);
        const cleaned = format ? raw.replace(/[,\s]/g, '') : raw;
        if (cleaned.trim() === '') return;
        const next = Number(cleaned);
        if (Number.isFinite(next)) onValueChange(next);
      }}
      onBlur={(event) => {
        setDraft(null);
        props.onBlur?.(event);
      }}
    />
  );
}

/**
 * Wraps an input so its unit sits inside the box, right after the number,
 * instead of in the label where long names pushed it onto a second line. The
 * visible unit is decorative; the label carries it for screen readers.
 */
export function UnitInput({
  unit,
  children,
}: {
  unit?: string;
  children: React.ReactNode;
}) {
  if (!unit) return <>{children}</>;
  return (
    <div
      className="field-control"
      style={{ '--unit-ch': unit.length } as React.CSSProperties}
    >
      {children}
      <span className="field-suffix" aria-hidden="true">
        {unit}
      </span>
    </div>
  );
}

/**
 * A labelled numeric field. `unit` shows inside the input and is also in the
 * label (visually hidden) so it stays part of the accessible name.
 */
export function NumberField({
  id,
  label,
  helpText,
  unit,
  value,
  min = 0,
  max,
  step = 1,
  onChange,
}: {
  id: string;
  label: string;
  helpText: string;
  unit?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="field">
      <div className="flex items-center gap-1.5">
        <Label htmlFor={id} className="field-label">
          {label}
          {unit ? <span className="sr-only">, {unit}</span> : null}
        </Label>
        <HelpPopover id={id} title={label} description={helpText} />
      </div>
      <UnitInput unit={unit}>
        <NumericInput
          id={id}
          name={id}
          inputMode="decimal"
          autoComplete="off"
          spellCheck={false}
          min={min}
          max={max}
          step={step}
          value={value}
          onValueChange={(next) => onChange(clamp(next, min, max))}
          className="bg-card tabular-nums"
        />
      </UnitInput>
    </div>
  );
}

/** Percent-valued field that stores a 0–1 fraction but edits whole percents. */
export function PercentField({
  id,
  label,
  helpText,
  value,
  max = 100,
  step = 0.1,
  onChange,
}: {
  id: string;
  label: string;
  helpText: string;
  value: number;
  max?: number;
  step?: number;
  onChange: (fraction: number) => void;
}) {
  return (
    <NumberField
      id={id}
      label={label}
      helpText={helpText}
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
