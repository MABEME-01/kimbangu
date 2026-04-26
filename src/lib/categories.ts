export const CATEGORIES = [
  { value: "adoracao", label: "Adoração a Deus" },
  { value: "alegria", label: "Alegria" },
  { value: "alertas", label: "Alertas de Deus" },
  { value: "casamento", label: "Casamento" },
  { value: "generativas", label: "Generativas / Históricas" },
  { value: "louvor", label: "Louvor a Deus" },
  { value: "morte", label: "Morte" },
  { value: "reflexao", label: "Reflexão" },
  { value: "suplicas", label: "Súplicas ao Senhor" },
] as const;

export type CategoryValue = typeof CATEGORIES[number]["value"];

export const categoryLabel = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v;
