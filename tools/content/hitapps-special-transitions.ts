/** Static source contracts plus explicit caller evidence. Inputs here are not gameplay gestures. */
type Evidence = boolean | 'UNKNOWN';
export type FrozenProbe = {
  version: 1; cardID: string; currentMove: number; layers: number;
  actor: 'ordinary' | 'joker' | 'starter-booster';
  boosterSpendsMove: Evidence; placeOnJokerPositive: Evidence;
  positiveMove: Evidence; canChangeThisMove: Evidence; meltableNow: Evidence;
  boosterHit: Evidence;
  observed?: 'MeltOneLayer' | 'Shatter';
};

export function replayFrozenTransition(probe: FrozenProbe) {
  if (probe.version !== 1 || !probe.cardID || !Number.isSafeInteger(probe.currentMove) || probe.currentMove < 0 ||
      !Number.isSafeInteger(probe.layers) || probe.layers < 0) throw Error('Invalid Frozen trace');
  const { layers, observed } = probe;
  const provenance = { ...probe, moveCost: 'UNKNOWN' } as const;
  if (!observed) return { provenance, state: 'UNRESOLVED', layers } as const;
  if (!layers) throw Error('Frozen trace applies a melt to a clear card');
  // Record the supplied observation. Presence of a Joker or booster is not a predicate.
  const after = observed === 'Shatter' ? 0 : layers - 1;
  return { provenance, state: after === 0 ? 'CLEAR' : 'LAYER_CHANGED', layers: after } as const;
}

export function revealedScissorsDispatch(found: boolean, status?: number) {
  if (!found) return 'NO_SCISSORS';
  if (status === undefined) return 'UNKNOWN_EVALUATOR';
  if (!Number.isSafeInteger(status)) throw Error('Invalid revealed-scissors status');
  switch (status) {
    case 0: return 'DISCARD';
    case 1: return 'CUT';
    case 2: return 'STOP';
    default: return 'RETRY_LOOKUP';
  }
}

type ScissorsState = {
  version: 1; revealed: readonly string[];
  bindings: readonly { upperCardID: string; lowerCardID: string }[];
};
type ScissorsObservation =
  | { kind: 'dispatch'; scissorsCardID: string; status?: number; upperCardID?: string }
  | { kind: 'unbound'; upperCardID: string; lowerCardID: string };

export function replayScissorsTransition(state: ScissorsState, observation: ScissorsObservation) {
  const source = 'NATIVE_STATIC_BOUNDARY';
  const cost = 'UNKNOWN';
  if (observation.kind === 'unbound') {
    const byPair = (entry: ScissorsState['bindings'][number]) => entry.upperCardID === observation.upperCardID &&
      entry.lowerCardID === observation.lowerCardID;
    if (!state.bindings.some(byPair)) return { source, cost, state, fact: 'UNKNOWN_UNBIND' };
    return { source, cost, state: { ...state, bindings: state.bindings.filter(entry => !byPair(entry)) }, fact: 'Unbound' };
  }
  const branch = revealedScissorsDispatch(state.revealed.includes(observation.scissorsCardID), observation.status);
  // Consumption after Cut is unverified. Discard has its own observed effect.
  if (branch === 'DISCARD') return { source, cost, fact: branch,
    state: { ...state, revealed: state.revealed.filter(id => id !== observation.scissorsCardID) } };
  if (branch === 'CUT') {
    const targets = state.bindings.filter(entry => entry.upperCardID === observation.upperCardID);
    if (targets.length !== 1) return { source, cost, state, fact: 'UNKNOWN_TARGET' };
    return { source, cost, state, fact: 'BoundCut', selected: targets[0] };
  }
  return { source, cost, state, fact: branch };
}

export function matchesPuzzleTags(firstTag: number, secondTag: number): boolean {
  if (![firstTag, secondTag].every(tag => Number.isInteger(tag) && tag >= 0 && tag <= 65535)) throw Error('Expected UInt16 pair tags');
  return firstTag !== 0 && firstTag === secondTag;
}

type Part = { id: string; tag: number; cardType: 3 | 4 };
export function recordPuzzleAssembly(parts: readonly Part[], observation: {
  version: 1; movedCardID: string; targetContainerID: string; part1ID: string; part2ID: string;
  assembledCardID: string; assembledCardOrder: number; callerAccepted?: true;
}) {
  const { movedCardID, targetContainerID, part1ID, part2ID, assembledCardID, assembledCardOrder } = observation;
  const first = parts.find(part => part.id === part1ID), second = parts.find(part => part.id === part2ID);
  if (!first || !second || first.id === second.id || !matchesPuzzleTags(first.tag, second.tag)) return { status: 'NO_MATCH' } as const;
  if (!observation.callerAccepted || !targetContainerID || !movedCardID || !assembledCardID ||
      !Number.isSafeInteger(assembledCardOrder)) return { status: 'UNKNOWN_CALLER_RULE' } as const;
  return {
    status: 'ASSEMBLED', fact: 'PuzzleAssembled', assembly: { ...observation },
    physicalPartCount: 2, semanticOutcomeCount: 1, placement: 'UNKNOWN', moveCost: 'UNKNOWN',
  } as const;
}

/** K2 native predicate for resolved event inputs. No mapping to app gesture types. */
export function sourceFrozenPositive(input: {
  firstJoker: Evidence; firstStarter: Evidence; boosterSpendsMove: Evidence;
  discriminator?: number; precedingIndex?: number; precedingJoker: Evidence; placeOnJokerPositive: Evidence;
}): Evidence {
  if (input.firstJoker === true) return false;
  if (input.firstJoker === 'UNKNOWN' || input.firstStarter === 'UNKNOWN') return 'UNKNOWN';
  if (input.firstStarter) return input.boosterSpendsMove;
  if (input.discriminator === undefined) return 'UNKNOWN';
  if (input.discriminator === 3) return true;
  if (input.discriminator !== 2) return input.placeOnJokerPositive;
  if (input.precedingIndex === 0) return true;
  if (!Number.isSafeInteger(input.precedingIndex) || input.precedingIndex! < 1) return 'UNKNOWN';
  if (input.precedingJoker === false || input.placeOnJokerPositive === true) return true;
  return input.precedingJoker === true ? input.placeOnJokerPositive : 'UNKNOWN';
}
