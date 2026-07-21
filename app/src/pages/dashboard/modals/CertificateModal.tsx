import { useEffect } from 'react'
import { Award, Loader2, X, Download } from 'lucide-react'
import type { ThemeColors } from '@/hooks/useTheme'
import type { UserIPAsset, UserLicense } from '@/hooks/useContracts'
import { useIndexedBlockTime } from '@/hooks/useIndexed'
import { CONTRACT_ADDRESSES, BLOCK_EXPLORER_URL, LANDING_URL } from '@/lib/contracts'
import { escapeHtml, safeImageSrc } from '@/lib/html-escape'
import { ACTIVE_CHAIN_ID, IS_TESTNET } from '@/lib/wagmi-config'
import { useTranslations } from '@/lib/i18n'
import { LEGACY_TYPE_MAP } from '@/lib/copyright-license'

const POLKADOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 280 280" width="28" height="28">
  <ellipse cx="140" cy="50" rx="37" ry="37" fill="#E6007A"/>
  <ellipse cx="140" cy="230" rx="37" ry="37" fill="#E6007A"/>
  <ellipse cx="50" cy="100" rx="37" ry="37" fill="#E6007A"/>
  <ellipse cx="230" cy="100" rx="37" ry="37" fill="#E6007A"/>
  <ellipse cx="50" cy="180" rx="37" ry="37" fill="#E6007A"/>
  <ellipse cx="230" cy="180" rx="37" ry="37" fill="#E6007A"/>
