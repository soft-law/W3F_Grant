import { keccak256, toHex } from 'viem'
import { CONTRACT_ADDRESSES } from '@/lib/contracts'
import { POLKADOT_HUB_CHAIN_ID, getNetworkName } from '@/lib/wagmi-config'

// ============ Types ============

export type LicenseType =
  | 'non-exclusive'
  | 'exclusive'
  | 'sole'
  | 'cc-by'
  | 'cc-by-nc'
  | 'cc-by-nd'
  | 'cc-by-sa'
  | 'cc0'
  | 'remix'

export type CopyrightRight =
  | 'reproduce'
  | 'distribute'
  | 'display'
  | 'perform'
  | 'create-derivatives'
  | 'digital-use'
  | 'communicate'
  | 'sublicense'

export interface CopyrightLicenseParams {
  licensor: string
  licensee: string
  ipAssetId: string
  ipTitle?: string
  licenseType: LicenseType
  rights: CopyrightRight[]
  commercial: boolean
  territory: string
  attribution: boolean
  exclusive: boolean
  durationDays: number
  expiryTimestamp?: number
  supply: number
  customTerms?: string
  chainId?: number
  ipContractAddress?: string
  licenseContractAddress?: string
  arbitratorContractAddress?: string
  revenueDistributorAddress?: string
  remixRoyaltyBPS?: number
  allowFurtherRemix?: boolean
}

// ============ Constants ============

export const LICENSE_TYPES: Record<LicenseType, { label: string; description: string; ccType?: string }> = {
  'non-exclusive': {
    label: 'Non-Exclusive',
    description: 'Multiple parties can hold the same license simultaneously. The licensor can grant identical rights to other parties at any time.',
  },
  'exclusive': {
    label: 'Exclusive',
    description: 'Only this licensee may exercise the granted rights. The licensor is also excluded during the term.',
  },
  'sole': {
    label: 'Sole',
    description: 'One licensee gets commercial use, but the licensor retains the right to use the work themselves.',
  },
  'cc-by': {
    label: 'CC Attribution (CC BY)',
    description: 'Free use for any purpose with attribution required. Based on CC BY 4.0 International.',
    ccType: 'CC BY 4.0',
  },
  'cc-by-nc': {
    label: 'CC Non-Commercial (CC BY-NC)',
    description: 'Free use with attribution, non-commercial purposes only.',
    ccType: 'CC BY-NC 4.0',
  },
  'cc-by-nd': {
    label: 'CC No Derivatives (CC BY-ND)',
    description: 'Use permitted with attribution; no modifications or derivative works allowed.',
    ccType: 'CC BY-ND 4.0',
  },
  'cc-by-sa': {
    label: 'CC Share-Alike (CC BY-SA)',
    description: 'Free use with attribution; any derivative works must be distributed under the same or compatible CC license.',
    ccType: 'CC BY-SA 4.0',
  },
  'cc0': {
    label: 'Public Domain (CC0)',
    description: 'Creator waives all rights to the fullest extent permitted by law.',
    ccType: 'CC0 1.0',
  },
  'remix': {
    label: 'Remix License',
    description: 'Grants the right to create derivative works with royalties flowing back to the original creator.',
  },
}

export const COPYRIGHT_RIGHTS: Record<CopyrightRight, { label: string; description: string }> = {
  'reproduce': {
    label: 'Reproduction',
    description: 'Make copies in any format',
  },
  'distribute': {
    label: 'Distribution',
    description: 'Sell, rent, lend, or transfer copies',
  },
  'display': {
    label: 'Public Display',
    description: 'Display the work publicly (visual works)',
  },
  'perform': {
    label: 'Public Performance',
    description: 'Perform publicly (music, video, literary)',
  },
  'create-derivatives': {
    label: 'Derivative Works',
    description: 'Create adaptations, translations, remixes',
  },
  'digital-use': {
    label: 'Digital Transmission',
    description: 'Stream or transmit digitally on demand',
  },
  'communicate': {
    label: 'Communication to the Public',
    description: 'Make the work available to the public by wire or wireless means (WIPO Copyright Treaty Art. 8)',
  },
  'sublicense': {
    label: 'Sublicensing',
    description: 'Grant some or all rights to third parties',
  },
}

export const TERRITORY_OPTIONS = [
  'Worldwide',
  'United States',
  'European Union',
  'Asia-Pacific',
  'Latin America',
  'North America',
  'Europe',
  'Custom',
] as const

export type Territory = (typeof TERRITORY_OPTIONS)[number]

// Display labels for stored license-type values.
export const LEGACY_TYPE_MAP: Record<string, string> = {
  'non-exclusive': 'Commercial',
  'exclusive': 'Exclusive',
  'sole': 'Exclusive (Creator Retains Use)',
  'cc-by': 'Free Use',
  'cc-by-nc': 'Personal Use',
  'cc-by-nd': 'Free Use (No Derivatives)',
  'cc-by-sa': 'Commercial (Share-Alike)',
  'cc0': 'Free Use (Public Domain)',
  'remix': 'Commercial (Remix)',
}

// ============ CC Compliance Helpers ============

function isCCType(type: LicenseType): boolean {
  return ['cc-by', 'cc-by-nc', 'cc-by-nd', 'cc-by-sa', 'cc0'].includes(type)
}

