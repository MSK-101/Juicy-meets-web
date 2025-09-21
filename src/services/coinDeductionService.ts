import { api } from '../api/baseAPI';

export interface DeductionRule {
  id: number;
  name: string;
  threshold_seconds: number;
  coins: number;
  deduction_type: 'duration' | 'per_swipe';
}

export interface DeductionResult {
  success: boolean;
  deducted: number;
  new_balance: number;
  applied_rules: Array<{
    threshold: number;
    coins: number;
    rule_name: string;
  }>;
  chat_duration: number;
  error?: string; // Optional error message
}

class CoinDeductionService {
  private activeRules: DeductionRule[] = [];
  private appliedThresholds: Set<number> = new Set();
  private chatStartTime: number | null = null;
  private durationCheckInterval: NodeJS.Timeout | null = null;
  private currentBalance: number = 0;
  private isBalanceZero: boolean = false;
  private lastBalanceCheck: number = 0;

  // Initialize deduction rules
  async initializeDeductionRules(): Promise<void> {
    try {
      const response = await api.get('/video_chat/deduction_rules') as { rules: DeductionRule[] };
      this.activeRules = response.rules || [];
      
    } catch (error) {
      
      this.activeRules = [];
    }
  }

  // Start tracking chat duration
  async startChatDurationTracking(): Promise<void> {
    this.chatStartTime = Date.now();
    this.appliedThresholds.clear();

    // Get initial balance to avoid redundant checks
    await this.updateCurrentBalance();

    // Only start interval checking if user has coins
    if (!this.isBalanceZero) {
      // Check for deductions every second
      this.durationCheckInterval = setInterval(() => {
        this.checkAndApplyDeductions();
      }, 1000);
    } else {
    }
  }

  // Stop tracking chat duration
  stopChatDurationTracking(): void {
    if (this.durationCheckInterval) {
      clearInterval(this.durationCheckInterval);
      this.durationCheckInterval = null;
    }
    this.chatStartTime = null;
    this.appliedThresholds.clear();
    this.isBalanceZero = false; // Reset for next session
  }

  // Check and apply deductions based on current duration - OPTIMIZED
  private async checkAndApplyDeductions(): Promise<void> {
    if (!this.chatStartTime || this.isBalanceZero) return;

    const currentDuration = Math.floor((Date.now() - this.chatStartTime) / 1000);

    // Check each rule to see if we've reached the threshold
    for (const rule of this.activeRules) {
      if (currentDuration === rule.threshold_seconds && !this.appliedThresholds.has(rule.threshold_seconds)) {

        try {
          const result = await this.applyDurationDeduction(currentDuration);

          if (result.success) {
            this.appliedThresholds.add(rule.threshold_seconds);

            // Update cached balance
            this.currentBalance = result.new_balance;
            if (result.new_balance <= 0) {
              this.isBalanceZero = true;
              this.stopDurationTracking();
            }

            // Emit event for UI updates
            this.emitDeductionApplied(result);
          } else {
            // Emit error event for UI feedback
            this.emitDeductionError(result);
          }
        } catch (error) {
          
          // Emit error event for UI feedback
          this.emitDeductionError({
            success: false,
            deducted: 0,
            new_balance: 0,
            applied_rules: [],
            chat_duration: currentDuration,
            error: 'Network error'
          });
        }
      }
    }
  }

  // Apply duration-based deduction
  async applyDurationDeduction(chatDurationSeconds: number): Promise<DeductionResult> {
    try {
      const response = await api.post('/video_chat/apply_duration_deduction', {
        chat_duration_seconds: chatDurationSeconds
      }) as DeductionResult;

      return response;
    } catch (error) {
      
      throw error;
    }
  }

  // Get user's current coin balance
  async getUserBalance(): Promise<number> {
    try {
      const response = await api.get('/video_chat/user_balance') as { balance: number };
      return response.balance;
    } catch (error) {
      
      return 0;
    }
  }

  // Update cached balance efficiently
  private async updateCurrentBalance(): Promise<void> {
    try {
      this.currentBalance = await this.getUserBalance();
      this.isBalanceZero = this.currentBalance <= 0;
      this.lastBalanceCheck = Date.now();

      if (this.isBalanceZero) {
      } else {
      }
    } catch (error) {
      
      this.isBalanceZero = true; // Fail-safe: assume no balance
    }
  }

  // Stop duration tracking interval
  private stopDurationTracking(): void {
    if (this.durationCheckInterval) {
      clearInterval(this.durationCheckInterval);
      this.durationCheckInterval = null;
    }
  }

  // Emit deduction applied event
  private emitDeductionApplied(result: DeductionResult): void {
    const event = new CustomEvent('coinDeductionApplied', {
      detail: result
    });
    window.dispatchEvent(event);
  }

  // Emit deduction error event
  private emitDeductionError(result: DeductionResult): void {
    const event = new CustomEvent('coinDeductionError', {
      detail: result
    });
    window.dispatchEvent(event);
  }

  // Get current chat duration in seconds
  getCurrentChatDuration(): number {
    if (!this.chatStartTime) return 0;
    return Math.floor((Date.now() - this.chatStartTime) / 1000);
  }

  // Get active rules
  getActiveRules(): DeductionRule[] {
    return [...this.activeRules];
  }

  // Check if a threshold has been applied
  isThresholdApplied(threshold: number): boolean {
    return this.appliedThresholds.has(threshold);
  }

  // Get cached balance (avoids API call)
  getCachedBalance(): number {
    return this.currentBalance;
  }

  // Check if user has no coins (cached)
  hasNoCoins(): boolean {
    return this.isBalanceZero;
  }

  // Force refresh balance cache
  async refreshBalance(): Promise<number> {
    await this.updateCurrentBalance();
    return this.currentBalance;
  }
}

export const coinDeductionService = new CoinDeductionService();