</svg>`

function buildCertHTML(p: {
  certId: string; tokenId: string; title: string; description?: string
  category: string; ownerAddress: string; regDate: string
  txHash: string; blockNumber: string; ipfsId: string
  verifyUrl: string; logoSrc: string; explorerBase: string
  contractAddress: string
  imageUrl?: string
  licenses?: Array<{ licenseId: bigint; title: string; isActive: boolean; isExclusive: boolean; expiryTime: bigint; supply: bigint; terms: string }>
}): string {
  const catLabel: Record<string,string> = {
    literary:'Literary Work', artistic:'Visual Artwork',
    musical:'Musical Work', audiovisual:'Audiovisual Work',
    software:'Software / Source Code', dramatic:'Dramatic Work',
    // Stored category aliases
    copyright:'Literary / Artistic Work', artwork:'Visual Artwork',
    music:'Musical Work', video:'Audiovisual Work',
    trademark:'Other', patent:'Other',
  }

  // Escape all user-controlled metadata before HTML interpolation.
  const certId       = escapeHtml(p.certId)
  const tokenId      = escapeHtml(p.tokenId)
  const title        = escapeHtml(p.title)
  const description  = escapeHtml(p.description)
  const categoryRaw  = catLabel[p.category] ?? p.category
  const category     = escapeHtml(categoryRaw)
  const ownerAddr    = escapeHtml(p.ownerAddress)
  const ownerShort   = escapeHtml(`${p.ownerAddress.slice(0,14)}…${p.ownerAddress.slice(-10)}`)
  const regDate      = escapeHtml(p.regDate)
  const txHash       = escapeHtml(p.txHash)
  const blockNumber  = escapeHtml(p.blockNumber)
  const ipfsId       = escapeHtml(p.ipfsId)
  const verifyUrl    = escapeHtml(p.verifyUrl)
  const logoSrc      = safeImageSrc(p.logoSrc)
  const imageSrc     = safeImageSrc(p.imageUrl)
  const contractAddr = escapeHtml(p.contractAddress)
  const issued       = escapeHtml(new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'}))
  const txUrl        = p.txHash && p.txHash.startsWith('0x') ? escapeHtml(`${p.explorerBase}/tx/${p.txHash}`) : ''
  const ipfsUrl      = p.ipfsId ? escapeHtml(`https://ipfs.io/ipfs/${p.ipfsId}`) : ''
  const licenseCount = p.licenses?.length ?? 0
  const activeLicenseCount = p.licenses ? p.licenses.filter(l => l.isActive).length : 0

  const HEADER = (slim = false) => `
  <div style="background:#1a1a2e;padding:${slim ? '8mm 12mm' : '10mm 12mm'};display:flex;align-items:center;justify-content:space-between">
    <img src="${logoSrc}" alt="Soft.Law" style="height:${slim ? '26px' : '32px'};filter:invert(1) sepia(1) saturate(3) hue-rotate(10deg) brightness(1.2)">
    <div style="display:flex;align-items:center;gap:10px">
      <div style="opacity:0.8">${POLKADOT_SVG}</div>
      <div style="text-align:right">
        <div style="color:#E8D068;font-size:8pt;font-family:monospace;font-weight:bold">Polkadot Asset Hub</div>
        <div style="color:#6B8FAA;font-size:7pt;font-family:monospace;margin-top:2px">PVM · pallet-revive · Chain ID ${ACTIVE_CHAIN_ID}</div>
      </div>
    </div>
  </div>`

  const DIVIDER = () => `
  <div style="display:flex;align-items:center;gap:8px;margin:6mm 0">
    <div style="flex:1;height:1px;background:linear-gradient(to right,transparent,#D4AF37,transparent)"></div>
    <span style="color:#D4AF37;font-size:10pt">◆</span>
    <div style="flex:1;height:1px;background:linear-gradient(to right,#D4AF37,transparent)"></div>
  </div>`

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Soft.Law Certificate · ${certId}</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
@page{size:A4;margin:0}
html,body{background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact;font-family:'Georgia','Times New Roman',serif;color:#1a1a2e}
.page{width:210mm;min-height:297mm;background:#FAFAF7;position:relative}
.page+.page{page-break-before:always}
.body{padding:8mm 12mm 10mm}
.label{font-size:7.5pt;color:#8B6914;text-transform:uppercase;letter-spacing:1.5px;font-family:Arial,sans-serif;margin-bottom:3px}
.mono{font-family:'Courier New',Courier,monospace}
a{color:#2D4A8A}
</style>
</head>
<body>

<div class="page">
  ${HEADER()}
  <div style="height:3px;background:linear-gradient(to right,#8B6914,#D4AF37,#F0C040,#D4AF37,#8B6914)"></div>
  <div class="body" style="padding:7mm 12mm 8mm">
    <div style="text-align:center;padding:4mm 0;border-bottom:2px solid #D4C5A0;margin-bottom:5mm">
      <div style="font-size:8pt;letter-spacing:5px;color:#8B6914;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:3px">Official Document · Softlaw SA de CV</div>
      <div style="font-size:26pt;font-weight:bold;color:#1a1a2e;letter-spacing:1px;line-height:1.1">Intellectual Property</div>
      <div style="font-size:13pt;color:#D4AF37;letter-spacing:4px;font-family:Arial,sans-serif;text-transform:uppercase;margin-top:3px;font-weight:bold">Protection Certificate</div>
      <div style="margin-top:6px;display:inline-block;font-size:9pt;font-family:monospace;color:#8B6914;background:#F0E8D5;padding:3px 14px;border-radius:3px;border:1px solid #D4C5A0">
        Certificate ID: <strong>${certId}</strong>
      </div>
    </div>
    <div style="text-align:center;margin-bottom:5mm">
      <p style="font-size:9.5pt;color:#6B7A99;font-style:italic;line-height:1.6;margin-bottom:5px">
        This certifies that the following intellectual property has been registered on a public, immutable blockchain,
        establishing tamper-proof cryptographic evidence of existence, authorship, and date of creation.
      </p>
      <div style="font-size:20pt;font-weight:bold;color:#1a1a2e;line-height:1.2;margin-bottom:5px">${title}</div>
      <span style="font-size:8pt;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:2.5px;color:#fff;background:#2D4A8A;padding:3px 12px;border-radius:3px;display:inline-block">${category}</span>
    </div>
    ${imageSrc ? `
    <div style="display:grid;grid-template-columns:70mm 1fr;gap:5mm;margin-bottom:5mm;align-items:start">
      <div style="width:70mm;height:70mm;border:2px solid #D4AF37;border-radius:4px;overflow:hidden;flex-shrink:0;background:#F0E8D5;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(212,175,55,0.2)">
        <img src="${imageSrc}" alt="${title}" style="width:70mm;height:70mm;object-fit:cover;display:block">
      </div>
      <div style="border-left:4px solid #D4AF37;padding:8px 10px;background:#F5F0E8;border-radius:0 3px 3px 0;min-height:70mm;box-sizing:border-box">
        <div class="label" style="margin-bottom:5px">Work Description</div>
        ${description
          ? `<p style="font-size:10pt;color:#3a3a5a;line-height:1.75;font-style:italic">${description}</p>`
          : `<p style="font-size:9.5pt;color:#8B8B9A;font-style:italic;line-height:1.6">No description provided.</p>`}
        <div style="margin-top:8px;padding-top:8px;border-top:1px solid #E8DCC8">
          <div class="label" style="margin-bottom:3px">Creator</div>
          <div style="font-size:9.5pt;color:#1a1a2e">${ownerShort}</div>
        </div>
        <div style="margin-top:6px">
          <div class="label" style="margin-bottom:3px">Registration Date</div>
          <div style="font-size:9.5pt;color:#1a1a2e">${regDate}</div>
        </div>
      </div>
    </div>` : `
    ${description ? `
    <div style="border-left:4px solid #D4AF37;padding:8px 12px;background:#F5F0E8;margin-bottom:5mm;border-radius:0 3px 3px 0">
      <div class="label" style="margin-bottom:4px">Work Description</div>
      <p style="font-size:10.5pt;color:#3a3a5a;line-height:1.75;font-style:italic">${description}</p>
    </div>` : ''}`}
    ${DIVIDER()}
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4mm;margin-bottom:4mm">
      <div style="border:1px solid #D4C5A0;overflow:hidden;border-radius:3px">
        <div style="background:#1a1a2e;padding:5px 12px">
          <span style="font-size:8pt;color:#8AADCC;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;font-weight:bold">Registration Details</span>
        </div>
        <div style="background:#F5F0E8">
          <div style="padding:6px 12px;border-bottom:1px solid #E8DCC8"><div class="label">Token ID</div><div style="font-size:16pt;font-weight:bold;color:#1a1a2e;font-family:Georgia,serif">#${tokenId}</div></div>
          <div style="padding:6px 12px;border-bottom:1px solid #E8DCC8"><div class="label">Registration Date</div><div style="font-size:9.5pt;color:#1a1a2e;line-height:1.4">${regDate}</div></div>
          <div style="padding:6px 12px;border-bottom:1px solid #E8DCC8"><div class="label">IP Category</div><div style="font-size:9.5pt;color:#1a1a2e">${category}</div></div>
          <div style="padding:6px 12px;border-bottom:1px solid #E8DCC8"><div class="label">Licenses</div><div style="font-size:9.5pt;color:#1a1a2e">${activeLicenseCount} active / ${licenseCount} total</div></div>
          <div style="padding:6px 12px"><div class="label">Protocol</div><div style="font-size:9.5pt;color:#1a1a2e">Polkadot Asset Hub · PVM</div></div>
        </div>
      </div>
      <div style="border:1px solid #D4C5A0;overflow:hidden;border-radius:3px">
        <div style="background:#1a1a2e;padding:5px 12px">
          <span style="font-size:8pt;color:#8AADCC;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;font-weight:bold">On-Chain Proof</span>
        </div>
        <div style="background:#F5F0E8">
          <div style="padding:6px 12px;border-bottom:1px solid #E8DCC8"><div class="label">Block Number</div><div style="font-size:9.5pt;color:#1a1a2e;font-family:monospace">${blockNumber || '—'}</div></div>
          <div style="padding:6px 12px;border-bottom:1px solid #E8DCC8"><div class="label">Transaction Hash</div><div style="font-size:7.5pt;color:#1a1a2e;font-family:monospace;word-break:break-all;line-height:1.5">${txUrl ? `<a href="${txUrl}">${txHash}</a>` : (txHash || '—')}</div></div>
          <div style="padding:6px 12px;border-bottom:1px solid #E8DCC8"><div class="label">IPFS Content ID</div><div style="font-size:7.5pt;color:#1a1a2e;font-family:monospace;word-break:break-all;line-height:1.5">${ipfsUrl ? `<a href="${ipfsUrl}">${ipfsId}</a>` : (ipfsId || 'On-chain metadata')}</div></div>
          <div style="padding:6px 12px;border-bottom:1px solid #E8DCC8"><div class="label">Smart Contract</div><div style="font-size:7.5pt;color:#1a1a2e;font-family:monospace;word-break:break-all">${contractAddr}</div></div>
          <div style="padding:6px 12px"><div class="label">Chain ID</div><div style="font-size:9.5pt;color:#1a1a2e;font-family:monospace">${ACTIVE_CHAIN_ID}${IS_TESTNET ? ' (Paseo testnet)' : ''}</div></div>
        </div>
      </div>
    </div>
    <div style="border:1px solid #D4C5A0;border-radius:3px;overflow:hidden;margin-bottom:4mm">
      <div style="background:#1a1a2e;padding:5px 12px">
        <span style="font-size:8pt;color:#8AADCC;letter-spacing:2px;text-transform:uppercase;font-family:Arial,sans-serif;font-weight:bold">Registered Owner — Wallet Address</span>
      </div>
      <div style="background:#F5F0E8;padding:7px 12px;display:flex;align-items:baseline;justify-content:space-between;gap:6mm">
        <div style="font-size:9.5pt;font-family:monospace;color:#1a1a2e;word-break:break-all;flex:1">${ownerAddr}</div>
        <div style="font-size:7.5pt;color:#8B6914;font-style:italic;flex-shrink:0;white-space:nowrap">Polkadot Asset Hub testnet</div>
      </div>
    </div>
    <div style="border-top:1px solid #D4C5A0;padding-top:4mm;display:flex;justify-content:space-between;align-items:flex-end">
      <div style="font-size:7.5pt;color:#8B6914;font-family:Arial,sans-serif;font-style:italic;max-width:110mm">
        Certificate ID <strong>${certId}</strong> is derived from on-chain Token #${tokenId} — independently verifiable on Polkadot Asset Hub.<br>
        See page 2 for full legal basis, international treaty coverage, and verification links.
      </div>
      <div style="font-size:8pt;color:#8B6914;font-family:Arial,sans-serif;text-align:right">Page 1 of 2 &nbsp;·&nbsp; ${issued}</div>
    </div>
  </div>
  <div style="height:3px;background:linear-gradient(to right,#8B6914,#D4AF37,#F0C040,#D4AF37,#8B6914)"></div>
</div>

<div class="page">
  ${HEADER(true)}
  <div style="height:3px;background:linear-gradient(to right,#8B6914,#D4AF37,#F0C040,#D4AF37,#8B6914)"></div>
  <div class="body" style="padding:5mm 12mm 6mm">
    <div style="text-align:center;padding:3mm 0;border-bottom:1px solid #D4C5A0;margin-bottom:4mm">
      <div style="font-size:7.5pt;letter-spacing:4px;color:#8B6914;font-family:Arial,sans-serif;text-transform:uppercase;margin-bottom:2px">Certificate ${certId} · ${title}</div>
      <div style="font-size:14pt;font-weight:bold;color:#1a1a2e">Legal Basis &amp; Technical Documentation</div>
    </div>
    <div style="background:#EEF2F8;border:1px solid #BDC8E0;border-radius:3px;padding:4mm 5mm;margin-bottom:3mm">
      <div style="font-size:8.5pt;color:#2D4A8A;text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif;font-weight:bold;margin-bottom:3mm;border-bottom:1px solid #BDC8E0;padding-bottom:2px">
        International Legal Protection — Prima Facie Evidence
      </div>
      <p style="font-size:8.5pt;color:#3A4A6A;line-height:1.6;margin-bottom:3mm">
        This certificate constitutes <strong>prima facie evidence</strong> of authorship, originality, and date of creation. The blockchain timestamp and cryptographic hash recorded on Polkadot Asset Hub are <strong>mathematically immutable</strong> — any subsequent claimant must prove an earlier creation date, a burden that blockchain provenance makes practically impossible to overcome.
      </p>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:2.5mm;margin-bottom:2.5mm">
        <div style="background:#fff;border:1px solid #BDC8E0;border-radius:3px;padding:4px 7px">
          <div style="font-size:8.5pt;font-weight:bold;color:#2D4A8A;margin-bottom:3px">Berne Convention (1886 / Paris 1971)</div>
          <p style="font-size:8pt;color:#3A4A6A;line-height:1.6">181 member states. <strong>Art. 5(2)</strong>: copyright protection is automatic upon creation — no registration formality required. <strong>Art. 9</strong>: exclusive reproduction rights. Minimum term: 50 years <em>post mortem auctoris</em> (70 years in Mexico, US, EU).</p>
        </div>
        <div style="background:#fff;border:1px solid #BDC8E0;border-radius:3px;padding:4px 7px">
          <div style="font-size:8.5pt;font-weight:bold;color:#2D4A8A;margin-bottom:3px">WIPO Copyright Treaty — WCT (Geneva 1996)</div>
          <p style="font-size:8pt;color:#3A4A6A;line-height:1.6">Supplementary to Berne. Expressly affirms protection for works created and distributed via electronic networks. Member states must provide legal protection against circumvention of technological protection measures (TPMs).</p>
        </div>
        <div style="background:#fff;border:1px solid #BDC8E0;border-radius:3px;padding:4px 7px">
          <div style="font-size:8.5pt;font-weight:bold;color:#2D4A8A;margin-bottom:3px">TRIPS Agreement — WTO (Marrakesh 1994)</div>
          <p style="font-size:8pt;color:#3A4A6A;line-height:1.6">Binding on all 164 WTO members. <strong>Art. 9</strong>: incorporates Berne Arts. 1–21. <strong>Art. 41</strong>: effective enforcement procedures required. <strong>Art. 50</strong>: courts may grant provisional injunctive relief without prior notice to prevent infringement.</p>
        </div>
        <div style="background:#fff;border:1px solid #BDC8E0;border-radius:3px;padding:4px 7px">
          <div style="font-size:8.5pt;font-weight:bold;color:#2D4A8A;margin-bottom:3px">UNCITRAL Model Law on E-Commerce (1996)</div>
          <p style="font-size:8pt;color:#3A4A6A;line-height:1.6">Adopted by 80+ jurisdictions including Mexico. <strong>Art. 9</strong>: electronic information shall not be denied legal effect solely because it is in digital form. Blockchain timestamps are legally equivalent evidence to paper documents.</p>
        </div>
      </div>
      <div style="background:#fff;border:1px solid #BDC8E0;border-radius:3px;padding:4px 7px;margin-bottom:2.5mm">
        <div style="font-size:8.5pt;font-weight:bold;color:#2D4A8A;margin-bottom:3px">International Principle — Automatic Protection</div>
        <p style="font-size:8pt;color:#3A4A6A;line-height:1.6">Copyright protection arises automatically upon creation under the Berne Convention (181 member states) and does not require formal registration. This certificate, issued by <strong>Softlaw</strong>, constitutes cryptographically verifiable evidence of the work's existence and creation date, admissible in civil and commercial proceedings worldwide.</p>
      </div>
      <p style="font-size:7.5pt;color:#6B7A99;font-style:italic;line-height:1.55;border-top:1px solid #BDC8E0;padding-top:2mm">
        <strong>Note:</strong> This certificate complements but does not replace formal national registration with USPTO, EUIPO, or other national IP offices. It constitutes prima facie evidence of creation date and authorship as provided by Softlaw.
      </p>
    </div>
    ${p.licenses && p.licenses.length > 0 ? `
    <div style="margin-bottom:3mm;border:1px solid #D4C5A0;border-radius:3px;overflow:hidden">
      <div style="background:#1a1a2e;padding:4px 10px">
        <span style="font-size:8pt;color:#8AADCC;letter-spacing:1.5px;text-transform:uppercase;font-family:Arial,sans-serif;font-weight:bold">License Registry — ${licenseCount} License${licenseCount > 1 ? 's' : ''} · Token #${tokenId}</span>
      </div>
      <table style="width:100%;border-collapse:collapse;background:#F5F0E8;font-size:8.5pt">
        <thead>
          <tr style="background:#2D4A8A">
            <th style="padding:4px 7px;text-align:left;color:#fff;font-family:Arial,sans-serif;font-size:7pt;font-weight:bold">ID</th>
            <th style="padding:4px 7px;text-align:left;color:#fff;font-family:Arial,sans-serif;font-size:7pt;font-weight:bold">Title / Terms</th>
            <th style="padding:4px 7px;text-align:center;color:#fff;font-family:Arial,sans-serif;font-size:7pt;font-weight:bold">Status</th>
            <th style="padding:4px 7px;text-align:center;color:#fff;font-family:Arial,sans-serif;font-size:7pt;font-weight:bold">Type</th>
            <th style="padding:4px 7px;text-align:right;color:#fff;font-family:Arial,sans-serif;font-size:7pt;font-weight:bold">Expiry</th>
          </tr>
        </thead>
        <tbody>
          ${p.licenses.map((l, i) => {
            const expiryRaw = l.expiryTime === 0n ? 'Perpetual' : new Date(Number(l.expiryTime) * 1000).toLocaleDateString('en-US',{year:'numeric',month:'short',day:'numeric'})
            const expiry = escapeHtml(expiryRaw)
            const statusColor = l.isActive ? '#16A34A' : '#DC2626'
            const statusBg = l.isActive ? '#DCFCE7' : '#FEE2E2'
            const titleOrTermsRaw = l.title || LEGACY_TYPE_MAP[l.terms] || (l.terms.length > 40 ? l.terms.slice(0,38)+'…' : l.terms) || 'Standard License'
            const titleOrTerms = escapeHtml(titleOrTermsRaw)
            const licenseIdStr = escapeHtml(l.licenseId.toString())
            return `<tr style="background:${i % 2 === 0 ? '#F5F0E8' : '#FAFAF7'}">
              <td style="padding:4px 7px;font-family:monospace;color:#1a1a2e;font-size:8.5pt;border-bottom:1px solid #E8DCC8">#${licenseIdStr}</td>
              <td style="padding:4px 7px;color:#1a1a2e;font-size:8.5pt;border-bottom:1px solid #E8DCC8">${titleOrTerms}</td>
              <td style="padding:4px 7px;text-align:center;border-bottom:1px solid #E8DCC8">
                <span style="background:${statusBg};color:${statusColor};font-size:7pt;font-family:Arial,sans-serif;text-transform:uppercase;padding:1px 6px;border-radius:3px;font-weight:bold">${l.isActive ? 'Active' : 'Inactive'}</span>
              </td>
              <td style="padding:4px 7px;text-align:center;color:#1a1a2e;font-size:8pt;border-bottom:1px solid #E8DCC8">${l.isExclusive ? 'Exclusive' : 'Non-exclusive'}</td>
              <td style="padding:4px 7px;text-align:right;font-family:monospace;color:#1a1a2e;font-size:8pt;border-bottom:1px solid #E8DCC8">${expiry}</td>
            </tr>`
          }).join('')}
        </tbody>
      </table>
    </div>` : ''}
    <div style="display:grid;grid-template-columns:auto 1fr auto;gap:4mm;align-items:center;border:1px solid #D4C5A0;border-radius:3px;overflow:hidden;margin-bottom:3mm">
      <div style="background:#1a1a2e;padding:5mm;text-align:center;align-self:stretch;display:flex;flex-direction:column;align-items:center;justify-content:center">
        <div style="font-size:24pt;color:#D4AF37">◆</div>
        <div style="font-size:6.5pt;color:#8AADCC;font-family:Arial,sans-serif;text-transform:uppercase;letter-spacing:1px;margin-top:4px">Verify on-chain</div>
      </div>
      <div style="padding:4mm 0 4mm 0;background:#F5F0E8">
        <div style="font-size:8pt;color:#8B6914;text-transform:uppercase;letter-spacing:2px;font-family:Arial,sans-serif;font-weight:bold;margin-bottom:3mm">Verification Links</div>
        <div style="margin-bottom:2mm"><div class="label" style="font-size:7pt">Certificate</div><a href="${verifyUrl}" style="font-size:8.5pt;font-family:monospace;color:#2D4A8A">${verifyUrl}</a></div>
        ${txUrl ? `<div style="margin-bottom:2mm"><div class="label" style="font-size:7pt">Block Explorer</div><a href="${txUrl}" style="font-size:7.5pt;font-family:monospace;color:#2D4A8A;word-break:break-all">${txUrl}</a></div>` : ''}
        ${ipfsUrl ? `<div><div class="label" style="font-size:7pt">IPFS Metadata</div><a href="${ipfsUrl}" style="font-size:7.5pt;font-family:monospace;color:#2D4A8A;word-break:break-all">${ipfsUrl}</a></div>` : ''}
      </div>
      <div style="padding:4mm 5mm;text-align:right;border-left:1px solid #D4C5A0;background:#F5F0E8;align-self:stretch;display:flex;flex-direction:column;justify-content:center">
        <div style="font-size:7pt;color:#8B6914;text-transform:uppercase;letter-spacing:1.5px;font-family:Arial,sans-serif;margin-bottom:2px">Issued by</div>
        <div style="font-size:18pt;color:#D4AF37;font-family:Georgia,serif;font-weight:bold;line-height:1">Soft.Law</div>
        <div style="font-size:8pt;color:#8B6914;font-family:Arial,sans-serif;margin-top:3px">Softlaw SA de CV</div>
        <div style="font-size:7.5pt;color:#6B7A99;font-family:Arial,sans-serif;margin-top:1px">Decentralized IP Registry</div>
        <div style="font-size:7.5pt;color:#8B6914;font-family:Arial,sans-serif;margin-top:1px">${issued}</div>
        <div style="font-size:8pt;font-family:monospace;color:#1a1a2e;font-weight:bold;margin-top:4px;border-top:1px solid #D4C5A0;padding-top:3px">${certId}</div>
        <div style="font-size:7pt;color:#8B6914;font-family:Arial,sans-serif">Page 2 of 2</div>
      </div>
    </div>
    <div style="text-align:center;padding-top:2mm">
      <span style="font-size:7pt;font-family:monospace;color:#8B6914;background:#F0E8D5;padding:2px 10px;border-radius:3px;border:1px solid #D4C5A0">
        ✦ Registered on Polkadot Asset Hub · PVM / pallet-revive · Immutable &amp; Tamper-Proof · Softlaw SA de CV ✦
      </span>
    </div>
  </div>
  <div style="height:3px;background:linear-gradient(to right,#8B6914,#D4AF37,#F0C040,#D4AF37,#8B6914)"></div>
</div>

</body>
</html>`
}

export function CertificateModal({ asset, onClose, ownerAddress, licenses }: {
  asset: UserIPAsset; colors?: ThemeColors; onClose: () => void; ownerAddress?: string; licenses?: UserLicense[]
}) {
  const { t } = useTranslations()
  // Mint metadata comes from the indexer's ip_assets row (block_number, tx_hash).
  // Block timestamp is fetched from the events table at the same block height.
  const txHash = asset.txHash ?? 'See block explorer'
  const blockNumber = asset.blockNumber !== undefined ? asset.blockNumber.toString() : ''
  const { date: blockDate, isLoading: isLoadingBlockTime } = useIndexedBlockTime(asset.blockNumber)
  const regDate = blockDate
    ? blockDate.toUTCString()
    : isLoadingBlockTime
      ? 'Fetching...'
      : 'Registration confirmed on-chain'
  const isLoading = isLoadingBlockTime && asset.blockNumber !== undefined

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleEsc)
    return () => window.removeEventListener('keydown', handleEsc)
  }, [onClose])

  const certId = `SLW-${String(asset.tokenId).padStart(6,'0')}-${new Date().getFullYear()}`
  const ipfsId = asset.metadataURI?.replace('ipfs://','') ?? ''
  const verifyUrl = `${LANDING_URL}/verify/${asset.tokenId.toString()}`
  const owner = ownerAddress ?? '0x0000000000000000000000000000000000000000'
  const explorerBase = BLOCK_EXPLORER_URL

  // The on-screen preview uses localized category labels.
  // The PDF uses the English catLabel map inside buildCertHTML (the print window has no app stylesheet or i18n context).
  const catLabels = t.registry.categories as Record<string, string>
  const getLocalizedCategory = (cat: string) => catLabels[cat] ?? cat

  const handleDownload = () => {
    const logoSrc = `${window.location.origin}/brand/logo_black.png`
    const html = buildCertHTML({
      certId, tokenId: asset.tokenId.toString(),
      title: asset.title || `Asset #${asset.tokenId.toString()}`,
      description: asset.description, category: asset.category,
      ownerAddress: owner,
      regDate: isLoading ? 'Pending on-chain verification' : regDate,
      txHash, blockNumber, ipfsId, verifyUrl, logoSrc, explorerBase,
      contractAddress: CONTRACT_ADDRESSES.IPAsset,
      imageUrl: asset.imageUrl,
      licenses: licenses?.map(l => ({ licenseId: l.licenseId, title: l.title, isActive: l.isActive, isExclusive: l.isExclusive, expiryTime: l.expiryTime, supply: l.supply, terms: l.terms })),
    })
    const win = window.open('','_blank','width=900,height=1100,scrollbars=yes')
    if (!win) { alert('Please allow pop-ups to generate the certificate.'); return }
    win.document.open()
    win.document.write(html)
    win.document.close()
    let attempts = 0
    const tryPrint = () => {
      attempts++
      const imgs = win.document.images
      const allLoaded = Array.from(imgs).every(img => img.complete)
      if (allLoaded || attempts > 20) { setTimeout(() => { win.focus(); win.print() }, 200) }
      else { setTimeout(tryPrint, 150) }
    }
    setTimeout(tryPrint, 400)
  }

  const rows: [string, string, string?][] = [
    ['Token ID', `#${asset.tokenId.toString()}`],
    ['IP Type', getLocalizedCategory(asset.category)],
    ['Owner', `${owner.slice(0,10)}...${owner.slice(-8)}`],
    ['Date', isLoading ? 'Fetching…' : regDate.length > 40 ? regDate.slice(0,40)+'…' : regDate],
    ['Block', blockNumber || '—'],
    ['Tx Hash', txHash.length > 24 ? `${txHash.slice(0,12)}…${txHash.slice(-10)}` : txHash, txHash.startsWith('0x') ? `${explorerBase}/tx/${txHash}` : undefined],
    ['IPFS', ipfsId ? `${ipfsId.slice(0,14)}…` : 'On-chain', ipfsId ? `https://ipfs.io/ipfs/${ipfsId}` : undefined],
    ['Chain', 'Polkadot Asset Hub (PVM)'],
  ]

  // The modal follows the active theme; printable certificate colors remain fixed.
  const gold = 'var(--gold)'
  const bg2 = 'var(--bg-elev)'
  const border = 'var(--line)'
  const textP = 'var(--ink)'
  const textM = 'var(--ink-4)'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3" style={{ backgroundColor:'rgba(0,0,0,0.93)' }} onClick={onClose}>
      <div className="w-full max-w-lg flex flex-col gap-2.5" style={{ maxHeight:'96vh' }} onClick={e => e.stopPropagation()}>

        {/* Toolbar */}
        <div className="flex items-center justify-between flex-shrink-0 px-1">
          <div className="flex items-center gap-2">
            <Award className="w-4 h-4" style={{ color: gold }} />
            <span className="text-sm font-semibold" style={{ color: textP }}>IP Protection Certificate</span>
            {isLoading && <Loader2 className="w-3 h-3 animate-spin" style={{ color: textM }} />}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold transition-all hover:opacity-90 active:scale-95"
              style={{ background:`linear-gradient(135deg, ${gold}, #8B6914)`, color:'#fff', boxShadow:`0 2px 16px color-mix(in srgb, ${gold} 38%, transparent)` }}>
              <Download className="w-3.5 h-3.5" /> Download PDF
            </button>
            <button onClick={onClose} className="p-1.5 rounded-sm hover:opacity-70" style={{ backgroundColor: bg2 }}>
              <X className="w-4 h-4" style={{ color: textM }} />
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="overflow-y-auto flex-1 rounded-sm" style={{ background:'#FAFAF7', border:`5px double ${gold}` }}>
          {/* Header */}
          <div style={{ background:'#1a1a2e', padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <img src="/brand/logo_black.png" alt="Soft.Law" height={20}
              style={{ filter:'invert(1) sepia(1) saturate(3) hue-rotate(10deg) brightness(1.2)', height:'20px' }} />
            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
              <div dangerouslySetInnerHTML={{ __html: POLKADOT_SVG }} style={{ opacity:0.8, width:'20px', height:'20px' }} />
              <div style={{ textAlign:'right' }}>
                <div style={{ color:'#E8D068', fontSize:'6px', fontFamily:'monospace' }}>Polkadot Asset Hub</div>
                <div style={{ color:'#6B8FAA', fontSize:'5px', fontFamily:'monospace', marginTop:'1px' }}>PVM · Chain ID {ACTIVE_CHAIN_ID}</div>
              </div>
            </div>
          </div>

          <div style={{ padding:'12px 16px', fontFamily:'Georgia, serif', color:'#1a1a2e' }}>
            {/* Title */}
            <div style={{ textAlign:'center', borderBottom:'1px solid #D4C5A0', paddingBottom:'10px', marginBottom:'10px' }}>
              <div style={{ fontSize:'7px', letterSpacing:'4px', color:'#8B6914', fontFamily:'Arial', textTransform:'uppercase', marginBottom:'3px' }}>Official Document</div>
              <div style={{ fontSize:'16px', fontWeight:'bold', color:'#1a1a2e', letterSpacing:'0.5px' }}>Intellectual Property</div>
              <div style={{ fontSize:'8px', color:gold, letterSpacing:'2.5px', fontFamily:'Arial', textTransform:'uppercase', marginTop:'2px' }}>Protection Certificate</div>
              <div style={{ marginTop:'5px' }}>
                <span style={{ fontSize:'6px', fontFamily:'monospace', background:'#F0E8D5', color:'#8B6914', padding:'1px 8px', borderRadius:'2px', border:'1px solid #D4C5A0' }}>
                  ID: {certId} · Derived from on-chain Token #{asset.tokenId.toString()}
                </span>
              </div>
            </div>

            {/* Work */}
            <div style={{ textAlign:'center', marginBottom:'10px' }}>
              <p style={{ fontSize:'7px', color:'#6B7A99', fontStyle:'italic', lineHeight:'1.55', marginBottom:'5px' }}>
                This certifies that the following intellectual property has been registered on a public blockchain,<br/>establishing immutable, tamper-proof evidence of existence and ownership.
              </p>
              <div style={{ fontSize:'14px', fontWeight:'bold', color:'#1a1a2e', marginBottom:'4px', lineHeight:'1.2' }}>{asset.title || `Asset #${asset.tokenId.toString()}`}</div>
              <span style={{ fontSize:'5.5px', fontFamily:'Arial', textTransform:'uppercase', letterSpacing:'2px', color:'#fff', background:'#2D4A8A', padding:'2px 7px', borderRadius:'2px' }}>
                {getLocalizedCategory(asset.category)}
              </span>
            </div>

            {/* NFT Image */}
            {asset.imageUrl && (
              <div style={{ textAlign:'center', margin:'8px 0' }}>
                <img src={asset.imageUrl} alt={asset.title} style={{ maxWidth:'120px', maxHeight:'120px', objectFit:'contain', border:'1px solid #D4C5A0', borderRadius:'4px', display:'inline-block' }} />
              </div>
            )}

            {/* Divider */}
            <div style={{ display:'flex', alignItems:'center', gap:'6px', margin:'8px 0' }}>
              <div style={{ flex:1, height:'1px', background:`linear-gradient(to right, transparent, ${gold}, transparent)` }} />
              <span style={{ color:gold, fontSize:'7px' }}>◆</span>
              <div style={{ flex:1, height:'1px', background:`linear-gradient(to right, ${gold}, transparent)` }} />
            </div>

            {/* Data grid */}
            <div style={{ border:'1px solid #D4C5A0', overflow:'hidden', marginBottom:'8px', background:'#F5F0E8' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr' }}>
                {[['Registration Details', rows.slice(0,4)], ['On-Chain Proof', rows.slice(4,8)]].map(([hdr, entries]) => (
                  <div key={hdr as string} style={{ borderRight: hdr === 'Registration Details' ? '1px solid #D4C5A0' : 'none' }}>
                    <div style={{ background:'#1a1a2e', padding:'3px 8px' }}>
                      <span style={{ fontSize:'5.5px', color:'#8AADCC', letterSpacing:'2px', textTransform:'uppercase', fontFamily:'Arial' }}>{hdr as string}</span>
                    </div>
                    {(entries as [string, string, string?][]).map(([lbl, val, href]) => (
                      <div key={lbl} style={{ padding:'3px 8px', borderBottom:'1px solid #E8DCC8' }}>
                        <div style={{ fontSize:'5.5px', color:'#8B6914', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'Arial', marginBottom:'1px' }}>{lbl}</div>
                        <div style={{ fontSize:'7px', color:'#1a1a2e', fontFamily:'monospace', wordBreak:'break-all', lineHeight:'1.3' }}>
                          {href
                            ? <a href={href} target="_blank" rel="noreferrer" style={{ color:'#2D4A8A' }}>{val}</a>
                            : val}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* Description */}
            {asset.description && (
              <div style={{ borderLeft:`3px solid ${gold}`, padding:'5px 8px', background:'#F5F0E8', marginBottom:'8px' }}>
                <div style={{ fontSize:'5.5px', color:'#8B6914', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'Arial', marginBottom:'2px' }}>Work Description</div>
                <p style={{ fontSize:'7px', color:'#4a4a6a', lineHeight:'1.55', fontStyle:'italic' }}>{asset.description}</p>
              </div>
            )}

            {/* Legal */}
            <div style={{ background:'#EEF2F8', border:'1px solid #BDC8E0', padding:'6px 8px', marginBottom:'8px' }}>
              <div style={{ fontSize:'5.5px', color:'#2D4A8A', textTransform:'uppercase', letterSpacing:'2px', fontFamily:'Arial', fontWeight:'bold', marginBottom:'4px' }}>Legal Basis &amp; International Protection</div>
              <p style={{ fontSize:'7px', color:'#3A4A6A', lineHeight:'1.6', marginBottom:'3px' }}>This certificate constitutes <strong>prima facie evidence</strong> of authorship and date of creation under:</p>
              <ul style={{ paddingLeft:'10px', margin:'2px 0' }}>
                {[
                  'Berne Convention (1886, rev. 1971) — 181 member states · Art. 5(2): copyright arises automatically upon creation.',
                  'WIPO Copyright Treaty (1996) — extends protection to digital works distributed via electronic networks.',
                  'TRIPS Agreement Art. 9 (WTO, 1994) — binding on 164 WTO member states.',
                ].map(t => <li key={t} style={{ fontSize:'6.5px', color:'#3A4A6A', lineHeight:'1.6' }}>{t}</li>)}
              </ul>
              <p style={{ fontSize:'6px', color:'#6B7A99', fontStyle:'italic', marginTop:'3px', lineHeight:'1.5' }}>
                The blockchain timestamp and hash constitute tamper-proof evidence of prior art. Does not replace formal national registration.
              </p>
            </div>

            {/* Licenses */}
            {licenses && licenses.length > 0 && (
              <div style={{ marginBottom:'8px', border:'1px solid #D4C5A0', overflow:'hidden' }}>
                <div style={{ background:'#1a1a2e', padding:'3px 8px' }}>
                  <span style={{ fontSize:'5.5px', color:'#8AADCC', letterSpacing:'2px', textTransform:'uppercase', fontFamily:'Arial' }}>License Registry — {licenses.length} License{licenses.length > 1 ? 's' : ''}</span>
                </div>
                <div style={{ display:'grid', gridTemplateColumns:'auto 1fr 1fr 1fr 1fr', background:'#F5F0E8' }}>
                  {['ID','Title','Status','Type','Expiry'].map(h => (
                    <div key={h} style={{ padding:'2px 6px', fontSize:'5px', color:'#8B6914', textTransform:'uppercase', letterSpacing:'0.5px', fontFamily:'Arial', borderBottom:'1px solid #D4C5A0' }}>{h}</div>
                  ))}
                  {licenses.map(l => {
                    const expiry = l.expiryTime === 0n ? 'Perpetual' : new Date(Number(l.expiryTime) * 1000).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'})
                    return [
                      <div key={`${l.licenseId}-id`} style={{ padding:'2px 6px', fontSize:'6px', fontFamily:'monospace', color:'#1a1a2e', borderBottom:'1px solid #E8DCC8' }}>#{l.licenseId.toString()}</div>,
                      <div key={`${l.licenseId}-t`} style={{ padding:'2px 6px', fontSize:'6px', fontFamily:'monospace', color:'#1a1a2e', borderBottom:'1px solid #E8DCC8' }}>{l.title || LEGACY_TYPE_MAP[l.terms] || l.terms.slice(0, 20)}</div>,
                      <div key={`${l.licenseId}-s`} style={{ padding:'2px 6px', fontSize:'6px', fontFamily:'Arial', borderBottom:'1px solid #E8DCC8' }}>
                        <span style={{ background: l.isActive ? '#DCFCE7' : '#FEE2E2', color: l.isActive ? '#16A34A' : '#DC2626', padding:'1px 4px', borderRadius:'2px', fontSize:'5px', textTransform:'uppercase' }}>{l.isActive ? 'Active' : 'Inactive'}</span>
                      </div>,
                      <div key={`${l.licenseId}-e`} style={{ padding:'2px 6px', fontSize:'6px', fontFamily:'Arial', color:'#1a1a2e', borderBottom:'1px solid #E8DCC8' }}>{l.isExclusive ? 'Exclusive' : 'Non-excl.'}</div>,
                      <div key={`${l.licenseId}-x`} style={{ padding:'2px 6px', fontSize:'6px', fontFamily:'monospace', color:'#1a1a2e', borderBottom:'1px solid #E8DCC8' }}>{expiry}</div>,
                    ]
                  })}
                </div>
              </div>
            )}

            {/* Footer */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', borderTop:'1px solid #D4C5A0', paddingTop:'8px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                <div>
                  <div style={{ fontSize:'5.5px', color:'#8B6914', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'Arial', marginBottom:'2px' }}>Verify on-chain</div>
                  <a href={verifyUrl} target="_blank" rel="noreferrer" style={{ fontSize:'6.5px', color:'#2D4A8A', fontFamily:'monospace', display:'block' }}>{verifyUrl}</a>
                  {txHash.startsWith('0x') && (
                    <a href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noreferrer" style={{ fontSize:'6px', color:'#2D4A8A', fontFamily:'monospace', display:'block', marginTop:'2px' }}>Block Explorer ↗</a>
                  )}
                  {ipfsId && (
                    <a href={`https://ipfs.io/ipfs/${ipfsId}`} target="_blank" rel="noreferrer" style={{ fontSize:'6px', color:'#2D4A8A', fontFamily:'monospace', display:'block', marginTop:'1px' }}>IPFS Metadata ↗</a>
                  )}
                  <div style={{ fontSize:'5.5px', color:'#8B6914', fontStyle:'italic', marginTop:'2px' }}>Verify on-chain via links above</div>
                </div>
              </div>
              <div style={{ textAlign:'right' }}>
                <div style={{ fontSize:'5.5px', color:'#8B6914', textTransform:'uppercase', letterSpacing:'1px', fontFamily:'Arial', marginBottom:'8px' }}>Issued by</div>
                <div style={{ fontSize:'11px', color:gold, borderTop:`1px solid ${gold}`, paddingTop:'2px', fontFamily:'Georgia, serif' }}>Soft.Law</div>
                <div style={{ fontSize:'5.5px', color:'#8B6914', fontFamily:'Arial', marginTop:'1px' }}>Softlaw SA de CV</div>
                <div style={{ fontSize:'5.5px', color:'#6B7A99', fontFamily:'Arial', marginTop:'1px' }}>Polkadot Asset Hub · Decentralized IP Registry</div>
                <div style={{ fontSize:'5.5px', color:'#6B7A99', fontFamily:'Arial', marginTop:'1px' }}>Issued: {new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'})}</div>
              </div>
            </div>

            {/* Badge */}
            <div style={{ textAlign:'center', marginTop:'8px', paddingTop:'6px', borderTop:'1px solid #E8DCC8' }}>
              <span style={{ fontSize:'5.5px', fontFamily:'monospace', color:'#8B6914', background:'#F0E8D5', padding:'2px 8px', borderRadius:'2px', border:'1px solid #D4C5A0' }}>
                ✦ Registered on Polkadot Asset Hub · PVM / pallet-revive · Immutable &amp; Tamper-Proof · Softlaw SA de CV ✦
              </span>
            </div>
          </div>
        </div>

        {/* Hint */}
        <p className="text-center text-[9px] flex-shrink-0 px-1" style={{ color: textM }}>
          <strong style={{ color: textP }}>Download PDF</strong> opens a new window → use <em>File › Print › Save as PDF</em> or{' '}
          <kbd style={{ padding:'0 3px', borderRadius:'2px', border:`1px solid ${border}`, fontSize:'8px' }}>Ctrl+P</kbd>
        </p>

        {/* ID explanation */}
        <p className="text-center text-[9px] flex-shrink-0 px-1" style={{ color: textM }}>
          Certificate ID <code style={{ color: textP, fontSize:'9px' }}>{certId}</code> is derived from on-chain Token #{asset.tokenId.toString()} registered in {new Date().getFullYear()} — independently verifiable on the blockchain.
        </p>

      </div>
    </div>
  )
}