function getCCLegalCodeUrl(type: LicenseType): string | null {
  switch (type) {
    case 'cc-by': return 'https://creativecommons.org/licenses/by/4.0/legalcode'
    case 'cc-by-nc': return 'https://creativecommons.org/licenses/by-nc/4.0/legalcode'
    case 'cc-by-nd': return 'https://creativecommons.org/licenses/by-nd/4.0/legalcode'
    case 'cc-by-sa': return 'https://creativecommons.org/licenses/by-sa/4.0/legalcode'
    case 'cc0': return 'https://creativecommons.org/publicdomain/zero/1.0/legalcode'
    default: return null
  }
}

// ============ Rights Label Mapping ============

function getRightsLabel(right: CopyrightRight): string {
  return COPYRIGHT_RIGHTS[right]?.label ?? right
}

function formatRightsList(rights: CopyrightRight[]): string {
  return rights.map(getRightsLabel).join(', ')
}

// ============ Clause Generators ============

function buildClause1_GrantOfLicense(params: CopyrightLicenseParams): object {
  const { licenseType, rights, commercial, exclusive, territory, attribution } = params
  const typeInfo = LICENSE_TYPES[licenseType]

  let grantText = `The Licensor hereby grants to the Licensee a ${exclusive ? 'exclusive' : 'non-exclusive'}, ${commercial ? 'commercial and non-commercial' : 'non-commercial only'} license to exercise the following rights in the Work: ${formatRightsList(rights)}.`

  // A sole license excludes third parties while preserving the licensor's use.
  if (licenseType === 'sole') {
    grantText += ' SOLE LICENSE -- the Licensor retains the right to use the Work for personal and portfolio purposes but shall not grant rights to any other third party during the term of this License.'
  } else if (exclusive) {
    grantText += ' EXCLUSIVE -- no other party, including the Licensor, may exercise the granted rights during the term of this License.'
  } else {
    grantText += ' NON-EXCLUSIVE -- Licensor may simultaneously grant identical rights to other parties.'
  }

  if (!commercial) {
    grantText += ' This License is restricted to NON-COMMERCIAL uses only. Any commercial exploitation, including but not limited to use in products, services, advertising, marketing, or any revenue-generating activity, is expressly prohibited.'
  } else {
    grantText += ' Commercial and non-commercial uses are permitted under this License.'
  }

  // CC-specific injections
  const ccUrl = getCCLegalCodeUrl(licenseType)
  if (ccUrl) {
    grantText += ` This license is based on ${typeInfo.ccType}. Full legal code: ${ccUrl}.`
  }

  // CC BY-ND: no derivatives restriction
  if (licenseType === 'cc-by-nd' || !rights.includes('create-derivatives')) {
    grantText += ' NO DERIVATIVES: The Licensee may not create, publish, or distribute any derivative works, adaptations, translations, remixes, or modified versions of the Work without the express written consent of the Licensor.'
  }

  // CC BY-SA: share-alike obligation
  if (licenseType === 'cc-by-sa') {
    grantText += ' SHARE-ALIKE: Any derivative works created by the Licensee must be licensed under the same or a compatible Creative Commons license (CC BY-SA 4.0 or later). The Licensee may not impose additional restrictions on downstream recipients beyond those in this License.'
  }

  // CC0: public domain dedication
  if (licenseType === 'cc0') {
    grantText = `The Licensor dedicates the Work to the public domain by waiving all rights under copyright law, including all related and neighboring rights, to the fullest extent permitted by law. Where waiver is not legally possible, the Licensor grants a worldwide, royalty-free, non-exclusive, irrevocable license to exercise all rights under copyright. Based on CC0 1.0 Universal. Full legal code: ${ccUrl}.`
  }

  return {
    clause_number: 1,
    title: 'Grant of License',
    body: grantText,
    license_type: typeInfo.label,
    cc_legal_code_url: ccUrl,
    territory,
    is_exclusive: exclusive,
    is_commercial: commercial,
    requires_attribution: attribution,
  }
}

function buildClause2_IPOwnership(params: CopyrightLicenseParams): object {
  const { licenseType, licensor } = params

  let body: string
  if (licenseType === 'cc0') {
    body = `PUBLIC DOMAIN DEDICATION: The Licensor (${licensor}) hereby waives all copyright and related rights in the Work to the fullest extent permitted by applicable law, including moral rights where waivable, in accordance with CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/legalcode). To the extent that waiver of rights is not legally permitted in any jurisdiction, the Licensor grants a worldwide, royalty-free, non-exclusive, irrevocable license to exercise all rights under copyright law. This fallback license ensures the Work is effectively in the public domain in all jurisdictions, including those (such as France, Germany, and other civil law countries) where full copyright waiver is not recognized.`
  } else {
    body = `The Work is and shall remain the intellectual property of the Licensor (${licensor}). This License does not constitute a transfer or assignment of copyright ownership. All rights not expressly granted herein are reserved by the Licensor. The Licensee acknowledges that the Licensor retains all ownership rights, title, and interest in and to the Work, including all intellectual property rights therein under applicable national and international law.`
  }

  return {
    clause_number: 2,
    title: 'IP Ownership Acknowledgment',
    body,
  }
}

