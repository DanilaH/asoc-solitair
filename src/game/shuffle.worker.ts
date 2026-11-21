import type { ShuffleRequest } from '../domain/proof-shuffle';
import { proveShuffle } from './shuffle-proof';

self.onmessage = (event: MessageEvent<ShuffleRequest>) => {
  self.postMessage(proveShuffle(event.data));
};
