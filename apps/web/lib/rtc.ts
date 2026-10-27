// export const SIGNALING = process.env.NEXT_PUBLIC_SIGNALING_URL ?? "ws://localhost:8080";
// export const iceServers = (): RTCIceServer[] => [{ urls: (process.env.NEXT_PUBLIC_STUN_URLS ?? "stun:stun.l.google.com:19302").split(",") }];


export const signalingUrl = (): string =>
  process.env.NEXT_PUBLIC_SIGNALING_URL ||
  `${location.protocol === "https:" ? "wss" : "ws"}://${location.hostname}:8080`;

export const iceServers = (): RTCIceServer[] => [
  { urls: (process.env.NEXT_PUBLIC_STUN_URLS ?? "stun:stun.l.google.com:19302").split(",") },
];