function buildClause3_MoralRights(): object {
  return {
    clause_number: 3,
    title: 'Moral Rights',
    body: `In accordance with Article 6bis of the Berne Convention for the Protection of Literary and Artistic Works, the Licensor retains moral rights in the Work, including the right of attribution (right of paternity) and the right to object to any distortion, mutilation, or other modification of the Work that would be prejudicial to the Licensor's honor or reputation (right of integrity). In jurisdictions where moral rights are inalienable and non-waivable (including but not limited to France, Germany, Japan, China, and Mexico), these rights are preserved in full regardless of any contrary provision in this License. In jurisdictions where moral rights may be waived (including but not limited to the United States, United Kingdom, and Canada), the Licensor's moral rights are preserved to the extent not expressly waived in this License. No provision of this License shall be construed to require the Licensor to waive moral rights beyond what is permitted by applicable law.`,
    legal_basis: 'Berne Convention Article 6bis',
  }
}

function buildClause4_WarrantyOfAuthority(_params: CopyrightLicenseParams): object {
  return {
    clause_number: 4,
    title: 'Warranty of Authority',
    body: `The Licensor warrants that: (a) the Licensor is the rightful owner of the intellectual property rights in the Work or is otherwise authorized to grant this License; (b) the Work does not, to the best of the Licensor's knowledge, infringe upon the intellectual property rights of any third party; (c) the Licensor has the legal capacity and authority to enter into this License. THE WORK IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. The Licensor does not warrant that the Work will meet the Licensee's requirements or that the use of the Work will be uninterrupted or error-free.`,
  }
}

function buildClause5_TermAndTermination(params: CopyrightLicenseParams): object {
  const { durationDays, expiryTimestamp } = params

  let termText: string
  if (durationDays === 0 && (!expiryTimestamp || expiryTimestamp === 0)) {
    termText = 'This License is granted in perpetuity and continues indefinitely, unless terminated for material breach as described below.'
  } else {
    const expiryDate = expiryTimestamp
      ? new Date(expiryTimestamp * 1000).toISOString().split('T')[0]
      : 'as specified on-chain'
    termText = `This License is granted for a fixed term of ${durationDays} days from the date of execution, expiring on ${expiryDate}. Upon expiration, the Licensee must cease all use of the Work and destroy all copies in the Licensee's possession or control.`
  }

  termText += ' TERMINATION FOR BREACH: Either party may terminate this License upon 30 days written notice if the other party commits a material breach and fails to cure such breach within the 30-day notice period. Upon termination, the Licensee shall immediately cease all use of the Work, destroy all copies, and certify destruction in writing.'

  return {
    clause_number: 5,
    title: 'Term and Termination',
    body: termText,
    duration_days: durationDays,
    expiry_timestamp: expiryTimestamp ?? 0,
    is_perpetual: durationDays === 0 && (!expiryTimestamp || expiryTimestamp === 0),
  }
}

function buildClause5A_CCCureAndReinstatement(params: CopyrightLicenseParams): object | null {
  if (!isCCType(params.licenseType) || params.licenseType === 'cc0') return null

  return {
    clause_number: '5A',
    title: 'CC Cure and Reinstatement',
    body: `In accordance with Creative Commons 4.0 Section 6: (a) AUTOMATIC CURE: Where the Licensee has violated the terms of this License, the Licensee's rights are automatically reinstated if the violation is cured within 30 days of the Licensee becoming aware of the violation. (b) PROBATIONARY PERIOD: If the violation is cured within the 30-day period, the Licensee's rights are reinstated on a probationary basis for 60 days. A subsequent violation during the probationary period results in permanent termination. (c) EXPRESS REINSTATEMENT: The Licensor may expressly reinstate the Licensee's rights at any time, in writing. This cure-and-reinstatement mechanism applies to all conditions of the License, including attribution, non-commercial restrictions, share-alike obligations, and no-derivatives restrictions.`,
    legal_basis: 'Creative Commons 4.0 Section 6',
    applies_to: params.licenseType,
  }
}

function buildClause6_Territory(params: CopyrightLicenseParams): object {
  const { territory } = params

  let body = `This License is granted for the following territory: ${territory}.`

  if (territory === 'Worldwide') {
    body += ' The rights granted herein may be exercised in all countries and territories worldwide, subject to the sanctions compliance exclusion below.'
  }

  body += ` SANCTIONS COMPLIANCE: Notwithstanding any other provision of this License, the Licensee shall not exercise any rights granted herein in any manner that would violate applicable sanctions laws, including but not limited to: (a) United Nations Security Council sanctions; (b) United States OFAC (Office of Foreign Assets Control) sanctions; (c) European Union restrictive measures. Without limitation, this License may not be exercised in or for the benefit of persons or entities located in North Korea, Syria, Iran, or the occupied territories of Crimea, Donetsk, and Luhansk. Any attempted exercise of rights in violation of this provision is void ab initio.`

  return {
    clause_number: 6,
    title: 'Territory and Sanctions Compliance',
    body,
    territory,
  }
}

function buildClause7_Indemnification(): object {
  return {
    clause_number: 7,
    title: 'Indemnification',
    body: 'LICENSOR INDEMNITY: The Licensor shall indemnify, defend, and hold harmless the Licensee from and against any third-party claims, damages, losses, and expenses (including reasonable legal fees) arising out of a breach of the Licensor\'s warranty of authority (Clause 4), provided the Licensee gives prompt notice of the claim and reasonable cooperation in the defense. LICENSEE INDEMNITY: The Licensee shall indemnify, defend, and hold harmless the Licensor from and against any third-party claims, damages, losses, and expenses (including reasonable legal fees) arising out of the Licensee\'s use of the Work outside the scope of this License or in violation of its terms.',
  }
}

