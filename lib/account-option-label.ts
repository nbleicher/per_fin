import type { AccountSubtype, OwnerType } from "@/lib/types/domain";

const OWNER_LABEL: Record<OwnerType, string> = {
  PERSONAL: "Personal",
  BUSINESS: "Business",
};

const SUBTYPE_LABEL: Record<AccountSubtype, string> = {
  CHECKING: "Checking",
  SAVINGS: "Savings",
  CREDIT: "Credit",
  LOAN: "Loan",
  INVESTMENT: "Investment",
};

export function formatAccountOptionLabel(account: {
  name: string;
  ownerType: OwnerType;
  accountSubtype: AccountSubtype;
}) {
  return `${account.name} - ${OWNER_LABEL[account.ownerType]} - ${SUBTYPE_LABEL[account.accountSubtype]}`;
}
