export interface LocalArtTheme { id: string; words: readonly string[]; packaged: readonly string[] }
type ArtStatus = 'not-requested' | 'missing' | 'zero' | 'loaded' | 'timeout';

export async function authorLocaleThemes(themes: readonly LocalArtTheme[], options: { preloadMs: number; preset: boolean },
  load: (packaged: readonly string[]) => Promise<number | undefined>) {
  if (new Set(themes.map(theme => theme.id)).size !== themes.length) throw Error('Duplicate theme');
  if (!Number.isSafeInteger(options.preloadMs) || options.preloadMs <= 0) throw Error('Invalid preload deadline');
  return Promise.all(themes.map(async theme => {
    if (!/^[a-zA-Z0-9_-]{1,80}$/.test(theme.id) || theme.words.some(word => !word.trim()) ||
      new Set(theme.packaged).size !== theme.packaged.length || theme.packaged.some(ref => !ref.trim())) throw Error('Malformed theme');
    let status: ArtStatus = 'not-requested', sprites = 0;
    if (!options.preset && theme.packaged.length) {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const deadline = new Promise<'timeout'>(resolve => { timer = setTimeout(() => resolve('timeout'), options.preloadMs); });
        const loaded = await Promise.race([Promise.resolve().then(() => load([...theme.packaged])), deadline]);
        status = loaded === 'timeout' ? 'timeout' : loaded === 0 ? 'zero' : 'missing';
        if (typeof loaded === 'number' && Number.isSafeInteger(loaded) && loaded > 0 && loaded <= theme.packaged.length) {
          sprites = loaded;
          status = 'loaded';
        }
      } catch { status = 'missing'; }
      finally { clearTimeout(timer); }
    }
    const count = theme.words.length ? sprites || theme.words.length : 0;
    const members = Array.from({ length: count }, (_, ordinal) => {
      const wordIndex = ordinal % theme.words.length;
      return { id: `${theme.id}_${ordinal + 1}`, wordIndex, word: theme.words[wordIndex] };
    });
    return { theme: theme.id, requested: !options.preset && theme.packaged.length > 0,
      packaged: [...theme.packaged], effectiveCount: count, loaded: sprites, status, members };
  }));
}