function buildClause8_LiabilityLimitation(): object {
  return {
    clause_number: 8,
    title: 'Limitation of Liability',
    body: 'TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW: (a) IN NO EVENT SHALL EITHER PARTY BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING BUT NOT LIMITED TO LOSS OF PROFITS, LOSS OF DATA, BUSINESS INTERRUPTION, OR LOSS OF GOODWILL, ARISING OUT OF OR IN CONNECTION WITH THIS LICENSE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES. (b) THE AGGREGATE LIABILITY OF THE LICENSOR UNDER THIS LICENSE SHALL NOT EXCEED THE TOTAL AMOUNT PAID BY THE LICENSEE FOR THIS LICENSE. (c) PLATFORM LIABILITY SHIELD: Soft.Law is a platform facilitating the creation, registration, and enforcement of intellectual property licenses. Soft.Law is not a party to this License agreement and bears no liability for the actions, omissions, or obligations of either the Licensor or the Licensee. The platform provides technological infrastructure only.',
  }
}

function buildClause9_DisputeResolution(params: CopyrightLicenseParams): object {
  const arbitratorAddress = params.arbitratorContractAddress ?? CONTRACT_ADDRESSES.GovernanceArbitrator

  return {
    clause_number: 9,
    title: 'Dispute Resolution',
    body: `Any dispute, controversy, or claim arising out of or relating to this License shall be resolved through the following tiered mechanism: (a) GOOD FAITH NEGOTIATION: The parties shall first attempt to resolve any dispute through good faith negotiation for a period of five (5) business days from the date one party notifies the other of the dispute. (b) SOFT.LAW COURT (ON-CHAIN ARBITRATION): If negotiation fails, either party may submit a dispute to the Soft.Law Court by calling submitDispute(licenseId, reason, proofURI) on the GovernanceArbitrator contract (${arbitratorAddress}). The dispute shall be resolved within 30 days by an independent arbitrator holding the ARBITRATOR_ROLE. The arbitrator shall review submitted evidence, allow a minimum 10-day respondent notice period, and issue a binding ruling via resolveDispute(). (c) RULING: The arbitrator's ruling is Approved (dispute upheld) or Rejected (dispute dismissed). This ruling is final and binding on the Soft.Law platform. (d) ON-CHAIN ENFORCEMENT: If the Soft.Law Court approves a dispute, any party may trigger enforcement by calling executeAward(disputeId) on the GovernanceArbitrator contract, which revokes the disputed License Token. This permissionless enforcement mechanism ensures approved rulings cannot be blocked by an uncooperative party. License revocation is the sole on-chain remedy available through the Soft.Law Court. An advisory 7-day grace period after approval is recommended to allow voluntary compliance before enforcement, but this grace period is not technically enforced on-chain. (e) WIPO FALLBACK: If the dispute cannot be resolved through the Soft.Law Court (including cases of technical infeasibility, cross-jurisdictional enforcement, physical asset claims, or expiration of the 30-day deadline), the parties agree to submit the dispute to binding arbitration under the WIPO Expedited Arbitration Rules, administered by the WIPO Arbitration and Mediation Center. The arbitration shall be conducted by a single arbitrator, in English, with the seat determined by WIPO. The award shall be final and enforceable under the New York Convention on the Recognition and Enforcement of Foreign Arbitral Awards (1958) in all 172 contracting states. (f) NO CLASS ACTIONS: All disputes shall be resolved on an individual basis. Neither party shall bring or participate in any class, consolidated, or representative action or proceeding.`,
    arbitrator_contract: arbitratorAddress,
    enforcement_mechanism: 'executeAward (permissionless)',
    fallback: 'WIPO Expedited Arbitration Rules',
  }
}

function buildClause10_GoverningLaw(): object {
  return {
    clause_number: 10,
    title: 'Governing Law',
    body: 'This License shall be governed by and construed in accordance with international conventional law, including but not limited to: (a) the Berne Convention for the Protection of Literary and Artistic Works (1886, as amended), establishing automatic copyright protection across 181 member states (Article 5(2)) and the national treatment principle (Article 5(1)); (b) the WIPO Copyright Treaty (1996), extending copyright to digital works including the making available right (Article 8) and protection of technological measures (Article 11); (c) the Agreement on Trade-Related Aspects of Intellectual Property Rights (TRIPS Agreement, 1994), establishing minimum IP protection standards across 164 WTO member states, including enforcement obligations (Articles 41-61) and recognition of computer programs as literary works (Article 10.1); (d) the UNCITRAL Model Law on International Commercial Arbitration (1985/2006), providing the procedural framework for dispute resolution under this License; (e) the UNCITRAL Model Law on Electronic Commerce (1996), recognizing the legal validity of electronic records (Article 5), electronic signatures (Article 7), and the admissibility of electronic evidence (Article 9). The national treatment principle under Article 5 of the Berne Convention shall apply: the intellectual property rights of each party shall be governed by the law of the jurisdiction where protection is claimed.',
    legal_framework: [
      'Berne Convention (1886)',
      'WIPO Copyright Treaty (1996)',
      'TRIPS Agreement (1994)',
      'UNCITRAL Model Law on Arbitration (1985/2006)',
      'UNCITRAL Model Law on E-Commerce (1996)',
    ],
  }
}

