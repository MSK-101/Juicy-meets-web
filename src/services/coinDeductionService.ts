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

  // Initialize deduction rules
  async initializeDeductionRules(): Promise<void> {
    try {
      const response = await api.get('/video_chat/deduction_rules') as { rules: DeductionRule[] };
      this.activeRules = response.rules || [];
      console.log('💰 Loaded deduction rules:', this.activeRules);
    } catch (error) {
      console.error('❌ Failed to load deduction rules:', error);
      this.activeRules = [];
    }
  }

  // Start tracking chat duration
  startChatDurationTracking(): void {
    this.chatStartTime = Date.now();
    this.appliedThresholds.clear();

    // Check for deductions every second
    this.durationCheckInterval = setInterval(() => {
      this.checkAndApplyDeductions();
    }, 1000);

    console.log('⏱️ Started chat duration tracking');
  }

  // Stop tracking chat duration
  stopChatDurationTracking(): void {
    if (this.durationCheckInterval) {
      clearInterval(this.durationCheckInterval);
      this.durationCheckInterval = null;
    }
    this.chatStartTime = null;
    this.appliedThresholds.clear();
    console.log('⏱️ Stopped chat duration tracking');
  }

  // Check and apply deductions based on current duration
  private async checkAndApplyDeductions(): Promise<void> {
    if (!this.chatStartTime) return;

    const currentDuration = Math.floor((Date.now() - this.chatStartTime) / 1000);

    // Check if user has coins before attempting deduction
    const currentBalance = await this.getUserBalance();
    if (currentBalance <= 0) {
      console.log('💰 User has no coins, skipping duration-based deductions');
      return;
    }

    // Check each rule to see if we've reached the threshold
    for (const rule of this.activeRules) {
      if (currentDuration === rule.threshold_seconds && !this.appliedThresholds.has(rule.threshold_seconds)) {
        console.log(`🎯 Chat duration reached ${rule.threshold_seconds}s, applying deduction rule: ${rule.name}`);

        try {
          const result = await this.applyDurationDeduction(currentDuration);

          if (result.success) {
            this.appliedThresholds.add(rule.threshold_seconds);
            console.log(`✅ Applied deduction: ${result.deducted} coins, new balance: ${result.new_balance}`);

            // Emit event for UI updates
            this.emitDeductionApplied(result);
          } else {
            console.warn(`⚠️ Failed to apply deduction for rule ${rule.name}: ${result.error || 'Unknown error'}`);
            // Emit error event for UI feedback
            this.emitDeductionError(result);
          }
        } catch (error) {
          console.error(`❌ Failed to apply deduction for rule ${rule.name}:`, error);
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
      console.error('❌ Failed to apply duration deduction:', error);
      throw error;
    }
  }

  // Get user's current coin balance
  async getUserBalance(): Promise<number> {
    try {
      const response = await api.get('/video_chat/user_balance') as { balance: number };
      return response.balance;
    } catch (error) {
      console.error('❌ Failed to get user balance:', error);
      return 0;
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
}

export const coinDeductionService = new CoinDeductionService();
