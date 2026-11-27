/**
 * The 1:1 WebRTC connection of a consultation call (browser only, no React).
 *
 * Signalling runs over a Supabase Realtime topic that the server issues to the two participants
 * (joinConsultationCallAction):
 *  - Presence says who is in the room: { peerId, side, joinedAt } per open tab.
 *  - Broadcast "signal" messages carry SDP descriptions, ICE candidates, media state (mic / camera
 *    on or off), "bye" when someone hangs up and "reset" to rebuild a broken connection. Each
 *    message names its sender and receiver (peer ids), so stale tabs are ignored.
 *
 * Offers and answers follow the "perfect negotiation" pattern: both sides may offer at the same
 * time; the client's side is polite (yields) and the lawyer's side is impolite (wins). Media
 * itself goes peer to peer (or through the TURN relay) and never through Supabase or Vercel.
 *
 * One tab per side: if the same person opens the call again elsewhere, the newer tab takes over
 * and the older one is told it was replaced.
 */
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';

export type CallSide = 'client' | 'lawyer';

export type CallPhase =
  /** Subscribing to the room. */
  | 'joining'
  /** In the room, the other person hasn't joined. */
  | 'waiting'
  /** The other person is here; the media connection is being set up. */
  | 'connecting'
  | 'connected'
  /** The connection dropped; trying to restore it. */
  | 'reconnecting'
  /** This person opened the call in another tab or device. */
  | 'replaced'
  /** Hung up. */
  | 'left';

export interface RemoteMediaState {
  mic: boolean;
  cam: boolean;
}

export interface CallEngineEvents {
  onPhase: (phase: CallPhase) => void;
  onRemoteStream: (stream: MediaStream | null) => void;
  onRemoteMedia: (state: RemoteMediaState) => void;
  /** True while the room channel itself is disconnected (network loss). */
  onSignalling?: (ok: boolean) => void;
  /** Path the media took once connected: direct (peer to peer) or through the relay. */
  onRoute?: (route: 'direct' | 'relay' | null) => void;
  onDebug?: (event: string, detail?: unknown) => void;
}

export interface CallEngineOptions extends CallEngineEvents {
  supabase: SupabaseClient;
  topic: string;
  iceServers: RTCIceServer[];
  side: CallSide;
  localStream: MediaStream;
  /** Local mic / camera state to announce. */
  media: RemoteMediaState;
}

type SignalType = 'description' | 'candidate' | 'media' | 'bye' | 'reset';

interface Signal {
  type: SignalType;
  from: string;
  to: string;
  side: CallSide;
  description?: RTCSessionDescriptionInit;
  candidate?: RTCIceCandidateInit | null;
  media?: RemoteMediaState;
}

interface PresenceMeta {
  peerId: string;
  side: CallSide;
  joinedAt: number;
}

/** Restart ICE if a dropped connection hasn't come back after this long. */
const DISCONNECT_RESTART_MS = 4000;
/** Rebuild the whole connection if it is still down after this long. */
const RESET_AFTER_MS = 15000;
const MAX_PENDING_CANDIDATES = 100;

function newPeerId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** Newer wins; ties go to the larger peer id (both sides agree without talking). */
function isNewer(a: PresenceMeta, b: PresenceMeta): boolean {
  return a.joinedAt !== b.joinedAt ? a.joinedAt > b.joinedAt : a.peerId > b.peerId;
}

export class CallEngine {
  readonly peerId = newPeerId();
  private readonly joinedAt = Date.now();
  private readonly opts: CallEngineOptions;
  private readonly polite: boolean;
  private channel: RealtimeChannel | null = null;
  private pc: RTCPeerConnection | null = null;
  private remotePeerId: string | null = null;
  private remoteStream: MediaStream | null = null;
  private makingOffer = false;
  private ignoreOffer = false;
  private pendingCandidates = new Map<string, RTCIceCandidateInit[]>();
  private restartTimer: ReturnType<typeof setTimeout> | null = null;
  private resetTimer: ReturnType<typeof setTimeout> | null = null;
  private phase: CallPhase = 'joining';
  private media: RemoteMediaState;
  private stopped = false;
  private remotePresent = false;
  /** Outgoing tracks chosen with replaceTrack (e.g. a shared screen), used for new connections too. */
  private outgoing: Partial<Record<'audio' | 'video', MediaStreamTrack | null>> = {};

  constructor(opts: CallEngineOptions) {
    this.opts = opts;
    this.polite = opts.side === 'client';
    this.media = { ...opts.media };
  }

  // ─── Lifecycle ─────────────────────────────────────────────────────────────

