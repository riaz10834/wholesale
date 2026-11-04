export type PkBankGroup = "Banks" | "Wallets" | "Microfinance";

export type PkBank = {
  name: string;
  short: string;
  color: string;
  group: PkBankGroup;
  aliases: string;
};

/** Pakistani banks and the wallets people actually transfer to. */
export const PK_BANKS: PkBank[] = [
  { name: "Al Baraka Bank", short: "ABB", color: "#0057A8", group: "Banks", aliases: "albaraka al-baraka" },
  { name: "Allied Bank", short: "ABL", color: "#0047BB", group: "Banks", aliases: "allied bank limited" },
  { name: "Askari Bank", short: "AKBL", color: "#8B1E3F", group: "Banks", aliases: "askari" },
  { name: "Bank AL Habib", short: "BAHL", color: "#003DA5", group: "Banks", aliases: "al habib alhabib bank al-habib" },
  { name: "Bank Alfalah", short: "BAFL", color: "#E10600", group: "Banks", aliases: "alfalah" },
  { name: "Bank Makramah", short: "BMK", color: "#0A4D8C", group: "Banks", aliases: "summit bank makramah" },
  { name: "Bank of China", short: "BOC", color: "#A71E32", group: "Banks", aliases: "china" },
  { name: "BankIslami", short: "BIPL", color: "#0E8A4A", group: "Banks", aliases: "bank islami islami" },
  { name: "Citibank", short: "CITI", color: "#003B70", group: "Banks", aliases: "citi citibank" },
  { name: "Deutsche Bank", short: "DB", color: "#0018A8", group: "Banks", aliases: "deutsche" },
  { name: "Dubai Islamic Bank", short: "DIB", color: "#006747", group: "Banks", aliases: "dib dubai islamic" },
  { name: "Faysal Bank", short: "FAYS", color: "#00A651", group: "Banks", aliases: "faysal faisal" },
  { name: "First Women Bank", short: "FWBL", color: "#9D1C4A", group: "Banks", aliases: "women bank fwbl" },
  { name: "Habib Bank Limited", short: "HBL", color: "#007A33", group: "Banks", aliases: "hbl habib bank" },
  { name: "Habib Metropolitan Bank", short: "HMB", color: "#1B4F9C", group: "Banks", aliases: "habib metro metropolitan habibmetro" },
  { name: "ICBC", short: "ICBC", color: "#C8102E", group: "Banks", aliases: "industrial commercial bank of china icbc" },
  { name: "JS Bank", short: "JS", color: "#002F6C", group: "Banks", aliases: "jsbank js bank" },
  { name: "MCB Bank", short: "MCB", color: "#C8102E", group: "Banks", aliases: "muslim commercial bank mcb" },
  { name: "MCB Islamic Bank", short: "MCBI", color: "#0F6B3C", group: "Banks", aliases: "mcb islamic mib" },
  { name: "Meezan Bank", short: "MEZN", color: "#00843D", group: "Banks", aliases: "meezan mezan" },
  { name: "National Bank of Pakistan", short: "NBP", color: "#006B3F", group: "Banks", aliases: "nbp national bank" },
  { name: "Punjab Provincial Cooperative Bank", short: "PPCB", color: "#0E6B3A", group: "Banks", aliases: "ppcbl cooperative" },
  { name: "Samba Bank", short: "SBL", color: "#003087", group: "Banks", aliases: "samba" },
  { name: "Silkbank", short: "SILK", color: "#6B2D8B", group: "Banks", aliases: "silk bank silkbank" },
  { name: "Sindh Bank", short: "SNDB", color: "#1F7A3A", group: "Banks", aliases: "sindh bank" },
  { name: "SME Bank", short: "SME", color: "#1D4E89", group: "Banks", aliases: "sme bank" },
  { name: "Soneri Bank", short: "SON", color: "#F15A22", group: "Banks", aliases: "soneri" },
  { name: "Standard Chartered", short: "SCB", color: "#007A33", group: "Banks", aliases: "standard chartered scb stanchart" },
  { name: "The Bank of Khyber", short: "BOK", color: "#0D6B3C", group: "Banks", aliases: "khyber bok" },
  { name: "The Bank of Punjab", short: "BOP", color: "#0A7A32", group: "Banks", aliases: "bank of punjab bop" },
  { name: "United Bank Limited", short: "UBL", color: "#0033A0", group: "Banks", aliases: "ubl united bank" },
  { name: "Zarai Taraqiati Bank", short: "ZTBL", color: "#2E7D32", group: "Banks", aliases: "ztbl zarai agricultural" },

  { name: "EasyPaisa", short: "EP", color: "#00A650", group: "Wallets", aliases: "easy paisa easypaisa telenor microfinance" },
  { name: "JazzCash", short: "JC", color: "#E10600", group: "Wallets", aliases: "jazz cash jazzcash mobilink microfinance" },
  { name: "NayaPay", short: "NAYA", color: "#00B2A9", group: "Wallets", aliases: "naya pay nayapay" },
  { name: "SadaPay", short: "SADA", color: "#6C3CE0", group: "Wallets", aliases: "sada pay sadapay" },
  { name: "TAG", short: "TAG", color: "#111827", group: "Wallets", aliases: "tag finja" },
  { name: "UPaisa", short: "UP", color: "#F58220", group: "Wallets", aliases: "u paisa upaisa u bank u microfinance" },
  { name: "Zindigi", short: "ZIND", color: "#7B2D8E", group: "Wallets", aliases: "zindigi js wallet" },

  { name: "Advans Microfinance Bank", short: "ADV", color: "#0B6E4F", group: "Microfinance", aliases: "advans" },
  { name: "Apna Microfinance Bank", short: "APNA", color: "#C2410C", group: "Microfinance", aliases: "apna bank" },
  { name: "FINCA Microfinance Bank", short: "FINC", color: "#B45309", group: "Microfinance", aliases: "finca" },
  { name: "First MicroFinance Bank", short: "FMFB", color: "#1D4ED8", group: "Microfinance", aliases: "fmfb first microfinance" },
  { name: "HBL Microfinance Bank", short: "HBLM", color: "#15803D", group: "Microfinance", aliases: "hbl microfinance konnect" },
  { name: "Kashf Microfinance Bank", short: "KASH", color: "#BE185D", group: "Microfinance", aliases: "kashf" },
  { name: "Khushhali Microfinance Bank", short: "KMBL", color: "#047857", group: "Microfinance", aliases: "khushhali khushali" },
  { name: "NRSP Microfinance Bank", short: "NRSP", color: "#0369A1", group: "Microfinance", aliases: "nrsp" },
  { name: "Pak-Oman Microfinance Bank", short: "POMB", color: "#7C2D12", group: "Microfinance", aliases: "pak oman pak-oman" },
  { name: "Sindh Microfinance Bank", short: "SMFB", color: "#3F6212", group: "Microfinance", aliases: "sindh microfinance" },
];

export function findBank(name: string | null | undefined) {
  const n = name?.trim().toLowerCase();
  if (!n) return undefined;
  return PK_BANKS.find((b) => b.name.toLowerCase() === n || b.short.toLowerCase() === n);
}

export function filterBanks(query: string) {
  const q = query.trim().toLowerCase();
  if (!q) return PK_BANKS;
  const parts = q.split(/\s+/);
  return PK_BANKS.filter((b) => {
    const hay = `${b.name} ${b.short} ${b.aliases}`.toLowerCase();
    return parts.every((part) => hay.includes(part));
  });
}
