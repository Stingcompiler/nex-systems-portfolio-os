import {
  Boxes,
  Building2,
  Calculator,
  GraduationCap,
  HeartHandshake,
  LayoutGrid,
  MonitorPlay,
  Pill,
  ScanBarcode,
  School,
  Stethoscope,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from 'lucide-react';

/**
 * أيقونة كل حل قطاعي: بالرابط أولًا (المدارس غير الجامعات، وكلها «تعليم»)،
 * ثم بالقطاع. مصدر واحد للرئيسية وقائمة «حلول لقطاعك» في الترويسة.
 */
const BY_SLUG: Record<string, LucideIcon> = {
  'school-management-system': School,
  'university-management-platform': GraduationCap,
  'elearning-platform': MonitorPlay,
  'pos-system': ScanBarcode,
  'restaurant-system': UtensilsCrossed,
  'pharmacy-system': Pill,
};

const BY_SECTOR: Record<string, LucideIcon> = {
  education: GraduationCap,
  retail: ScanBarcode,
  restaurants: UtensilsCrossed,
  pharmacy: Pill,
  healthcare: Stethoscope,
  accounting: Calculator,
  hr: Users,
  real_estate: Building2,
  logistics: Boxes,
  ngo: HeartHandshake,
};

export function sectorIcon(slug: string, sector?: string): LucideIcon {
  return BY_SLUG[slug] ?? (sector ? BY_SECTOR[sector] : undefined) ?? LayoutGrid;
}
