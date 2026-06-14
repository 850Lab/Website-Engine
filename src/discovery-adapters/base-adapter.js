export class DiscoveryAdapter {
  constructor({ id, name, description, enabled = false }) {
    this.id = id;
    this.name = name;
    this.description = description;
    this.enabled = enabled;
  }

  async discover(_config) {
    throw new Error(`${this.id} adapter discover() not implemented`);
  }
}
