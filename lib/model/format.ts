const compactCurrencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const currencyFormat = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});
const compactNumberFormat = new Intl.NumberFormat('en-US', {
  notation: 'compact',
  maximumFractionDigits: 1,
});
const wholeFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const percentFormat = new Intl.NumberFormat('en-US', {
  style: 'percent',
  maximumFractionDigits: 1,
});

export const compactCurrency = (value: number) => compactCurrencyFormat.format(value);
export const currency = (value: number) => currencyFormat.format(value);
export const compactNumber = (value: number) => compactNumberFormat.format(value);
export const whole = (value: number) => wholeFormat.format(value);
export const percent = (value: number) => percentFormat.format(value);