function buildClause11_Attribution(params: CopyrightLicenseParams): object {
  const { attribution, licensor, ipAssetId } = params

  let body: string
  if (attribution) {
    body = `ATTRIBUTION REQUIRED: The Licensee must provide reasonable attribution to the Licensor in all uses of the Work. Attribution shall include, at minimum: (a) the Licensor's wallet address (${licensor}); (b) the platform name (Soft.Law); (c) the License Token ID as recorded on-chain; (d) a statement such as "Licensed via Soft.Law" or equivalent. Attribution must be provided in a manner that is reasonable to the medium of use. For digital uses, a hyperlink to the Soft.Law platform or the on-chain record is acceptable. The Licensee shall not imply endorsement by the Licensor without express written consent.`
  } else {
    body = 'ATTRIBUTION NOT REQUIRED: The Licensor does not require attribution for uses of the Work under this License. Attribution is encouraged but optional. The Licensee may, at their discretion, credit the Licensor when using the Work.'
  }

  return {
    clause_number: 11,
    title: 'Attribution Requirements',
    body,
    attribution_required: attribution,
    licensor_address: licensor,
    ip_asset_id: ipAssetId,
  }
}

function buildClause12_BlockchainProof(params: CopyrightLicenseParams): object {
  const chainId = params.chainId ?? POLKADOT_HUB_CHAIN_ID
  const ipContract = params.ipContractAddress ?? CONTRACT_ADDRESSES.IPAsset
  const licenseContract = params.licenseContractAddress ?? CONTRACT_ADDRESSES.LicenseToken

  return {
    clause_number: 12,
    title: 'Blockchain Registration and Legal Evidence',
    body: `This License is registered on the Polkadot Hub blockchain (Chain ID: ${chainId}) and signed using the EIP-191 personal_sign standard. The parties acknowledge and agree that: (a) SIGNATURE VALIDITY: The Licensor's wallet signature constitutes a valid electronic signature under the EU eIDAS Regulation (Article 25(1)), the US ESIGN Act (15 USC 7001), the UNCITRAL Model Law on Electronic Commerce (Article 7), and applicable state legislation recognizing blockchain signatures (including Arizona ARS 44-7061, Wyoming SF 0125, Tennessee SB 1662). (b) ON-CHAIN RECORD: The blockchain record of this License, including the transaction hash, block number, and timestamp, constitutes admissible evidence of the existence and date of this License agreement. (c) IPFS VERIFICATION: The complete text of this License is stored on IPFS (InterPlanetary File System). The content hash (CID) is recorded on-chain as the publicMetadataURI of the License Token. Any party may independently verify that the document has not been altered by comparing the stored CID with the keccak256 hash of this document. (d) EVIDENTIARY VALUE: The blockchain record and IPFS document together establish prima facie evidence of: the date of license creation, the identity (wallet address) of the parties, the terms agreed upon, and the Licensor's consent via cryptographic signature. This evidence is recognized under the legal frameworks referenced in Clause 10.`,
    chain_id: chainId,
    network: getNetworkName(chainId),
    ip_contract: ipContract,
    license_contract: licenseContract,
    signature_standard: 'EIP-191 personal_sign',
    platform: 'Soft.Law',
  }
}

function buildClause13_Severability(): object {
  return {
    clause_number: 13,
    title: 'Severability',
    body: 'If any provision of this License is held to be invalid, illegal, or unenforceable by a court or tribunal of competent jurisdiction, such provision shall be modified to the minimum extent necessary to make it enforceable, or if modification is not possible, shall be severed from this License. The invalidity, illegality, or unenforceability of any provision shall not affect the validity or enforceability of the remaining provisions, which shall continue in full force and effect.',
  }
}

function buildClause14_Amendments(): object {
  return {
    clause_number: 14,
    title: 'Amendments and Modifications',
    body: 'This License may not be amended or modified except by a written instrument signed by both parties. Any purported amendment that is not in writing and signed by both parties shall have no force or effect. Notwithstanding the foregoing, the on-chain parameters of the License Token (including supply, expiry, and revocation status) may be updated through the smart contract mechanisms described herein without a separate written amendment.',
  }
}

function buildClause15_IPFSAndEntireAgreement(): object {
  return {
    clause_number: 15,
    title: 'IPFS Storage and Publicity',
    body: 'ENTIRE AGREEMENT: This License, together with the on-chain License Token parameters and any documents incorporated by reference, constitutes the entire agreement between the parties with respect to the subject matter hereof and supersedes all prior or contemporaneous agreements, understandings, negotiations, and discussions, whether oral or written. IPFS PUBLICITY ACKNOWLEDGMENT: The parties acknowledge and agree that this License document is stored on IPFS (InterPlanetary File System), a public, decentralized storage network. By executing this License, both parties acknowledge that: (a) the full text of this License is publicly accessible to anyone with the content identifier (CID); (b) the document cannot be deleted or modified once pinned to IPFS; (c) the parties\' wallet addresses are included in this publicly accessible document; (d) no confidential business information should be included in this License document. RIGHTS RUN WITH TOKEN: The rights granted under this License are appurtenant to the License Token and shall be exercisable by the current holder of the License Token. Upon valid transfer of the License Token through the smart contract mechanism, the transferee receives a direct license from the Licensor under the same terms, and the transferor\'s rights terminate.',
  }
}

