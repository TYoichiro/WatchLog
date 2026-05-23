export default class Hls {
  static isSupported() {
    return false;
  }
  loadSource(_url: string) {}
  attachMedia(_media: HTMLVideoElement) {}
  destroy() {}
}
