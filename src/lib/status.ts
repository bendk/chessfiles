import { createSignal } from "solid-js";

/**
 * Utility class to track the status of async operations
 */
export class StatusTracker {
  loading: () => boolean;
  message: () => string;
  error: () => boolean;
  private setLoading: (loading: boolean) => void;
  private setMessage: (message: string) => void;
  private setError: (error: boolean) => void;

  constructor() {
    [this.loading, this.setLoading] = createSignal(false);
    [this.message, this.setMessage] = createSignal("");
    [this.error, this.setError] = createSignal(false);
  }

  async perform(description: string, action: () => Promise<void>) {
    this.setError(false);
    this.setMessage(description);
    this.setLoading(true);
    try {
      await action();
    } catch (e) {
      console.log(e);
      this.setError(true);
      this.setMessage(`Error ${description}`);
      return;
    }
    this.setMessage("");
    this.setLoading(false);
  }
}
