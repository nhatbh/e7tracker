export class EventEmitter<T = any> {
  private listeners: ((val: T) => void)[] = [];
  emit(value: T) {
    this.listeners.forEach(cb => cb(value));
  }
  subscribe(cb: (val: T) => void) {
    this.listeners.push(cb);
    return {
      unsubscribe: () => {
        this.listeners = this.listeners.filter(l => l !== cb);
      }
    };
  }
}

export class BehaviorSubject<T> {
  value: T;
  private listeners: ((val: T) => void)[] = [];

  constructor(val: T) {
    this.value = val;
  }

  next(val: T) {
    this.value = val;
    this.listeners.forEach(cb => cb(val));
  }

  subscribe(cb: (val: T) => void) {
    cb(this.value);
    this.listeners.push(cb);
    return {
      unsubscribe: () => {
        this.listeners = this.listeners.filter(l => l !== cb);
      }
    };
  }
}