  start(): void {
    const channel = this.opts.supabase.channel(this.opts.topic, {
      config: { broadcast: { self: false }, presence: { key: this.peerId } },
    });
    this.channel = channel;
    channel
      .on('presence', { event: 'sync' }, () => this.onPresenceSync())
      .on('broadcast', { event: 'signal' }, ({ payload }) => {
        void this.onSignal(payload as Signal);
      })
      .subscribe((status) => {
        if (this.stopped) return;
        this.debug('channel', status);
        if (status === 'SUBSCRIBED') {
          this.opts.onSignalling?.(true);
          // Re-announce after every (re)connect; presence is per socket.
          void channel.track({ peerId: this.peerId, side: this.opts.side, joinedAt: this.joinedAt } satisfies PresenceMeta);
          if (this.phase === 'joining') this.setPhase('waiting');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
          this.opts.onSignalling?.(false);
        }
      });
  }

  /** Hang up: tell the other side, leave the room and close the connection. */
  async stop(reason: 'left' | 'replaced' = 'left'): Promise<void> {
    if (this.stopped) return;
    this.stopped = true;
    this.clearTimers();
    if (this.remotePeerId) this.send('bye', this.remotePeerId);
    this.closePeer();
    const channel = this.channel;
    this.channel = null;
    if (channel) {
      try {
        await channel.untrack();
      } catch {
        // Leaving anyway.
      }
      await this.opts.supabase.removeChannel(channel).catch(() => undefined);
    }
    this.setPhase(reason);
  }

  /** The current peer connection (for diagnostics in development). */
  get connection(): RTCPeerConnection | null {
    return this.pc;
  }

  // ─── Local media ───────────────────────────────────────────────────────────

  /** Announces the local mic / camera state to the other side. */
  setMediaState(media: RemoteMediaState): void {
    this.media = { ...media };
    if (this.remotePeerId) this.send('media', this.remotePeerId, { media: this.media });
  }

  /**
   * Swaps (or removes, with null) the outgoing track of one kind without renegotiating, e.g.
   * turning the camera off and on or switching to the back camera.
   */
  async replaceTrack(kind: 'audio' | 'video', track: MediaStreamTrack | null): Promise<void> {
    this.outgoing[kind] = track;
    const pc = this.pc;
    if (!pc) return;
    const transceiver = pc
      .getTransceivers()
      .find((t) => t.direction !== 'stopped' && t.currentDirection !== 'stopped' && (t.sender.track?.kind === kind || t.receiver.track?.kind === kind));
    if (transceiver) {
      await transceiver.sender.replaceTrack(track);
      if (track && (transceiver.direction === 'recvonly' || transceiver.direction === 'inactive')) {
        transceiver.direction = 'sendrecv'; // renegotiates (negotiationneeded)
      }
      try {
        transceiver.sender.setStreams?.(this.opts.localStream);
      } catch {
        // Older browsers: the stream association doesn't matter for a 1:1 call.
      }
    } else if (track) {
      pc.addTrack(track, this.opts.localStream); // renegotiates
    }
  }

  // ─── Presence ──────────────────────────────────────────────────────────────

  private peersInRoom(): PresenceMeta[] {
    const state = this.channel?.presenceState<PresenceMeta>() ?? {};
    const peers: PresenceMeta[] = [];
    for (const entries of Object.values(state)) {
      for (const meta of entries) {
        if (meta && typeof meta.peerId === 'string' && (meta.side === 'client' || meta.side === 'lawyer')) {
          peers.push({ peerId: meta.peerId, side: meta.side, joinedAt: Number(meta.joinedAt) || 0 });
        }
      }
    }
    return peers;
  }

  private onPresenceSync(): void {
    if (this.stopped) return;
    const peers = this.peersInRoom();
    const me: PresenceMeta = { peerId: this.peerId, side: this.opts.side, joinedAt: this.joinedAt };

    // The same person joined from a newer tab or device: that one takes over.
    if (peers.some((p) => p.side === me.side && p.peerId !== me.peerId && isNewer(p, me))) {
      this.debug('replaced by a newer tab');
      void this.stop('replaced');
      return;
    }

    const others = peers.filter((p) => p.side !== me.side).sort((a, b) => (isNewer(a, b) ? -1 : 1));
    const remote = others[0] ?? null;
    this.remotePresent = !!remote;

    if (!remote) {
      // A connected call survives a brief presence gap (their socket reconnecting); anything
      // else means they left.
      if (this.pc && this.pc.connectionState === 'connected') return;
      if (this.pc) this.closePeer();
      this.setPhase('waiting');
      return;
    }
    if (this.remotePeerId !== remote.peerId) {
      this.createPeer(remote.peerId);
    }
  }

