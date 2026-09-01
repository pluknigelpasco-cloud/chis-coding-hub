/**
 * PhilHealth Live CRS Client & Universal Parser
 * Connects directly to https://crs.philhealth.gov.ph/
 */

export interface CRSRecord {
  source: 'CRS' | 'LOCAL';
  code: string;
  description: string;
  effectivity: string;
  isCurrent: boolean;
  firstCaseRate: {
    applicable: boolean;
    hospitalFee: number;
    professionalFee: number;
    caseRate: number;
  };
  secondCaseRate: {
    applicable: boolean;
    hospitalFee: number;
    professionalFee: number;
    caseRate: number;
  };
  facilities: {
    level1: boolean;
    level2: boolean;
    level3: boolean;
    asc: boolean;
    pcf: boolean;
    mcp: boolean;
    fsdc: boolean;
    others: boolean;
  };
}

export async function fetchLiveCRS(query: string): Promise<CRSRecord[]> {
  const cleanQ = query.trim();
  if (cleanQ.length < 2) return [];

  const isRVS = /^\d{4,5}$/.test(cleanQ);
  const isICD = /^[A-Z]\d{2}/i.test(cleanQ);

  const params = new URLSearchParams();
  params.append('pDescription', isRVS || isICD ? '' : cleanQ);
  params.append('pICD', isICD ? cleanQ.toUpperCase() : '');
  params.append('pRVS', isRVS ? cleanQ : '');
  params.append('search', 'Search');

  try {
    const res = await fetch('https://crs.philhealth.gov.ph/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(8000), // 8s timeout
    });

    if (!res.ok) return [];
    const html = await res.text();
    return parseCRSSections(html, cleanQ);
  } catch (err: any) {
    console.warn('CRS fetch skipped:', err.message);
    return [];
  }
}

function cleanText(text: string): string {
  return String(text || '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&#39;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/&#42;|&ast;/gi, '*')
    .replace(/&#8224;|&dagger;/gi, '†')
    .replace(/&#8225;|&Dagger;/gi, '‡')
    .replace(/\s+/g, ' ')
    .trim();
}

function toNumber(val: string): number {
  return Number(String(val || '').replace(/,/g, '').replace(/[^\d.-]/g, '')) || 0;
}

function parseCRSSections(html: string, query: string): CRSRecord[] {
  const markerRegex = /Effectivity\s*Date:\s*<i>([\s\S]*?)<\/i>/gi;
  const markers: { index: number; effectivity: string }[] = [];
  let match;

  while ((match = markerRegex.exec(html)) !== null) {
    markers.push({
      index: match.index,
      effectivity: cleanText(match[1]),
    });
  }

  if (!markers.length) return [];

  const sections: { effectivity: string; html: string }[] = [];
  for (let i = 0; i < markers.length; i++) {
    const start = markers[i].index;
    const end = i + 1 < markers.length ? markers[i + 1].index : html.length;
    sections.push({
      effectivity: markers[i].effectivity,
      html: html.substring(start, end),
    });
  }

  const results: CRSRecord[] = [];

  sections.forEach(sec => {
    const isCurrent = /onwards/i.test(sec.effectivity);

    // Extract table rows with code and description
    const rowRegex = /<td[^>]*>([\s\S]*?)<\/td>\s*<td[^>]*class=["']item_desc_style_css["'][^>]*>([\s\S]*?)<\/td>/gi;
    let rowMatch;

    while ((rowMatch = rowRegex.exec(sec.html)) !== null) {
      const code = cleanText(rowMatch[1]).toUpperCase().replace(/\s+/g, '').replace(/[＊﹡]/g, '*');
      const description = cleanText(rowMatch[2]);

      const isRecognizedCode = /^(?:[A-Z][0-9]{2}(?:\.[0-9A-Z]{1,4})?[*†‡]?|[0-9]{4,5}|[A-Z][A-Z0-9]{2,9})$/i.test(code);
      if (!code || !description || !isRecognizedCode) continue;

      const recordStart = rowMatch.index;
      const recordHtml = sec.html.substring(recordStart);

      // Primary case rate
      const primaryMatch = recordHtml.match(
        /id="pPrimaryHCIFee"[^>]*>([\s\S]*?)<\/td>[\s\S]*?id="pPrimaryProfFee"[^>]*>([\s\S]*?)<\/td>[\s\S]*?id="pPrimaryCaseRate"[^>]*>([\s\S]*?)<\/td>/i
      );

      const firstCaseRate = primaryMatch ? {
        applicable: true,
        hospitalFee: toNumber(primaryMatch[1]),
        professionalFee: toNumber(primaryMatch[2]),
        caseRate: toNumber(primaryMatch[3]),
      } : { applicable: false, hospitalFee: 0, professionalFee: 0, caseRate: 0 };

      // Secondary case rate
      const secMatch = recordHtml.match(
        /id="pSecondaryHCIFee"[^>]*>([\s\S]*?)<\/td>[\s\S]*?id="pSecondaryProfFee"[^>]*>([\s\S]*?)<\/td>[\s\S]*?id="pSecondaryCaseRate"[^>]*>([\s\S]*?)<\/td>/i
      );

      const secondCaseRate = secMatch ? {
        applicable: true,
        hospitalFee: toNumber(secMatch[1]),
        professionalFee: toNumber(secMatch[2]),
        caseRate: toNumber(secMatch[3]),
      } : { applicable: false, hospitalFee: 0, professionalFee: 0, caseRate: 0 };

      // Facilities
      const facilities = {
        level1: /pCheckFacilityH1[^>]*>[\s\S]*?checkmark\.png/i.test(recordHtml),
        level2: /pCheckFacilityH2[^>]*>[\s\S]*?checkmark\.png/i.test(recordHtml),
        level3: /pCheckFacilityH3[^>]*>[\s\S]*?checkmark\.png/i.test(recordHtml),
        asc: /pCheckFacilityASC[^>]*>[\s\S]*?checkmark\.png/i.test(recordHtml),
        pcf: /pCheckFacilityPCF[^>]*>[\s\S]*?checkmark\.png/i.test(recordHtml),
        mcp: /pCheckFacilityMAT[^>]*>[\s\S]*?checkmark\.png/i.test(recordHtml),
        fsdc: /pCheckFacilityFSDC[^>]*>[\s\S]*?checkmark\.png/i.test(recordHtml),
        others: /pOtherHCIs[^>]*>[\s\S]*?checkmark\.png/i.test(recordHtml),
      };

      results.push({
        source: 'CRS',
        code,
        description,
        effectivity: sec.effectivity,
        isCurrent,
        firstCaseRate,
        secondCaseRate,
        facilities,
      });
    }
  });

  return results;
}
