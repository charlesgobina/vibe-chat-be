import { DelayedActionTool, DelayedAction } from '../tools/delayedActionTool';
import { ChatAgentService } from './chatAgent';
import { Logger } from '../utils/logger';

export interface DelayedActionCallback {
  (sessionId: string, message: string): Promise<void>;
}

export class DelayedActionProcessor {
  private delayedActionTool: DelayedActionTool;
  private isRunning: boolean = false;
  private intervalId?: NodeJS.Timeout;
  private callback?: DelayedActionCallback;
  
  private static readonly POLL_INTERVAL = 5000; // Check every 5 seconds
  private static readonly CLEANUP_INTERVAL = 300000; // Cleanup every 5 minutes

  constructor() {
    this.delayedActionTool = new DelayedActionTool();
  }

  /**
   * Set callback function to handle delayed action execution
   */
  setCallback(callback: DelayedActionCallback): void {
    this.callback = callback;
  }

  /**
   * Start the background processor
   */
  start(): void {
    if (this.isRunning) {
      Logger.warn('DelayedActionProcessor already running');
      return;
    }

    this.isRunning = true;
    Logger.info('Starting DelayedActionProcessor');

    // Main processing interval
    this.intervalId = setInterval(async () => {
      await this.processDelayedActions();
    }, DelayedActionProcessor.POLL_INTERVAL);

    // Cleanup interval
    setInterval(async () => {
      await this.cleanup();
    }, DelayedActionProcessor.CLEANUP_INTERVAL);

    // Initial process
    this.processDelayedActions().catch(error => {
      Logger.error('Error in initial delayed action processing', error);
    });
  }

  /**
   * Stop the background processor
   */
  stop(): void {
    if (!this.isRunning) return;

    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }

    Logger.info('DelayedActionProcessor stopped');
  }

  /**
   * Process all pending delayed actions
   */
  private async processDelayedActions(): Promise<void> {
    try {
      const pendingActions = await this.delayedActionTool.getPendingActions();
      
      if (pendingActions.length === 0) {
        return;
      }

      Logger.debug(`Processing ${pendingActions.length} pending delayed actions`);

      for (const action of pendingActions) {
        await this.executeAction(action);
      }
    } catch (error) {
      Logger.error('Error processing delayed actions', error as Error);
    }
  }

  /**
   * Execute a single delayed action
   */
  private async executeAction(action: DelayedAction): Promise<void> {
    try {
      const now = Date.now();
      
      // Skip if not yet time to execute
      if (action.executeAt > now) {
        return;
      }

      Logger.info('Executing delayed action', { 
        actionId: action.id,
        sessionId: action.sessionId,
        message: action.message,
        scheduledFor: new Date(action.executeAt).toISOString()
      });

      // Execute the callback if available
      if (this.callback) {
        await this.callback(
          action.sessionId,
          action.message
        );
      } else {
        Logger.warn('No callback set for delayed action execution', { actionId: action.id });
      }

      // Mark action as completed
      await this.delayedActionTool.completeAction(action.id);

      Logger.info('Delayed action executed successfully', { 
        actionId: action.id,
        sessionId: action.sessionId
      });

    } catch (error) {
      Logger.error('Error executing delayed action', error as Error, { 
        actionId: action.id,
        sessionId: action.sessionId,
        message: action.message
      });
      
      // Still mark as completed to avoid infinite retry
      await this.delayedActionTool.completeAction(action.id);
    }
  }

  /**
   * Cleanup expired actions
   */
  private async cleanup(): Promise<void> {
    try {
      const cleanedCount = await this.delayedActionTool.cleanup();
      if (cleanedCount > 0) {
        Logger.info(`Cleaned up ${cleanedCount} expired delayed actions`);
      }
    } catch (error) {
      Logger.error('Error during delayed action cleanup', error as Error);
    }
  }

  /**
   * Get processor status
   */
  getStatus(): { isRunning: boolean; pollInterval: number } {
    return {
      isRunning: this.isRunning,
      pollInterval: DelayedActionProcessor.POLL_INTERVAL
    };
  }

  /**
   * Manual trigger for testing
   */
  async triggerManualProcess(): Promise<void> {
    Logger.info('Manual delayed action processing triggered');
    await this.processDelayedActions();
  }
}