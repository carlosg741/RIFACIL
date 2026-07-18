/** Catálogo de monedas soportadas para cobrar rifas (fiat y cripto). */
export const CURRENCY_OPTIONS: { code: string; label: string }[] = [
  { code: "PEN", label: "Soles peruanos (PEN)" },
  { code: "USD", label: "Dólares (USD)" },
  { code: "USDT", label: "Tether (USDT)" },
  { code: "USDC", label: "USD Coin (USDC)" },
  { code: "VES", label: "Bolívares (VES)" },
  { code: "EUR", label: "Euros (EUR)" },
  { code: "COP", label: "Pesos colombianos (COP)" },
  { code: "CLP", label: "Pesos chilenos (CLP)" },
  { code: "BRL", label: "Reales brasileños (BRL)" },
  { code: "MXN", label: "Pesos mexicanos (MXN)" },
  { code: "ARS", label: "Pesos argentinos (ARS)" },
  { code: "BOB", label: "Bolivianos (BOB)" },
  { code: "UYU", label: "Pesos uruguayos (UYU)" },
  { code: "PYG", label: "Guaraníes (PYG)" },
  { code: "DOP", label: "Pesos dominicanos (DOP)" },
  { code: "GTQ", label: "Quetzales (GTQ)" },
  { code: "CRC", label: "Colones (CRC)" },
  { code: "GBP", label: "Libras esterlinas (GBP)" },
  { code: "CAD", label: "Dólares canadienses (CAD)" },
  { code: "BTC", label: "Bitcoin (BTC)" },
];

export function currencyLabel(code: string) {
  const found = CURRENCY_OPTIONS.find((c) => c.code === code);
  return found?.label ?? code;
}
