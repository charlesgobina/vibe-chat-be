// import { Tool } from '@langchain/core/tools';
// import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
// import { Logger } from '../utils/logger';
// import Redis from 'ioredis';

// export interface DelayedAction {
//   id: string;
//   sessionId: string;
//   message: string;
//   toolAction?: string;
//   toolQuery?: string;
//   executeAt: number;
//   createdAt: number;
//   completed: boolean;
// }

// export class DelayedActionTool extends Tool {
//   name = "delayed_action";
//   description = `Schedule any prompt or request to be automatically executed after a delay.

// Use this tool when users want to delay ANY request they could normally make:
// - "Tell me the time in 10 seconds" 
// - "Play music in 1 hour"
// - "What's the weather in 5 minutes"
// - "Remind me to drink water in 30 minutes"
// - "Tell me a joke in 2 minutes"

// The tool extracts the main request and schedules it to be re-sent as a new prompt after the specified time.

// Input: The user's complete request with time phrase
// Examples:
// - "Tell me the time in 10 seconds" → schedules "Tell me the time" for 10 seconds later
// - "Play jazz music in 1 hour" → schedules "Play jazz music" for 1 hour later
// - "What's the weather in Paris in 5 minutes" → schedules "What's the weather in Paris" for 5 minutes later

// Supported time formats: 30s, 5m, 2h, 1d (seconds, minutes, hours, days)`;

//   private redis: Redis;
//   private static readonly REDIS_KEY_PREFIX = 'delayed_action:';

//   constructor() {
//     super();
//     this.redis = new Redis({
//       host: process.env.REDIS_HOST || 'localhost',
//       port: parseInt(process.env.REDIS_PORT || '6379'),
//       password: process.env.REDIS_PASSWORD,
//       maxRetriesPerRequest: 3,
//     });

//     this.redis.on('error', (error) => {
//       Logger.error('Redis connection error in DelayedActionTool', error);
//     });
//   }

//   async _call(
//     input: string,
//     runManager?: CallbackManagerForToolRun
//   ): Promise<string> {
//     const requestId = this.generateRequestId();
    
//     try {
//       Logger.info('Delayed action tool invoked', { requestId, input });

//       const parsed = this.parseInput(input);
//       if (!parsed) {
//         return 'I couldn\'t find a valid time phrase in your request. Please include something like "in 5 minutes", "in 30 seconds", etc.';
//       }

//       const { message, delayMs } = parsed;
//       const sessionId = this.getSessionId(runManager);

//       const action: DelayedAction = {
//         id: this.generateActionId(),
//         sessionId,
//         message,
//         executeAt: Date.now() + delayMs,
//         createdAt: Date.now(),
//         completed: false
//       };

//       await this.storeAction(action);

//       const delayText = this.formatDelayText(delayMs);
//       Logger.info('Delayed action scheduled', { 
//         requestId, 
//         actionId: action.id,
//         delayMs,
//         executeAt: new Date(action.executeAt).toISOString()
//       });

//       return `⏰ Scheduled for ${delayText}. I'll handle: "${message}"`;

//     } catch (error) {
//       Logger.error('Delayed action tool error', error as Error, { requestId, input });
//       return `Error scheduling action: ${error instanceof Error ? error.message : 'Unknown error'}`;
//     }
//   }

//   private parseInput(input: string): {
//     message: string;
//     delayMs: number;
//   } | null {
//     // Look for time patterns like "in X seconds", "in X minutes", etc.
//     const timePatterns = [
//       /\bin\s+(\d+)\s+(second|seconds|sec|s)\b/i,
//       /\bin\s+(\d+)\s+(minute|minutes|min|m)\b/i,
//       /\bin\s+(\d+)\s+(hour|hours|hr|h)\b/i,
//       /\bin\s+(\d+)\s+(day|days|d)\b/i,
//     ];

//     let delayMs: number | null = null;
//     let timeMatch: RegExpMatchArray | null = null;

//     // Find the first matching time pattern
//     for (const pattern of timePatterns) {
//       timeMatch = input.match(pattern);
//       if (timeMatch) {
//         const amount = parseInt(timeMatch[1]);
//         const unit = timeMatch[2].toLowerCase();
        