function buildClause16_RemixRights(params: CopyrightLicenseParams): object | null {
  if (params.licenseType !== 'remix' && !params.remixRoyaltyBPS) return null

  const royaltyPercent = (params.remixRoyaltyBPS ?? 1500) / 100
  const revenueDistributor = params.revenueDistributorAddress ?? CONTRACT_ADDRESSES.RevenueDistributor
  const allowFurther = params.allowFurtherRemix ?? false

  return {
    clause_number: 16,
    title: 'Remix and Derivative Rights',
    body: `DERIVATIVE GRANT: The Licensee is granted the right to create derivative works ("Remixes") based on the Work, subject to the following conditions: (a) ATTRIBUTION CHAIN: Each Remix must clearly attribute the original Work, including the Licensor's wallet address, the original IP Asset ID, and the Soft.Law platform. Attribution must be preserved through all subsequent derivative generations. (b) REGISTRATION REQUIREMENT: Each Remix must be registered as a new IP asset on the Soft.Law platform by calling IPAsset.mintIP() with metadata linking to the original Work. Failure to register constitutes a material breach of this License. (c) REMIX ROYALTY OBLIGATION: The Licensee shall pay the Licensor a royalty of ${royaltyPercent}% of gross revenue from commercial exploitation of each Remix. Royalty payments are facilitated through the RevenueDistributor contract (${revenueDistributor}) using the configureSplit() function. For on-platform sales, royalty distribution is automatic. For off-platform revenue, the Licensee is legally obligated to report and remit royalties within 30 days of receipt. (d) FURTHER REMIXING: ${allowFurther ? 'The Licensee MAY authorize further remixes of their derivative work, provided that the original Licensor\'s royalty share is preserved in all downstream derivatives and the attribution chain is maintained.' : 'The Licensee may NOT authorize further remixes or derivative works based on their Remix without the express written consent of the original Licensor.'} (e) INTEGRITY: The Licensee shall not create any Remix that is defamatory, obscene, or otherwise harmful to the Licensor's reputation, in accordance with the moral rights preserved under Clause 3. (f) ENFORCEMENT: Violations of this clause are enforceable through the dispute resolution mechanism in Clause 9 (Plan A -- legal document enforcement). Revenue split violations are additionally subject to on-chain enforcement through the RevenueDistributor contract. (g) ROYALTY SPLIT ROUNDING: Due to integer arithmetic in the smart contract, royalty distributions may result in trace amounts (less than 1 token unit) being permanently locked. This is a known and accepted limitation of the on-chain enforcement mechanism.`,
    royalty_bps: params.remixRoyaltyBPS ?? 1500,
    royalty_percent: royaltyPercent,
    allow_further_remix: allowFurther,
    revenue_distributor: revenueDistributor,
  }
}

function buildClause17_AdditionalTerms(params: CopyrightLicenseParams): object | null {
  if (!params.customTerms) return null

  return {
    clause_number: 17,
    title: 'Additional Terms',
    body: `The following additional terms are agreed upon by the parties and form part of this License: ${params.customTerms}`,
    custom_terms: params.customTerms,
  }
}

// ============ Document Generation ============

