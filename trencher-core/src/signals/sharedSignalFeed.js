import { EventEmitter } from 'events';

class SharedSignalFeed extends EventEmitter {
  constructor() {
    super();
    // Support many agents subscribing
    this.setMaxListeners(1000);
  }

  // Broadcast an enriched signal to all subscribed agents
  broadcast(signal) {
    this.emit('signal', signal);
  }
}

export const sharedSignalFeed = new SharedSignalFeed();
