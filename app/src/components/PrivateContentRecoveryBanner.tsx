import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2, LockKeyhole } from 'lucide-react'
import { decodeEventLog } from 'viem'
import { useAccount, usePublicClient } from 'wagmi'
import { ABIS, CONTRACT_ADDRESSES } from '@/lib/contracts'
import { ACTIVE_CHAIN_ID } from '@/lib/wagmi-config'
import { extractRegisteredLicenseId } from '@/lib/license-creation'
import { privateContentSignerForAccount, storePrivateContentKey } from '@/hooks/usePrivateContent'
import { useTranslations } from '@/lib/i18n'
import {
  deletePrivateContentRecovery,
  listPrivateContentRecoveries,
  recoverPrivateContentKey,
  updatePrivateContentRecovery,
  type PrivateContentRecovery,
} from '@/lib/private-content-recovery'

function extractAssetId(logs: readonly { address: string; data: `0x${string}`; topics: readonly `0x${string}`[] }[]) {
  for (const log of logs) {
    if (log.address.toLowerCase() !== CONTRACT_ADDRESSES.IPAsset.toLowerCase()) continue
    try {
      const decoded = decodeEventLog({
        abi: ABIS.IPAsset,
        eventName: 'IPMinted',
        data: log.data,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      }) as unknown as { args: { tokenId?: unknown } }
      if (typeof decoded.args.tokenId === 'bigint' && decoded.args.tokenId <= BigInt(Number.MAX_SAFE_INTEGER)) {
        return Number(decoded.args.tokenId)
      }
    } catch { /* unrelated IPAsset log */ }
  }
  return undefined
}

export function PrivateContentRecoveryBanner() {
  const { t } = useTranslations()
  const { address } = useAccount()
  const publicClient = usePublicClient()
  const [records, setRecords] = useState<PrivateContentRecovery[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    if (!address) { setRecords([]); return }
    try {
      const all = await listPrivateContentRecoveries(address)
      setRecords(all.filter(record => {
        const expectedContract = record.kind === 'asset'
          ? CONTRACT_ADDRESSES.IPAsset
          : CONTRACT_ADDRESSES.LicenseToken
        return record.chainId === ACTIVE_CHAIN_ID
          && record.contractAddress === expectedContract.toLowerCase()
          && !!record.txHash
      }))
    } catch {
      // IndexedDB can be unavailable in private browsing. Registration itself
      // still works, but no false recovery claim is shown.
      setRecords([])
    }
  }, [address])

  useEffect(() => {
    // Defer the initial external-store read so the effect itself only installs
    // subscriptions; the async completion owns the state update.
    queueMicrotask(() => { void refresh() })
    window.addEventListener('softlaw-private-recovery-changed', refresh)
    return () => window.removeEventListener('softlaw-private-recovery-changed', refresh)
  }, [refresh])

  const resume = async (record: PrivateContentRecovery) => {
    if (!address || !publicClient || !record.txHash) return
    setBusyId(record.id)
    setError('')
    try {
      let subjectId = record.subjectId
      if (subjectId === undefined) {
        const receipt = await publicClient.getTransactionReceipt({ hash: record.txHash })
        if (receipt.status !== 'success') throw new Error(t.privateContent.recoveryTxFailed)
        subjectId = record.kind === 'asset'
          ? extractAssetId(receipt.logs)
          : extractRegisteredLicenseId(receipt.logs)
        if (subjectId === undefined) throw new Error(t.privateContent.recoveryIdMissing)
        await updatePrivateContentRecovery(record.id, { txHash: record.txHash, subjectId })
      }

      const aesKeyB64 = await recoverPrivateContentKey(record.id)
      const provider = privateContentSignerForAccount(address)
      await storePrivateContentKey({
        subject: { kind: record.kind, id: subjectId },
        address,
        provider,
        aesKeyB64,
        cid: record.cid,
      })
      await deletePrivateContentRecovery(record.id)
      await refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : t.privateContent.genericError)
    } finally {
      setBusyId(null)
    }
  }

  if (records.length === 0) return null
  const record = records[0]!
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 p-3" role="status" style={{
      background: 'color-mix(in srgb, var(--warn) 9%, var(--bg-elev))',
      border: '1px solid color-mix(in srgb, var(--warn) 45%, var(--line))',
    }}>
      <LockKeyhole className="h-4 w-4 shrink-0" style={{ color: 'var(--warn)' }} />
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold" style={{ color: 'var(--ink)' }}>{t.privateContent.recoveryTitle}</p>
        <p className="text-[11px]" style={{ color: 'var(--ink-2)' }}>
          {t.privateContent.recoveryDescription.replace('{kind}', record.kind).replace('{cid}', `${record.cid.slice(0, 8)}…`)}
        </p>
        {error && <p className="mt-1 flex items-center gap-1 text-[11px]" style={{ color: 'var(--danger)' }}><AlertTriangle className="h-3 w-3" />{error}</p>}
      </div>
      <button className="btn btn-primary btn-sm" type="button" disabled={busyId === record.id} onClick={() => void resume(record)}>
        {busyId === record.id && <Loader2 className="h-3 w-3 animate-spin" />}
        {t.privateContent.resumeSetup}
      </button>
    </div>
  )
}
