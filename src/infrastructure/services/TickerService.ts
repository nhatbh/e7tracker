/**
 * Ticker Service Implementation
 * Centralized scheduling service that manages a single global interval
 */

import { invoke } from "@tauri-apps/api/core";
import { ITickerService, TickerTask } from '../../domain/services/ITickerService';
import { IScreenDetectionService } from '../../domain/services/IScreenDetectionService';
import { ScreenType } from '../../domain/models/DetectionSchema';

export class TickerService implements ITickerService {
  private tasks: Map<string, TickerTask> = new Map();
  private intervalId: number | null = null;
  private screenDetection: IScreenDetectionService;

  constructor(screenDetection: IScreenDetectionService) {
    this.screenDetection = screenDetection;
  }

  registerTask(task: TickerTask): void {
    invoke("log_frontend_info", { msg: `[TickerService] Registering task: ${task.id}` }).catch(() => {});
    this.tasks.set(task.id, task);
  }

  unregisterTask(taskId: string): void {
    invoke("log_frontend_info", { msg: `[TickerService] Unregistering task: ${taskId}` }).catch(() => {});
    this.tasks.delete(taskId);
  }

  start(intervalMs: number = 1000): void {
    if (this.intervalId !== null) {
      invoke("log_frontend_info", { msg: `[TickerService] Already running` }).catch(() => {});
      return;
    }

    invoke("log_frontend_info", { msg: `[TickerService] Starting ticker with ${intervalMs}ms interval` }).catch(() => {});
    this.intervalId = setInterval(() => this.tick(), intervalMs) as unknown as number;
  }

  stop(): void {
    if (this.intervalId !== null) {
      invoke("log_frontend_info", { msg: `[TickerService] Stopping ticker` }).catch(() => {});
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  isRunning(): boolean {
    return this.intervalId !== null;
  }

  private async tick(): Promise<void> {
    const currentScreen = this.screenDetection.getCurrentScreen?.() || ScreenType.Unknown;

    for (const [taskId, task] of this.tasks) {
      try {
        if (task.screenCondition(currentScreen)) {
          await task.execute();
        }
      } catch (error) {
        invoke("log_frontend_info", { msg: `[TickerService] Task ${taskId} failed: ${error}` }).catch(() => {});
      }
    }
  }
}
