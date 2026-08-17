export class CallBudget {
  private used = 0;

  constructor(readonly maximum: number, initialUsed = 0) {
    if (!Number.isInteger(maximum) || maximum < 1) throw new Error("Call budget must be a positive integer.");
    if (!Number.isInteger(initialUsed) || initialUsed < 0 || initialUsed > maximum) throw new Error("Initial call usage must be between zero and the maximum.");
    this.used = initialUsed;
  }

  reserve(label: string): void {
    if (this.used >= this.maximum) throw new Error(`Model-call budget exhausted before ${label}. Maximum: ${this.maximum}.`);
    this.used += 1;
  }

  get usage(): { used: number; maximum: number; remaining: number } {
    return { used: this.used, maximum: this.maximum, remaining: this.maximum - this.used };
  }
}

export async function withRetry<T>(operation: () => Promise<T>, options: { attempts?: number; baseDelayMs?: number; shouldRetry?: (error: unknown) => boolean } = {}): Promise<T> {
  const attempts = options.attempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 750;
  let lastError: unknown;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || (options.shouldRetry && !options.shouldRetry(error))) break;
      const jitter = Math.floor(Math.random() * 200);
      await new Promise((resolve) => setTimeout(resolve, baseDelayMs * 2 ** (attempt - 1) + jitter));
    }
  }

  throw lastError;
}
