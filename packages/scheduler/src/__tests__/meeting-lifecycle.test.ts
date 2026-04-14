// ============================================================================
// Meeting Lifecycle State Machine Tests
// ============================================================================

import { MeetingLifecycle, MeetingLifecycleError, isValidTransition, isTerminalState } from '../meeting-lifecycle';
import type { MeetingLifecycleState } from '@meetscribe/shared';

describe('MeetingLifecycle', () => {
  it('should initialize with scheduled state by default', () => {
    const lifecycle = new MeetingLifecycle('test-run-1');
    expect(lifecycle.getState()).toBe('scheduled');
  });

  it('should allow valid transitions from scheduled', () => {
    const lifecycle = new MeetingLifecycle('test-run-3');
    expect(lifecycle.canTransition('pending')).toBe(true);
    expect(lifecycle.canTransition('cancelled')).toBe(true);
    expect(lifecycle.canTransition('active')).toBe(false);
  });

  it('should perform valid transitions through happy path', () => {
    const lifecycle = new MeetingLifecycle('test-run-4');
    lifecycle.transition('pending');
    lifecycle.transition('joining');
    lifecycle.transition('active');
    lifecycle.transition('ending');
    lifecycle.transition('completed');
    expect(lifecycle.getState()).toBe('completed');
  });

  it('should throw on invalid transitions', () => {
    const lifecycle = new MeetingLifecycle('test-run-5');
    expect(() => lifecycle.transition('active')).toThrow(MeetingLifecycleError);
  });

  it('should throw when transitioning from terminal state', () => {
    const lifecycle = new MeetingLifecycle('test-run-6');
    lifecycle.transition('cancelled');
    expect(() => lifecycle.transition('scheduled')).toThrow(MeetingLifecycleError);
  });

  it('should track transition log', () => {
    const lifecycle = new MeetingLifecycle('test-run-7');
    lifecycle.transition('pending');
    lifecycle.transition('joining');
    const log = lifecycle.getTransitionLog();
    expect(log).toHaveLength(2);
    expect(log[0].from).toBe('scheduled');
    expect(log[0].to).toBe('pending');
  });

  it('should identify terminal states', () => {
    const lifecycle = new MeetingLifecycle('test-run-8');
    expect(lifecycle.isTerminal()).toBe(false);
    lifecycle.transition('cancelled');
    expect(lifecycle.isTerminal()).toBe(true);
  });
});

describe('isValidTransition', () => {
  it('should return true for valid transitions', () => {
    expect(isValidTransition('scheduled', 'pending')).toBe(true);
    expect(isValidTransition('pending', 'joining')).toBe(true);
    expect(isValidTransition('active', 'ending')).toBe(true);
  });

  it('should return false for invalid transitions', () => {
    expect(isValidTransition('scheduled', 'active')).toBe(false);
    expect(isValidTransition('completed', 'scheduled')).toBe(false);
  });
});

describe('isTerminalState', () => {
  it('should identify terminal states', () => {
    expect(isTerminalState('completed')).toBe(true);
    expect(isTerminalState('failed')).toBe(true);
    expect(isTerminalState('cancelled')).toBe(true);
    expect(isTerminalState('scheduled')).toBe(false);
    expect(isTerminalState('active')).toBe(false);
  });
});