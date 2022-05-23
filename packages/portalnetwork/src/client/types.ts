import StrictEventEmitter from 'strict-event-emitter-types/types/src'
import EventEmitter from 'events'
import { IDiscv5CreateOptions, NodeId } from '@chainsafe/discv5'
import { StateNetworkRoutingTable, ProtocolId } from '..'
import { PortalNetworkRoutingTable } from '.'
//eslint-disable-next-line implicit-dependencies/no-implicit
import { LevelUp } from 'levelup'

export interface IPortalNetworkEvents {
  NodeAdded: (nodeId: NodeId, protocolId: ProtocolId) => void
  NodeRemoved: (nodeId: NodeId, protocolId: ProtocolId) => void
  ContentAdded: (key: string, contentType: number, content: string) => void
}

export enum TransportLayer {
  NODE = 'node',
  WEB = 'web',
  MOBILE = 'mobile',
}

export interface PortalNetworkOpts {
  supportedProtocols: ProtocolId[]
  radius?: bigint
  bootnodes?: string[]
  db?: LevelUp
  metrics?: PortalNetworkMetrics
  bindAddress?: string
  transport?: TransportLayer
  proxyAddress?: string
  rebuildFromMemory?: boolean
  config: IDiscv5CreateOptions
}

export type PortalNetworkEventEmitter = StrictEventEmitter<EventEmitter, IPortalNetworkEvents>

export type RoutingTable = PortalNetworkRoutingTable | StateNetworkRoutingTable
interface IGauge {
  inc(value?: number): void
  set(value: number): void
  collect?(): void
}

interface ICounter {
  inc(value?: number): void
}
export interface PortalNetworkMetrics {
  totalContentLookups: ICounter
  knownHistoryNodes: IGauge
  knownDiscv5Nodes: IGauge
  successfulContentLookups: ICounter
  failedContentLookups: ICounter
  offerMessagesSent: ICounter
  offerMessagesReceived: ICounter
  acceptMessagesSent: ICounter
  acceptMessagesReceived: ICounter
  findContentMessagesSent: ICounter
  findContentMessagesReceived: ICounter
  contentMessagesSent: ICounter
  contentMessagesReceived: ICounter
  findNodesMessagesSent: ICounter
  findNodesMessagesReceived: ICounter
  nodesMessagesSent: ICounter
  nodesMessagesReceived: ICounter
  totalBytesReceived: ICounter
  totalBytesSent: ICounter
}
