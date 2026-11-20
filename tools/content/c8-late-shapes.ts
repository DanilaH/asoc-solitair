/** Product-owned late-campaign geometry. See docs/qa/content-v8/CORE_3_LATE.md. */
export const lateShapes = {
  rest: { cards: 44, stock: 28, columns: 3, categories: 8, budget: 84 },
  standard: { cards: 64, stock: 42, columns: 4, categories: 11, budget: 122 },
  hard: { cards: 78, stock: 54, columns: 4, categories: 13, budget: 158 },
  peak: { cards: 96, stock: 62, columns: 5, categories: 15, budget: 191 },
} as const;

export type LateShape = keyof typeof lateShapes;
