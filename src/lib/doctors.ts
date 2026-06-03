export const DOCTORS = [
  "Остап (головний лікар)",
  "Юрій (лікар)",
  "Устим (асистент)",
  "Іван (асистент)",
  "Ірина (асистент)",
] as const

export type DoctorName = (typeof DOCTORS)[number]

export const DOCTOR_COLORS = [
  { bg: "#dbeafe", border: "#2563eb", text: "#1d4ed8" },
  { bg: "#dcfce7", border: "#16a34a", text: "#15803d" },
  { bg: "#fef3c7", border: "#d97706", text: "#b45309" },
  { bg: "#fce7f3", border: "#db2777", text: "#be185d" },
  { bg: "#ede9fe", border: "#7c3aed", text: "#6d28d9" },
] as const

export function doctorColor(doctorName: string) {
  const idx = DOCTORS.indexOf(doctorName as DoctorName)
  return DOCTOR_COLORS[idx >= 0 ? idx : 0]
}
