// TLS certificate validity + DNS records
import tls from 'node:tls';
import dns from 'node:dns/promises';

const CAT = 'Technisch';

function checkTls(hostname, port = 443) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host: hostname, port, servername: hostname, rejectUnauthorized: false }, () => {
      const cert = socket.getPeerCertificate();
      socket.end();
      if (!cert || !cert.subject) return reject(new Error('Geen cert ontvangen'));
      resolve({
        subject: cert.subject,
        issuer: cert.issuer,
        validFrom: cert.valid_from,
        validTo: cert.valid_to,
        authorized: socket.authorized,
        protocol: socket.getProtocol(),
      });
    });
    socket.on('error', reject);
    socket.setTimeout(8000, () => { socket.destroy(); reject(new Error('TLS timeout')); });
  });
}

export async function run({ targetProd, emit }) {
  if (!targetProd) {
    emit({ id: 'tls.skip', title: 'TLS / DNS checks', category: CAT, level: 'warn', message: 'Geen productie-URL' });
    return;
  }

  const u = new URL(targetProd);
  const host = u.hostname;
  const apex = host.replace(/^www\./, '');

  // 1. TLS certificate
  try {
    const cert = await checkTls(host);
    const validTo = new Date(cert.validTo);
    const daysLeft = Math.floor((validTo - Date.now()) / 86400000);
    const ok = cert.authorized && daysLeft > 30;
    emit({
      id: 'tls.cert',
      title: 'SSL/TLS certificaat geldig + ≥ 30 dagen',
      category: CAT,
      level: ok ? 'pass' : daysLeft > 7 ? 'warn' : 'fail',
      message: `${cert.issuer?.O || '?'} | verloopt ${cert.validTo} (${daysLeft}d) | ${cert.protocol}`,
      metric: daysLeft,
      detail: cert,
    });
  } catch (e) {
    emit({ id: 'tls.cert', title: 'SSL/TLS certificaat', category: CAT, level: 'fail', message: e.message });
  }

  // 2. DNS records
  const recordTypes = ['A', 'AAAA', 'CNAME', 'MX', 'TXT'];
  for (const type of recordTypes) {
    try {
      const records = await (type === 'A' ? dns.resolve4(host) :
                            type === 'AAAA' ? dns.resolve6(host) :
                            type === 'CNAME' ? dns.resolveCname(host) :
                            type === 'MX' ? dns.resolveMx(apex) :
                            dns.resolveTxt(apex));
      const formatted = records.flat().map(r => typeof r === 'object' ? JSON.stringify(r) : r).join(', ');
      emit({
        id: `dns.${type.toLowerCase()}`,
        title: `DNS ${type} record voor ${type === 'MX' || type === 'TXT' ? apex : host}`,
        category: CAT,
        level: records.length ? 'pass' : 'warn',
        message: formatted.slice(0, 200) || 'Geen records',
        detail: records,
      });
    } catch (e) {
      const optional = ['AAAA', 'CNAME', 'MX', 'TXT'].includes(type);
      emit({
        id: `dns.${type.toLowerCase()}`,
        title: `DNS ${type} record`,
        category: CAT,
        level: optional ? 'warn' : 'fail',
        message: e.code || e.message,
      });
    }
  }

  // 3. SPF / DMARC quick check
  try {
    const txt = (await dns.resolveTxt(apex)).flat();
    const spf = txt.find(t => t.startsWith('v=spf1'));
    emit({ id: 'dns.spf', title: 'SPF record aanwezig', category: CAT, level: spf ? 'pass' : 'warn', message: spf || 'Niet gevonden' });
  } catch { emit({ id: 'dns.spf', title: 'SPF record', category: CAT, level: 'warn', message: 'Niet beschikbaar' }); }

  try {
    const dmarc = (await dns.resolveTxt(`_dmarc.${apex}`)).flat();
    emit({ id: 'dns.dmarc', title: 'DMARC record aanwezig', category: CAT, level: dmarc.length ? 'pass' : 'warn', message: dmarc.join(' ') || 'Niet gevonden' });
  } catch { emit({ id: 'dns.dmarc', title: 'DMARC record', category: CAT, level: 'warn', message: 'Niet ingesteld' }); }
}
