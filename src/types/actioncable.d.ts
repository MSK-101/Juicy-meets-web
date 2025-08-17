declare module '@rails/actioncable' {
  export interface Consumer {
    subscriptions: Subscriptions;
    setUserId(userId: string): void;
  }

  export interface Subscriptions {
    create(params: any, callbacks: any): Subscription;
  }

  export interface Subscription {
    send(data: any): void;
    unsubscribe(): void;
  }

  export function createConsumer(url?: string): Consumer;
}
