import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';

export const OBSERVED_OPERATIONS = {
  AttendanceAbsenceCron: 'attendance.absence.cron',
  AttendanceQueryReconciliation: 'attendance.reconciliation.query',
  OnboardingStatusCron: 'onboarding.status.cron',
} as const;

export type ObservedOperation =
  (typeof OBSERVED_OPERATIONS)[keyof typeof OBSERVED_OPERATIONS];

export interface OperationMetrics {
  scannedCount?: number;
  createdCount?: number;
  skippedCount?: number;
  failedCount?: number;
  modifiedCount?: number;
}

interface OperationRun {
  id: string;
  operation: ObservedOperation;
  trigger: 'cron' | 'query';
  startedAt: Date;
}

export interface OperationSnapshot {
  operation: ObservedOperation;
  activeRuns: number;
  totalRuns: number;
  totalFailures: number;
  consecutiveFailures: number;
  lastStatus: 'success' | 'failed' | null;
  lastTrigger: 'cron' | 'query' | null;
  lastStartedAt: string | null;
  lastCompletedAt: string | null;
  lastDurationMs: number | null;
  lastMetrics: OperationMetrics | null;
  lastError: string | null;
}

interface MutableOperationState {
  activeRuns: number;
  totalRuns: number;
  totalFailures: number;
  consecutiveFailures: number;
  lastStatus: 'success' | 'failed' | null;
  lastTrigger: 'cron' | 'query' | null;
  lastStartedAt: Date | null;
  lastCompletedAt: Date | null;
  lastDurationMs: number | null;
  lastMetrics: OperationMetrics | null;
  lastError: string | null;
}

@Injectable()
export class OperationMonitorService {
  private readonly states = new Map<ObservedOperation, MutableOperationState>();

  start(
    operation: ObservedOperation,
    trigger: OperationRun['trigger'],
  ): OperationRun {
    const run: OperationRun = {
      id: randomUUID(),
      operation,
      trigger,
      startedAt: new Date(),
    };
    const state = this.getOrCreateState(operation);
    state.activeRuns += 1;
    state.lastStartedAt = run.startedAt;
    state.lastTrigger = trigger;
    return run;
  }

  succeed(run: OperationRun, metrics: OperationMetrics = {}): void {
    const state = this.getOrCreateState(run.operation);
    const completedAt = new Date();
    state.activeRuns = Math.max(0, state.activeRuns - 1);
    state.totalRuns += 1;
    state.consecutiveFailures = 0;
    state.lastStatus = 'success';
    state.lastTrigger = run.trigger;
    state.lastStartedAt = run.startedAt;
    state.lastCompletedAt = completedAt;
    state.lastDurationMs = completedAt.getTime() - run.startedAt.getTime();
    state.lastMetrics = metrics;
    state.lastError = null;
  }

  fail(run: OperationRun, error: unknown): void {
    const state = this.getOrCreateState(run.operation);
    const completedAt = new Date();
    state.activeRuns = Math.max(0, state.activeRuns - 1);
    state.totalRuns += 1;
    state.totalFailures += 1;
    state.consecutiveFailures += 1;
    state.lastStatus = 'failed';
    state.lastTrigger = run.trigger;
    state.lastStartedAt = run.startedAt;
    state.lastCompletedAt = completedAt;
    state.lastDurationMs = completedAt.getTime() - run.startedAt.getTime();
    state.lastMetrics = null;
    state.lastError = this.sanitizeError(error);
  }

  getSnapshot(): OperationSnapshot[] {
    return Object.values(OBSERVED_OPERATIONS).map((operation) => {
      const state = this.getOrCreateState(operation);
      return {
        operation,
        activeRuns: state.activeRuns,
        totalRuns: state.totalRuns,
        totalFailures: state.totalFailures,
        consecutiveFailures: state.consecutiveFailures,
        lastStatus: state.lastStatus,
        lastTrigger: state.lastTrigger,
        lastStartedAt: state.lastStartedAt?.toISOString() ?? null,
        lastCompletedAt: state.lastCompletedAt?.toISOString() ?? null,
        lastDurationMs: state.lastDurationMs,
        lastMetrics: state.lastMetrics,
        lastError: state.lastError,
      };
    });
  }

  private getOrCreateState(
    operation: ObservedOperation,
  ): MutableOperationState {
    const existing = this.states.get(operation);
    if (existing) {
      return existing;
    }

    const state: MutableOperationState = {
      activeRuns: 0,
      totalRuns: 0,
      totalFailures: 0,
      consecutiveFailures: 0,
      lastStatus: null,
      lastTrigger: null,
      lastStartedAt: null,
      lastCompletedAt: null,
      lastDurationMs: null,
      lastMetrics: null,
      lastError: null,
    };
    this.states.set(operation, state);
    return state;
  }

  private sanitizeError(error: unknown): string {
    const message = error instanceof Error ? error.message : 'unknown error';
    return message.replaceAll(/\s+/g, ' ').slice(0, 200);
  }
}
