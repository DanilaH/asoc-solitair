import { showStartupFailure } from './app/startup';

void import('./main').catch(showStartupFailure);