  // ─── Signalling ────────────────────────────────────────────────────────────

  private send(type: SignalType, to: string, extra: Partial<Signal> = {}): void {
    const channel = this.channel;
    if (!channel) return;
    const payload: Signal = { type, from: this.peerId, to, side: this.opts.side, ...extra };
    void channel.send({ type: 'broadcast', event: 'signal', payload }).catch(() => undefined);
  }

  private async onSignal(signal: Signal): Promise<void> {
    if (this.stopped || !signal || signal.to !== this.peerId || signal.side === this.opts.side) return;
    const from = signal.from;

    if (signal.type === 'bye') {
      if (from === this.remotePeerId) {
        this.closePeer();
        this.setPhase('waiting');
      }
      return;
    }
    if (signal.type === 'reset') {
      this.debug('reset requested');
      this.createPeer(from);
      return;
    }
    if (signal.type === 'media') {
      if (from === this.remotePeerId && signal.media) this.opts.onRemoteMedia({ mic: !!signal.media.mic, cam: !!signal.media.cam });
      return;
    }

    // Descriptions and candidates from a peer we have no connection with yet: an offer starts one.
    if (from !== this.remotePeerId) {
      if (signal.type === 'description' && signal.description?.type === 'offer') {
        this.createPeer(from);
      } else if (signal.type === 'candidate' && signal.candidate) {
        this.queueCandidate(from, signal.candidate);
        return;
      } else {
        return;
      }
    }
    const pc = this.pc;
    if (!pc) return;

    try {
      if (signal.type === 'description' && signal.description) {
        const description = signal.description;
        const offerCollision = description.type === 'offer' && (this.makingOffer || pc.signalingState !== 'stable');
        this.ignoreOffer = !this.polite && offerCollision;
        if (this.ignoreOffer) {
          this.debug('ignored colliding offer');
          return;
        }
        await pc.setRemoteDescription(description); // a polite side rolls back its own offer
        await this.flushCandidates(from);
        if (description.type === 'offer') {
          await pc.setLocalDescription();
          if (pc.localDescription) this.send('description', from, { description: pc.localDescription.toJSON() });
        }
      } else if (signal.type === 'candidate') {
        if (!signal.candidate) return;
        if (!pc.remoteDescription) {
          this.queueCandidate(from, signal.candidate);
          return;
        }
        try {
          await pc.addIceCandidate(signal.candidate);
        } catch (err) {
          if (!this.ignoreOffer) this.debug('addIceCandidate failed', err);
        }
      }
    } catch (err) {
      this.debug('signal handling failed', err);
    }
  }

  private queueCandidate(from: string, candidate: RTCIceCandidateInit): void {
    const list = this.pendingCandidates.get(from) ?? [];
    if (list.length < MAX_PENDING_CANDIDATES) list.push(candidate);
    this.pendingCandidates.set(from, list);
  }

  private async flushCandidates(from: string): Promise<void> {
    const pc = this.pc;
    const list = this.pendingCandidates.get(from);
    this.pendingCandidates.delete(from);
    if (!pc || !list) return;
    for (const candidate of list) {
      await pc.addIceCandidate(candidate).catch(() => undefined);
    }
  }

  // ─── Peer connection ───────────────────────────────────────────────────────

  private createPeer(remotePeerId: string): void {
    this.closePeer();
    this.debug('create peer', remotePeerId);
    const pc = new RTCPeerConnection({ iceServers: this.opts.iceServers });
    this.pc = pc;
    this.remotePeerId = remotePeerId;
    this.makingOffer = false;
    this.ignoreOffer = false;
    const remoteStream = new MediaStream();
    this.remoteStream = remoteStream;
    this.setPhase('connecting');

    pc.ontrack = ({ track }) => {
      if (this.pc !== pc) return;
      if (!remoteStream.getTracks().includes(track)) remoteStream.addTrack(track);
      this.opts.onRemoteStream(remoteStream);
    };
    pc.onicecandidate = ({ candidate }) => {
      if (this.pc !== pc || !candidate) return;
      this.send('candidate', remotePeerId, { candidate: candidate.toJSON() });
    };
    pc.onnegotiationneeded = async () => {
      if (this.pc !== pc) return;
      try {
        this.makingOffer = true;
        await pc.setLocalDescription();
        if (this.pc === pc && pc.localDescription) {
          this.send('description', remotePeerId, { description: pc.localDescription.toJSON() });
        }
      } catch (err) {
        this.debug('offer failed', err);
      } finally {
        this.makingOffer = false;
      }
    };
    pc.onconnectionstatechange = () => {
      if (this.pc === pc) this.onConnectionState(pc);
    };
    pc.oniceconnectionstatechange = () => {
      if (this.pc === pc && pc.iceConnectionState === 'failed') this.onConnectionState(pc);
    };

    for (const kind of ['audio', 'video'] as const) {
      const chosen = kind in this.outgoing ? this.outgoing[kind] ?? null : this.opts.localStream.getTracks().find((t) => t.kind === kind) ?? null;
      if (chosen && chosen.readyState === 'live') pc.addTrack(chosen, this.opts.localStream);
    }
  }

