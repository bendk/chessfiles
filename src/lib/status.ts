import { createSignal } from "solid-js";

/**
 * Exception that we'll display the error message directly in the status bar.
 */
export class StatusError extends Error {}

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
      this.setLoading(false);
      if (e instanceof StatusError) {
        this.setMessage(e.toString());
      } else {
        this.setMessage(`Error ${description}`);
      }
      return;
    }
    this.setMessage("");
    this.setLoading(false);
  }
}