//         // Convert to milliseconds
//         if (unit.startsWith('s')) {
//           delayMs = amount * 1000;
//         } else if (unit.startsWith('m')) {
//           delayMs = amount * 60 * 1000;
//         } else if (unit.startsWith('h')) {
//           delayMs = amount * 60 * 60 * 1000;
//         } else if (unit.startsWith('d')) {
//           delayMs = amount * 24 * 60 * 60 * 1000;
//         }
//         break;
//       }
//     }

//     if (delayMs === null) {
//       return null;
//     }

//     // Remove the time phrase from the input to get the core message
//     const message = input.replace(timeMatch![0], '').trim();
    
//     // Clean up any trailing/leading words like "please" or extra whitespace
//     const cleanMessage = message.replace(/\bplease\b/i, '').trim();

//     return {
//       message: cleanMessage,
//       delayMs
//     };
//   }


//   private formatDelayText(delayMs: number): string {
//     const seconds = Math.floor(delayMs / 1000);
//     const minutes = Math.floor(seconds / 60);
//     const hours = Math.floor(minutes / 60);
//     const days = Math.floor(hours / 24);

//     if (days > 0) return `${days} day${days > 1 ? 's' : ''}`;
//     if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`;
//     if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`;
//     return `${seconds} second${seconds > 1 ? 's' : ''}`;
//   }

//   private async storeAction(action: DelayedAction): Promise<void> {
//     const key = `${DelayedActionTool.REDIS_KEY_PREFIX}${action.id}`;
//     await this.redis.setex(key, Math.ceil((action.executeAt - Date.now()) / 1000) + 60, JSON.stringify(action));
    
//     // Also add to a sorted set for efficient querying
//     await this.redis.zadd('delayed_actions_queue', action.executeAt, action.id);
//   }

//   private getSessionId(runManager?: CallbackManagerForToolRun): string {
//     // Try to get session ID from the current request context
//     // This is a simplified approach - we'll need to pass the session ID properly
//     return global.currentSessionId || 'default_session';
//   }

//   private generateRequestId(): string {
//     return `delayed-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;
//   }

//   private generateActionId(): string {
//     return `action-${Date.now()}-${Math.random().toString(36).substr(2, 8)}`;
//   }

//   // Public method to retrieve pending actions (used by background service)
//   async getPendingActions(sessionId?: string): Promise<DelayedAction[]> {
//     try {
//       const now = Date.now();
//       const actionIds = await this.redis.zrangebyscore('delayed_actions_queue', 0, now);
      
//       const actions: DelayedAction[] = [];
//       for (const actionId of actionIds) {
//         const key = `${DelayedActionTool.REDIS_KEY_PREFIX}${actionId}`;
//         const data = await this.redis.get(key);
        
//         if (data) {
//           const action = JSON.parse(data) as DelayedAction;
//           if (!sessionId || action.sessionId === sessionId) {
//             actions.push(action);
//           }
//         }
//       }
      
//       return actions;
//     } catch (error) {
//       Logger.error('Error retrieving pending actions', error as Error);
//       return [];
//     }
//   }

//   // Public method to mark action as completed
//   async completeAction(actionId: string): Promise<void> {
//     try {
//       const key = `${DelayedActionTool.REDIS_KEY_PREFIX}${actionId}`;
//       await this.redis.del(key);
//       await this.redis.zrem('delayed_actions_queue', actionId);
      
//       Logger.debug('Delayed action completed and removed', { actionId });
//     } catch (error) {
//       Logger.error('Error completing action', error as Error, { actionId });
//     }
//   }

//   // Cleanup expired actions
//   async cleanup(): Promise<number> {
//     try {
//       const now = Date.now();
//       const expiredIds = await this.redis.zrangebyscore('delayed_actions_queue', 0, now - 300000); // 5 minutes ago
      
//       if (expiredIds.length === 0) return 0;

//       const pipeline = this.redis.pipeline();
//       expiredIds.forEach(id => {
//         pipeline.del(`${DelayedActionTool.REDIS_KEY_PREFIX}${id}`);
//         pipeline.zrem('delayed_actions_queue', id);
//       });
      
//       await pipeline.exec();
//       Logger.debug('Cleaned up expired delayed actions', { count: expiredIds.length });
      
//       return expiredIds.length;
//     } catch (error) {
//       Logger.error('Error cleaning up expired actions', error as Error);
//       return 0;
//     }
//   }
// }