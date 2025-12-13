
export class MockLocalStorage {
  private data: Map<string, string> = new Map();

  get length() {
    return this.data.size;
  }

  key(index: number): string | null {
    const iter = this.data.keys();
    for (let i = 0; i < index; i++) {
      iter.next();
    }
    return iter.next().value ?? null;
  }

  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }

  removeItem(key: string) {
    this.data.delete(key);
  }

  clear() {
    this.data.clear();
  }
}