export function generateCopyrightLicense(params: CopyrightLicenseParams): object {
  const now = Math.floor(Date.now() / 1000)
  const typeInfo = LICENSE_TYPES[params.licenseType]
  const chainId = params.chainId ?? POLKADOT_HUB_CHAIN_ID

  // Apply CC compliance rules
  const sanitizedParams = applyCCComplianceRules({ ...params })

  // Build all clauses
  const clauses: object[] = [
    buildClause1_GrantOfLicense(sanitizedParams),
    buildClause2_IPOwnership(sanitizedParams),
    buildClause3_MoralRights(),
    buildClause4_WarrantyOfAuthority(sanitizedParams),
    buildClause5_TermAndTermination(sanitizedParams),
  ]

  // Clause 5A: CC cure and reinstatement (CC types only, not CC0)
  const clause5A = buildClause5A_CCCureAndReinstatement(sanitizedParams)
  if (clause5A) clauses.push(clause5A)

  clauses.push(
    buildClause6_Territory(sanitizedParams),
    buildClause7_Indemnification(),
    buildClause8_LiabilityLimitation(),
    buildClause9_DisputeResolution(sanitizedParams),
    buildClause10_GoverningLaw(),
    buildClause11_Attribution(sanitizedParams),
    buildClause12_BlockchainProof(sanitizedParams),
    buildClause13_Severability(),
    buildClause14_Amendments(),
    buildClause15_IPFSAndEntireAgreement(),
  )

  // Clause 16: Remix rights (remix type or when royaltyBPS is set)
  const clause16 = buildClause16_RemixRights(sanitizedParams)
  if (clause16) clauses.push(clause16)

  // Clause 17: Additional/custom terms
  const clause17 = buildClause17_AdditionalTerms(sanitizedParams)
  if (clause17) clauses.push(clause17)

  return {
    document_type: 'copyright_license_agreement',
    document_version: '1.0',
    generated_at: now,
    generated_date: new Date(now * 1000).toISOString(),
    platform: 'Soft.Law',
    platform_url: 'https://soft.law',

    metadata: {
      license_type: sanitizedParams.licenseType,
      license_type_label: typeInfo.label,
      cc_type: typeInfo.ccType ?? null,
      cc_legal_code_url: getCCLegalCodeUrl(sanitizedParams.licenseType),
      chain_id: chainId,
      network: getNetworkName(chainId),
      ip_contract: sanitizedParams.ipContractAddress ?? CONTRACT_ADDRESSES.IPAsset,
      license_contract: sanitizedParams.licenseContractAddress ?? CONTRACT_ADDRESSES.LicenseToken,
      arbitrator_contract: sanitizedParams.arbitratorContractAddress ?? CONTRACT_ADDRESSES.GovernanceArbitrator,
      revenue_distributor: sanitizedParams.revenueDistributorAddress ?? CONTRACT_ADDRESSES.RevenueDistributor,
    },

    parties: {
      licensor: {
        address: sanitizedParams.licensor,
        role: 'Licensor / Rights Holder',
      },
      licensee: {
        address: sanitizedParams.licensee,
        role: 'Licensee',
      },
    },

    subject: {
      ip_asset_id: sanitizedParams.ipAssetId,
      ip_title: sanitizedParams.ipTitle ?? null,
      description: `Intellectual property asset registered on the Soft.Law platform (IP Asset #${sanitizedParams.ipAssetId})`,
    },

    terms: {
      license_type: sanitizedParams.licenseType,
      rights_granted: sanitizedParams.rights.map(r => ({
        key: r,
        label: getRightsLabel(r),
      })),
      is_exclusive: sanitizedParams.exclusive,
      is_commercial: sanitizedParams.commercial,
      requires_attribution: sanitizedParams.attribution,
      territory: sanitizedParams.territory,
      duration_days: sanitizedParams.durationDays,
      expiry_timestamp: sanitizedParams.expiryTimestamp ?? 0,
      is_perpetual: sanitizedParams.durationDays === 0 && (!sanitizedParams.expiryTimestamp || sanitizedParams.expiryTimestamp === 0),
      supply: sanitizedParams.supply,
      remix_royalty_bps: sanitizedParams.remixRoyaltyBPS ?? null,
      allow_further_remix: sanitizedParams.allowFurtherRemix ?? null,
    },

    governing_law: {
      framework: 'International Conventional Law',
      treaties: [
        'Berne Convention for the Protection of Literary and Artistic Works (1886)',
        'WIPO Copyright Treaty (1996)',
        'TRIPS Agreement (1994)',
        'UNCITRAL Model Law on International Commercial Arbitration (1985/2006)',
        'UNCITRAL Model Law on Electronic Commerce (1996)',
        'New York Convention on the Recognition and Enforcement of Foreign Arbitral Awards (1958)',
      ],
      signature_validity: [
        'EU eIDAS Regulation (Article 25)',
        'US ESIGN Act (15 USC 7001)',
        'UNCITRAL Model Law on E-Commerce (Article 7)',
      ],
    },

    clauses,

    enforcement: {
      plan_a: 'Legal document enforcement via dispute resolution (Clause 9). Covers: territory, commercial restrictions, attribution, CC conditions, moral rights, indemnification.',
      plan_b: 'On-chain automatic enforcement via smart contracts. Covers: payment timing, supply caps, exclusivity, expiry, revocation for missed payments (revokeForMissedPayments), revocation for approved disputes (executeAward).',
      dispute_contract: sanitizedParams.arbitratorContractAddress ?? CONTRACT_ADDRESSES.GovernanceArbitrator,
    },
  }
}

// ============ CC Compliance Rules ============

function applyCCComplianceRules(params: CopyrightLicenseParams): CopyrightLicenseParams {
  const p = { ...params }

  switch (p.licenseType) {
    case 'cc-by':
      p.attribution = true
      p.exclusive = false
      break

    case 'cc-by-nc':
      p.attribution = true
      p.commercial = false
      p.exclusive = false
      break

    case 'cc-by-nd':
      p.attribution = true
      p.exclusive = false
      p.rights = p.rights.filter(r => r !== 'create-derivatives')
      break

    case 'cc-by-sa':
      p.attribution = true
      p.exclusive = false
      break

    case 'cc0':
      p.attribution = false
      p.exclusive = false
      p.commercial = true
      p.rights = [
        'reproduce', 'distribute', 'display', 'perform',
        'create-derivatives', 'digital-use', 'communicate', 'sublicense',
      ]
      break

    case 'exclusive':
      p.exclusive = true
      break

    case 'remix':
      if (!p.rights.includes('create-derivatives')) {
        p.rights = [...p.rights, 'create-derivatives']
      }
      p.attribution = true
      break
  }

  return p
}

// ============ Document Hashing ============

export function computeDocumentHash(document: object): string {
  const jsonString = JSON.stringify(document)
  return keccak256(toHex(jsonString))
}

// ============ Signature Helpers ============

export function buildSignMessage(params: {
  licensor: string
  licensee: string
  ipAssetId: string
  hash: string
}): string {
  return [
    'Soft.Law Copyright License Agreement',
    '',
    `Licensor: ${params.licensor}`,
    `Licensee: ${params.licensee}`,
    `IP Asset ID: ${params.ipAssetId}`,
    `Document Hash: ${params.hash}`,
    '',
    'By signing this message, you confirm that you have reviewed and agree to the terms of the license document identified by the hash above.',
    '',
    'This signature is created using EIP-191 personal_sign and constitutes a valid electronic signature under applicable law (EU eIDAS, US ESIGN Act, UNCITRAL Model Law on E-Commerce).',
  ].join('\n')
}