  private onConnectionState(pc: RTCPeerConnection): void {
    const state = pc.connectionState;
    this.debug('connection', state);
    if (state === 'connected') {
      this.clearTimers();
      this.setPhase('connected');
      if (this.remotePeerId) this.send('media', this.remotePeerId, { media: this.media });
      void this.reportRoute(pc);
      return;
    }
    if (state === 'disconnected' || state === 'failed') {
      if (!this.remotePresent) {
        // They are gone (closed the tab without saying bye).
        this.closePeer();
        this.setPhase('waiting');
        return;
      }
      this.setPhase('reconnecting');
      if (state === 'failed') this.restartIce(pc);
      else if (!this.restartTimer) {
        this.restartTimer = setTimeout(() => {
          this.restartTimer = null;
          if (this.pc === pc && pc.connectionState !== 'connected') this.restartIce(pc);
        }, DISCONNECT_RESTART_MS);
      }
      if (!this.resetTimer) {
        this.resetTimer = setTimeout(() => {
          this.resetTimer = null;
          if (this.pc !== pc || pc.connectionState === 'connected' || !this.remotePeerId) return;
          // Still down: rebuild on both sides. Only the lawyer's side asks, so the two never race.
          if (!this.polite) {
            const remote = this.remotePeerId;
            this.send('reset', remote);
            this.createPeer(remote);
          }
        }, RESET_AFTER_MS);
      }
    }
  }

  private restartIce(pc: RTCPeerConnection): void {
    this.debug('restart ICE');
    try {
      pc.restartIce(); // fires negotiationneeded with an ICE restart offer
    } catch (err) {
      this.debug('restartIce failed', err);
    }
  }

  /** Whether the media goes direct or through the TURN relay (shown as a hint). */
  private async reportRoute(pc: RTCPeerConnection): Promise<void> {
    if (!this.opts.onRoute) return;
    try {
      const stats = await pc.getStats();
      let pairId: string | null = null;
      stats.forEach((s) => {
        if (s.type === 'transport' && s.selectedCandidatePairId) pairId = s.selectedCandidatePairId;
      });
      let local: { candidateType?: string } | null = null;
      stats.forEach((s) => {
        if (s.type === 'candidate-pair' && (s.id === pairId || (!pairId && s.nominated && s.state === 'succeeded'))) {
          local = stats.get(s.localCandidateId) ?? null;
        }
      });
      const type = (local as { candidateType?: string } | null)?.candidateType;
      this.opts.onRoute(type === 'relay' ? 'relay' : type ? 'direct' : null);
    } catch {
      this.opts.onRoute(null);
    }
  }

  private closePeer(): void {
    this.clearTimers();
    const pc = this.pc;
    this.pc = null;
    this.remotePeerId = null;
    if (pc) {
      pc.ontrack = null;
      pc.onicecandidate = null;
      pc.onnegotiationneeded = null;
      pc.onconnectionstatechange = null;
      pc.oniceconnectionstatechange = null;
      try {
        pc.close();
      } catch {
        // Already closed.
      }
    }
    if (this.remoteStream) {
      this.remoteStream = null;
      this.opts.onRemoteStream(null);
      this.opts.onRoute?.(null);
    }
  }

  private clearTimers(): void {
    if (this.restartTimer) clearTimeout(this.restartTimer);
    if (this.resetTimer) clearTimeout(this.resetTimer);
    this.restartTimer = null;
    this.resetTimer = null;
  }

  private setPhase(phase: CallPhase): void {
    if (this.phase === phase) return;
    if ((this.phase === 'left' || this.phase === 'replaced') && phase !== this.phase) return;
    this.phase = phase;
    this.opts.onPhase(phase);
  }

  private debug(event: string, detail?: unknown): void {
    this.opts.onDebug?.(event, detail);
  }
}
