import profile from './c8-release.json' with { type: 'json' };

export const releaseProfile = import.meta.env?.VITE_ASOC_PROFILE === profile.id ? profile : undefined;
