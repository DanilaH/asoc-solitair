/** Edited line breaks for narrow Russian cards; full semantic text stays intact for inspection. */
const breaks: Record<string, string> = {
  'Текстовыделитель': 'Тексто-\nвыделитель', 'Плоскогубцы': 'Плоско-\nгубцы',
  'Контрабас': 'Контра-\nбас', 'Аккордеон': 'Аккор-\nдеон', 'Троллейбус': 'Троллей-\nбус',
  'Дирижабль': 'Дири-\nжабль', 'Треугольник': 'Тре-\nугольник', 'Прямоугольник': 'Прямо-\nугольник',
  'Пятиугольник': 'Пяти-\nугольник', 'Рассольник': 'Рас-\nсольник',
  'Музыкальные': 'Музы-\nкальные', 'инструменты': 'инстру-\nменты',
  'Инструменты': 'Инстру-\nменты', 'Геометрические': 'Геометри-\nческие', 'Спортивный': 'Спортив-\nный',
};
export function cardCaption(text: string, narrow: boolean): string {
  return text.replace(/\S+/g, word => (narrow || word.length >= 14) ? breaks[word] ?? word : word);
}
