import debug, { Debugger } from 'debug'
import { PortalNetwork } from '../../client/client.js'
import { BaseProtocol } from '../protocol.js'
import { ProtocolId } from '../types.js'
import { toHexString } from '@chainsafe/ssz'
import { bytesToInt, hexToBytes } from '@ethereumjs/util'
import { ENR } from '@chainsafe/discv5'
import { shortId } from '../../util/util.js'
import { RequestCode } from '../../wire/index.js'
import {
  FindContentMessage,
  PortalWireMessageType,
  MessageCodes,
  ContentMessageType,
  FoundContent,
} from '../../wire/types.js'
import { decodeHistoryNetworkContentKey } from '../history/util.js'
import { StateNetworkContentType } from './types.js'

export class StateProtocol extends BaseProtocol {
  protocolId: ProtocolId.StateNetwork
  protocolName = 'StateNetwork'
  logger: Debugger
  constructor(client: PortalNetwork, nodeRadius?: bigint) {
    super(client, nodeRadius)
    this.protocolId = ProtocolId.StateNetwork
    this.logger = debug(this.enr.nodeId.slice(0, 5)).extend('Portal').extend('StateNetwork')
    this.routingTable.setLogger(this.logger)
    client.uTP.on(ProtocolId.StateNetwork, async (contentKey: Uint8Array, content: Uint8Array) => {
      await this.stateStore(toHexString(contentKey), toHexString(content))
    })
  }

  /**
   * Send FINDCONTENT request for content corresponding to `key` to peer corresponding to `dstId`
   * @param dstId node id of peer
   * @param key content key defined by the subprotocol spec
   * @returns the value of the FOUNDCONTENT response or undefined
   */
  public sendFindContent = async (dstId: string, key: Uint8Array) => {
    const enr = dstId.startsWith('enr:')
      ? ENR.decodeTxt(dstId)
      : this.routingTable.getWithPending(dstId)?.value
      ? this.routingTable.getWithPending(dstId)?.value
      : this.routingTable.getWithPending(dstId.slice(2))?.value
    if (!enr) {
      this.logger(`No ENR found for ${shortId(dstId)}.  FINDCONTENT aborted.`)
      return
    }
    this.metrics?.findContentMessagesSent.inc()
    const findContentMsg: FindContentMessage = { contentKey: key }
    const payload = PortalWireMessageType.serialize({
      selector: MessageCodes.FINDCONTENT,
      value: findContentMsg,
    })
    this.logger.extend('FINDCONTENT')(`Sending to ${shortId(enr)}`)
    const res = await this.sendMessage(enr, payload, this.protocolId)
    if (res.length === 0) {
      return undefined
    }

    try {
      if (bytesToInt(res.slice(0, 1)) === MessageCodes.CONTENT) {
        this.metrics?.contentMessagesReceived.inc()
        this.logger.extend('FOUNDCONTENT')(`Received from ${shortId(enr)}`)
        const decoded = ContentMessageType.deserialize(res.subarray(1))
        const contentKey = decodeHistoryNetworkContentKey(toHexString(key))
        const contentHash = contentKey.blockHash
        const contentType = contentKey.contentType

        switch (decoded.selector) {
          case FoundContent.UTP: {
            const id = new DataView((decoded.value as Uint8Array).buffer).getUint16(0, false)
            this.logger.extend('FOUNDCONTENT')(`received uTP Connection ID ${id}`)
            await this.handleNewRequest({
              protocolId: this.protocolId,
              contentKeys: [key],
              peerId: dstId,
              connectionId: id,
              requestCode: RequestCode.FINDCONTENT_READ,
              contents: [],
            })
            break
          }
          case FoundContent.CONTENT:
            this.logger(
              `received ${StateNetworkContentType[contentType]} content corresponding to ${contentHash}`,
            )
            try {
              await this.stateStore(toHexString(key), toHexString(decoded.value as Uint8Array))
            } catch {
              this.logger('Error adding content to DB')
            }
            break
          case FoundContent.ENRS: {
            this.logger(`received ${decoded.value.length} ENRs`)
            break
          }
        }
        return decoded
      }
    } catch (err: any) {
      this.logger(`Error sending FINDCONTENT to ${shortId(enr)} - ${err.message}`)
    }
  }

  public findContentLocally = async (contentKey: Uint8Array): Promise<Uint8Array> => {
    const value = await this.retrieve(toHexString(contentKey))
    return value ? hexToBytes(value) : hexToBytes('0x')
  }

  public routingTableInfo = async () => {
    return {
      nodeId: this.enr.nodeId,
      buckets: this.routingTable.buckets.map((bucket) => bucket.values().map((enr) => enr.nodeId)),
    }
  }

  public stateStore = async (contentKey: string, content: string) => {
    this.put(ProtocolId.StateNetwork, contentKey, content)
    this.logger(`content added for: ${contentKey}`)
  }

  public store = async () => {}
}
