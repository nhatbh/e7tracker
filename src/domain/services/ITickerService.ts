/**
 * Ticker Service Interface
 * Defines a centralized scheduling service for periodic tasks
 */

import { ScreenType } from '../models/DetectionSchema';

/**
 * A task that can be registered with the TickerService
 */
export interface TickerTask {
  /** Unique identifier for this task */
  id: string;
  
  /** Condition to check if this task should run on the current screen */
  screenCondition: (currentScreen: ScreenType) => boolean;
  
  /** The async function to execute when conditions are met */
  execute: () => Promise<void>;
}

/**
 * Ticker Service Interface
 * Manages a single global interval and executes registered tasks based on screen conditions
 */
export interface ITickerService {
  /**
   * Register a task to be executed on each tick
   */
  registerTask(task: TickerTask): void;

  /**
   * Unregister a task by ID
   */
  unregisterTask(taskId: string): void;

  /**
   * Start the ticker with the specified interval
   */
  start(intervalMs?: number): void;

  /**
   * Stop the ticker
   */
  stop(): void;

  /**
   * Check if the ticker is currently running
   */
  isRunning(): boolean;
}