export function wrapWithSignature(
  document: object,
  address: string,
  signature: string,
  hash: string,
): object {
  return {
    ...document,
    signature: {
      signer: address,
      sig: signature,
      document_hash: hash,
      method: 'EIP-191 personal_sign',
      signed_at: Math.floor(Date.now() / 1000),
      signed_date: new Date().toISOString(),
    },
  }
}

// ============ Wizard Integration Helpers ============

export type WizardType =
  | 'free-use'
  | 'personal-use'
  | 'commercial'
  | 'exclusive'
  | 'sole'
  | 'share-alike'

export interface WizardConstraints {
  attribution: 'optional' | 'required'
  derivatives: 'optional' | 'required'
}

/**
 * Legal-profile constraints shared by the wizard and document generator.
 * Fixed Creative Commons profiles cannot generate contradictory rights.
 */
export function getWizardConstraints(wizardType: WizardType): WizardConstraints {
  switch (wizardType) {
    case 'personal-use':
    case 'share-alike':
      return { attribution: 'required', derivatives: 'required' }
    default:
      return { attribution: 'optional', derivatives: 'optional' }
  }
}

export function mapWizardTypeToLegacyType(
  wizardType: WizardType,
  form: { attribution?: boolean; allowDerivatives?: boolean },
): LicenseType {
  switch (wizardType) {
    case 'free-use':
      if (!form.attribution) return 'cc0'
      if (!form.allowDerivatives) return 'cc-by-nd'
      return 'cc-by'
    case 'personal-use':
      return 'cc-by-nc'
    case 'commercial':
      if (form.allowDerivatives) return 'remix'
      return 'non-exclusive'
    case 'exclusive':
      return 'exclusive'
    case 'sole':
      return 'sole'
    case 'share-alike':
      return 'cc-by-sa'
  }
}

/** Resolve wizard state into a legally coherent license profile. */
export function resolveWizardProfile(
  wizardType: WizardType,
  form: { attribution?: boolean; allowDerivatives?: boolean },
) {
  const constraints = getWizardConstraints(wizardType)
  const attribution = constraints.attribution === 'required' ? true : Boolean(form.attribution)
  let allowDerivatives = constraints.derivatives === 'required' ? true : Boolean(form.allowDerivatives)
  const licenseType = mapWizardTypeToLegacyType(wizardType, { attribution, allowDerivatives })

  // CC0 is an unrestricted public-domain dedication. Stale UI state must not
  // turn it into a contradictory "CC0, but no derivatives" document.
  if (licenseType === 'cc0') allowDerivatives = true

  return { licenseType, attribution, allowDerivatives }
}

export function getSmartDefaults(wizardType: WizardType): {
  supply: number
  isExclusive: boolean
  expiryTime: number
  paymentInterval: number
  maxMissedPayments: number
  penaltyRateBPS: number
  commercial: boolean
  territory: string
  attribution: boolean
  rights: CopyrightRight[]
} {
  switch (wizardType) {
    case 'free-use':
      return {
        supply: 10000,
        isExclusive: false,
        expiryTime: 0,
        paymentInterval: 0,
        maxMissedPayments: 0,
        penaltyRateBPS: 0,
        commercial: true,
        territory: 'Worldwide',
        attribution: true,
        rights: ['reproduce', 'distribute', 'display', 'perform', 'create-derivatives', 'digital-use', 'communicate', 'sublicense'],
      }

    case 'personal-use':
      return {
        supply: 1000,
        isExclusive: false,
        expiryTime: 0,
        paymentInterval: 0,
        maxMissedPayments: 0,
        penaltyRateBPS: 0,
        commercial: false,
        territory: 'Worldwide',
        attribution: true,
        rights: ['reproduce', 'distribute', 'display', 'create-derivatives', 'digital-use'],
      }

    case 'commercial':
      return {
        // Recurring Marketplace V1 licenses are single-copy because payment state is per license.
        supply: 1,
        isExclusive: false,
        expiryTime: 0,
        paymentInterval: 2_592_000,
        maxMissedPayments: 0,
        penaltyRateBPS: 0,
        commercial: true,
        territory: 'Worldwide',
        attribution: false,
        rights: ['reproduce', 'distribute', 'display', 'digital-use'],
      }

    case 'exclusive':
      return {
        supply: 1,
        isExclusive: true,
        expiryTime: 0,
        paymentInterval: 2_592_000,
        maxMissedPayments: 3,
        penaltyRateBPS: 500,
        commercial: true,
        territory: 'Worldwide',
        attribution: false,
        rights: ['reproduce', 'distribute', 'display', 'perform', 'create-derivatives', 'digital-use', 'communicate', 'sublicense'],
      }

    case 'sole':
      return {
        supply: 1,
        isExclusive: true,
        expiryTime: 0,
        paymentInterval: 2_592_000,
        maxMissedPayments: 3,
        penaltyRateBPS: 500,
        commercial: true,
        territory: 'Worldwide',
        attribution: false,
        rights: ['reproduce', 'distribute', 'display', 'perform', 'create-derivatives', 'digital-use', 'communicate'],
      }

    case 'share-alike':
      return {
        supply: 10000,
        isExclusive: false,
        expiryTime: 0,
        paymentInterval: 0,
        maxMissedPayments: 0,
        penaltyRateBPS: 0,
        commercial: true,
        territory: 'Worldwide',
        attribution: true,
        rights: ['reproduce', 'distribute', 'display', 'perform', 'create-derivatives', 'digital-use', 'communicate', 'sublicense'],
      }
  }
}
