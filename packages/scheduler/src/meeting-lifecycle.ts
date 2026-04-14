// ============================================================================
// MeetScribe Meeting Lifecycle State Machine
// ============================================================================

import type { MeetingLifecycleState } from '@meetscribe/shared';
import { MEETING_LIFECYCLE_STATES } from '@meetscribe/shared';
import { logger } from '@meetscribe/logging';

/**
 * Valid transitions for the meeting lifecycle state machine.
 * Each state maps to an array of states it can transition to.
 */
const VALID_TRANSITIONS: Record<MeetingLifecycleState, MeetingLifecycleState[]> = {
  scheduled: ['pending', 'cancelled'],
  pending: ['joining', 'cancelled', 'failed'],
  joining: ['active', 'failed', 'cancelled'],
  active: ['ending', 'failed'],
  ending: ['completed', 'failed'],
  completed: [],
  failed: [],
  cancelled: [],
};

/**
 * Terminal states from which no further transitions are possible.
 */
const TERMINAL_STATES: MeetingLifecycleState[] = ['completed', 'failed', 'cancelled'];

export class MeetingLifecycleError extends Error {
  constructor(
    public readonly fromState: MeetingLifecycleState,
    public readonly toState: MeetingLifecycleState,
    message?: string
  ) {
    super(
      message ?? `Invalid transition from '${fromState}' to '${toState}'`
    );
    this.name = 'MeetingLifecycleError';
  }
}

/**
 * Strict state machine for meeting run lifecycle.
 *
 * Enforces:
 * - Only valid transitions are allowed
 * - Terminal states cannot be exited
 * - All transitions are logged with correlation context
 */
export class MeetingLifecycle {
  private currentState: MeetingLifecycleState;
  private readonly runId: string;
  private transitionLog: Array<{ from: MeetingLifecycleState; to: MeetingLifecycleState; timestamp: string }> = [];

  constructor(runId: string, initialState: MeetingLifecycleState = 'scheduled') {
    this.runId = runId;
    this.currentState = initialState;
    logger.info('MeetingLifecycle: Initialized', { runId, state: initialState });
  }

  /** Get the current state */
  public getState(): MeetingLifecycleState {
    return this.currentState;
  }

  /** Check if the current state is terminal */
  public isTerminal(): boolean {
    return TERMINAL_STATES.includes(this.currentState);
  }

  /** Check if a transition to the given state is valid */
  public canTransition(toState: MeetingLifecycleState): boolean {
    return VALID_TRANSITIONS[this.currentState].includes(toState);
  }

  /** Attempt a state transition. Throws if invalid. */
  public transition(toState: MeetingLifecycleState, reason?: string): void {
    if (this.isTerminal()) {
      throw new MeetingLifecycleError(
        this.currentState,
        toState,
        `Cannot transition from terminal state '${this.currentState}' to '${toState}'`
      );
    }

    if (!this.canTransition(toState)) {
      throw new MeetingLifecycleError(this.currentState, toState);
    }

    const fromState = this.currentState;
    this.currentState = toState;
    const timestamp = new Date().toISOString();

    this.transitionLog.push({ from: fromState, to: toState, timestamp });

    logger.info('MeetingLifecycle: State transition', {
      runId: this.runId,
      from: fromState,
      to: toState,
      reason: reason ?? 'none',
      timestamp,
    });
  }

  /** Get the full transition history */
  public getTransitionLog(): Array<{ from: MeetingLifecycleState; to: MeetingLifecycleState; timestamp: string }> {
    return [...this.transitionLog];
  }

  /** Get all valid next states from the current state */
  public getValidNextStates(): MeetingLifecycleState[] {
    return [...VALID_TRANSITIONS[this.currentState]];
  }

  /** Reset to a given state (for error recovery or testing only) */
  public reset(state: MeetingLifecycleState): void {
    logger.warn('MeetingLifecycle: State reset', {
      runId: this.runId,
      from: this.currentState,
      to: state,
    });
    this.currentState = state;
  }
}

/**
 * Pure function to check if a transition is valid.
 * Useful for validation without creating a state machine instance.
 */
export function isValidTransition(
  from: MeetingLifecycleState,
  to: MeetingLifecycleState
): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

/**
 * Get all valid transitions from a given state.
 */
export function getValidTransitions(
  from: MeetingLifecycleState
): MeetingLifecycleState[] {
  return [...VALID_TRANSITIONS[from]];
}

/**
 * Check if a state is terminal.
 */
export function isTerminalState(state: MeetingLifecycleState): boolean {
  return TERMINAL_STATES.includes(state);
}