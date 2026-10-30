import {
  Briefcase,
  Cog,
  Gem,
  Hammer,
  Pill,
  Shirt,
  Smartphone,
  Factory,
  Grid2x2,
  Scale,
  Store,
  Truck,
  UtensilsCrossed,
  Warehouse,
  Wrench,
  type LucideIcon,
} from 'lucide-react';

import type { UbShopKind } from 'src/design-system';
import type { ModuleCode } from 'src/types/domain.types';

/**
 * PLT-03 FR-7 — the nine business types and, for the summary card only, the
 * client's copy of what each one turns on.
 *
 * **The server is authoritative** (FR-5: `services.onboarding.apply_preset`).
 * This table exists so step 4 can show the merchant what is about to happen
 * before they press the button — not so the client can apply anything. If the
 * two ever disagree, the server wins and the summary is the thing that is
 * wrong, which is why every field here is display data and none of it is sent.
 *
 * Canon §0.2 / FR-8: a business type NEVER hard-wires behaviour. Everything
 * below is a default that PLT-06 and PLT-07 can change afterwards, and changing
 * the type later does not re-apply any of it.
 */
export const BUSINESS_TYPES = [
  // R-DEC-63 — the design's shop kinds, stored types of their own.
  'hardware',
  'kirana',
  'medical',
  'electronics',
  'garments',
  'auto_parts',
  'jewellery',
  'retail',
  'wholesale',
  'distribution',
  'services',
  'trader',
  'manufacturer',
  'professional',
  'food',
  'other',
] as const;

export type BusinessType = (typeof BUSINESS_TYPES)[number];

export interface BusinessTypeConfig {
  readonly value: BusinessType;
  readonly icon: LucideIcon;
  /** i18n key — never a literal (§19.11.3). */
  readonly labelId: string;
  /** §8 — "tiles show a one-line hint of what they turn on". */
  readonly hintId: string;
  readonly inventoryEnabled: boolean;
  /** FR-7's default due days: 7, 15 or 30. */
  readonly defaultDueDays: number;
  /** UQC codes, shown verbatim; they are statutory codes, not copy. */
  readonly favouriteUnits: readonly string[];
  /** Extra expense categories seeded ON TOP of the nine system ones. */
  readonly extraExpenseCategoryIds: readonly string[];
}

export const BUSINESS_TYPE_CONFIG: Readonly<Record<BusinessType, BusinessTypeConfig>> = {
  hardware: {
    value: 'hardware',
    icon: Hammer,
    labelId: 'onboarding.type.hardware',
    hintId: 'onboarding.type.hardware.hint',
    inventoryEnabled: true,
    defaultDueDays: 15,
    favouriteUnits: ['NOS', 'PCS', 'BOX', 'KGS', 'MTR', 'LTR'],
    extraExpenseCategoryIds: ['onboarding.expense.loading', 'onboarding.expense.transport'],
  },
  kirana: {
    value: 'kirana',
    icon: Store,
    labelId: 'onboarding.type.kirana',
    hintId: 'onboarding.type.kirana.hint',
    inventoryEnabled: true,
    defaultDueDays: 7,
    favouriteUnits: ['NOS', 'KGS', 'GMS', 'LTR', 'PAC'],
    extraExpenseCategoryIds: ['onboarding.expense.packaging', 'onboarding.expense.shopMaintenance'],
  },
  medical: {
    value: 'medical',
    icon: Pill,
    labelId: 'onboarding.type.medical',
    hintId: 'onboarding.type.medical.hint',
    inventoryEnabled: true,
    defaultDueDays: 7,
    favouriteUnits: ['NOS', 'BOX', 'BTL', 'PAC', 'MLT'],
    extraExpenseCategoryIds: ['onboarding.expense.packaging', 'onboarding.expense.shopMaintenance'],
  },
  electronics: {
    value: 'electronics',
    icon: Smartphone,
    labelId: 'onboarding.type.electronics',
    hintId: 'onboarding.type.electronics.hint',
    inventoryEnabled: true,
    defaultDueDays: 7,
    favouriteUnits: ['NOS', 'PCS', 'SET', 'BOX', 'MTR'],
    extraExpenseCategoryIds: ['onboarding.expense.repairs', 'onboarding.expense.shopMaintenance'],
  },
  garments: {
    value: 'garments',
    icon: Shirt,
    labelId: 'onboarding.type.garments',
    hintId: 'onboarding.type.garments.hint',
    inventoryEnabled: true,
    defaultDueDays: 7,
    favouriteUnits: ['NOS', 'PCS', 'PRS', 'SET', 'MTR'],
    extraExpenseCategoryIds: ['onboarding.expense.packaging', 'onboarding.expense.shopMaintenance'],
  },
  auto_parts: {
    value: 'auto_parts',
    icon: Cog,
    labelId: 'onboarding.type.auto_parts',
    hintId: 'onboarding.type.auto_parts.hint',
    inventoryEnabled: true,
    defaultDueDays: 15,
    favouriteUnits: ['NOS', 'PCS', 'SET', 'LTR', 'BOX'],
    extraExpenseCategoryIds: ['onboarding.expense.transport', 'onboarding.expense.shopMaintenance'],
  },
  jewellery: {
    value: 'jewellery',
    icon: Gem,
    labelId: 'onboarding.type.jewellery',
    hintId: 'onboarding.type.jewellery.hint',
    inventoryEnabled: true,
    defaultDueDays: 7,
    favouriteUnits: ['GMS', 'NOS', 'PCS'],
    extraExpenseCategoryIds: ['onboarding.expense.makingCharges', 'onboarding.expense.shopMaintenance'],
  },
  retail: {
    value: 'retail',
    icon: Store,
    labelId: 'onboarding.type.retail',
    hintId: 'onboarding.type.retail.hint',
    inventoryEnabled: true,
    defaultDueDays: 7,
    favouriteUnits: ['NOS', 'KGS', 'GMS', 'LTR', 'PAC'],
    extraExpenseCategoryIds: ['onboarding.expense.packaging', 'onboarding.expense.shopMaintenance'],
  },
  wholesale: {
    value: 'wholesale',
    icon: Warehouse,
    labelId: 'onboarding.type.wholesale',
    hintId: 'onboarding.type.wholesale.hint',
    inventoryEnabled: true,
    defaultDueDays: 15,
    favouriteUnits: ['NOS', 'BOX', 'BAG', 'KGS', 'QTL', 'DOZ'],
    extraExpenseCategoryIds: ['onboarding.expense.loading', 'onboarding.expense.godownRent'],
  },
  distribution: {
    value: 'distribution',
    icon: Truck,
    labelId: 'onboarding.type.distribution',
    hintId: 'onboarding.type.distribution.hint',
    inventoryEnabled: true,
    defaultDueDays: 15,
    favouriteUnits: ['BOX', 'PAC', 'NOS', 'BAG', 'DOZ'],
    extraExpenseCategoryIds: [
      'onboarding.expense.fuel',
      'onboarding.expense.vehicleMaintenance',
      'onboarding.expense.schemeDiscounts',
    ],
  },
  services: {
    value: 'services',
    icon: Wrench,
    labelId: 'onboarding.type.services',
    hintId: 'onboarding.type.services.hint',
    inventoryEnabled: false,
    defaultDueDays: 30,
    favouriteUnits: ['NOS'],
    extraExpenseCategoryIds: ['onboarding.expense.tools', 'onboarding.expense.travel'],
  },
  trader: {
    value: 'trader',
    icon: Scale,
    labelId: 'onboarding.type.trader',
    hintId: 'onboarding.type.trader.hint',
    inventoryEnabled: true,
    defaultDueDays: 15,
    favouriteUnits: ['KGS', 'QTL', 'TON', 'BAG', 'NOS'],
    extraExpenseCategoryIds: ['onboarding.expense.commission', 'onboarding.expense.mandi'],
  },
  manufacturer: {
    value: 'manufacturer',
    icon: Factory,
    labelId: 'onboarding.type.manufacturer',
    hintId: 'onboarding.type.manufacturer.hint',
    inventoryEnabled: true,
    defaultDueDays: 15,
    favouriteUnits: ['KGS', 'NOS', 'MTR', 'SET', 'LTR'],
    extraExpenseCategoryIds: [
      'onboarding.expense.rawMaterial',
      'onboarding.expense.jobWork',
      'onboarding.expense.machineMaintenance',
    ],
  },
  professional: {
    value: 'professional',
    icon: Briefcase,
    labelId: 'onboarding.type.professional',
    hintId: 'onboarding.type.professional.hint',
    inventoryEnabled: false,
    defaultDueDays: 30,
    favouriteUnits: ['NOS'],
    extraExpenseCategoryIds: [
      'onboarding.expense.professionalFees',
      'onboarding.expense.software',
      'onboarding.expense.travel',
    ],
  },
  food: {
    value: 'food',
    icon: UtensilsCrossed,
    labelId: 'onboarding.type.food',
    hintId: 'onboarding.type.food.hint',
    inventoryEnabled: true,
    defaultDueDays: 7,
    favouriteUnits: ['NOS', 'KGS', 'LTR', 'PAC', 'BTL'],
    extraExpenseCategoryIds: [
      'onboarding.expense.gas',
      'onboarding.expense.rawMaterial',
      'onboarding.expense.delivery',
    ],
  },
  other: {
    value: 'other',
    icon: Grid2x2,
    labelId: 'onboarding.type.other',
    hintId: 'onboarding.type.other.hint',
    inventoryEnabled: true,
    defaultDueDays: 30,
    favouriteUnits: ['NOS', 'KGS', 'LTR'],
    extraExpenseCategoryIds: [],
  },
};

/**
 * B1 — the ten tiles of "What do you sell?", in the design's order (`TILES`),
 * each with the design's picture and its stored type (R-DEC-63). Sweets,
 * bakery and café is the existing `food`; the Wholesale tile is `wholesale`.
 * The four older broad types stay valid for a business that has one, and are
 * not offered at sign-up.
 */
export const SHOP_KIND_TILES: readonly {
  readonly value: BusinessType;
  readonly picture: UbShopKind;
  readonly labelId: string;
  readonly hintId: string;
}[] = [
  { value: 'kirana', picture: 'kirana', labelId: 'onboarding.tile.kirana', hintId: 'onboarding.tile.kirana.hint' },
  { value: 'medical', picture: 'medical', labelId: 'onboarding.tile.medical', hintId: 'onboarding.tile.medical.hint' },
  { value: 'electronics', picture: 'mobile', labelId: 'onboarding.tile.electronics', hintId: 'onboarding.tile.electronics.hint' },
  { value: 'garments', picture: 'garments', labelId: 'onboarding.tile.garments', hintId: 'onboarding.tile.garments.hint' },
  { value: 'hardware', picture: 'hardware', labelId: 'onboarding.tile.hardware', hintId: 'onboarding.tile.hardware.hint' },
  { value: 'auto_parts', picture: 'auto', labelId: 'onboarding.tile.auto_parts', hintId: 'onboarding.tile.auto_parts.hint' },
  { value: 'wholesale', picture: 'wholesale', labelId: 'onboarding.tile.wholesale', hintId: 'onboarding.tile.wholesale.hint' },
  { value: 'food', picture: 'cafe', labelId: 'onboarding.tile.food', hintId: 'onboarding.tile.food.hint' },
  { value: 'jewellery', picture: 'jewel', labelId: 'onboarding.tile.jewellery', hintId: 'onboarding.tile.jewellery.hint' },
  { value: 'other', picture: 'other', labelId: 'onboarding.tile.other', hintId: 'onboarding.tile.other.hint' },
];

/** BP-22 §5 — up to this many more kinds under one GSTIN (server: MAX_EXTRA_TYPES). */
export const MAX_EXTRA_TYPES = 3;

/**
 * FR-7 — the modules every business gets, before `inventory` and before the
 * partner and plan intersection the server applies (EC-6: a partner without
 * `inventory` silently drops it and the summary says so).
 *
 * `team` in FR-7's list is `platform` in canon §0.3's module map — the client
 * uses the canon spelling, because `ModuleCode` is that list.
 */
export const BASE_MODULES: readonly ModuleCode[] = [
  'platform',
  'ledger',
  'parties',
  'sales',
  'purchases',
  'payments',
  'expenses',
  'reports',
  'notifications',
  'import_export',
];

/** FR-7 — the preset's modules for a type, before the server's intersection. */
export const presetModules = (type: BusinessType): readonly ModuleCode[] =>
  BUSINESS_TYPE_CONFIG[type].inventoryEnabled ? [...BASE_MODULES, 'inventory'] : BASE_MODULES;

/** PLT-03 §7 — the wizard is four steps and no more (§32.4.7's risk row). */
/**
 * Re-exported from `./onboardingSteps` so every existing caller keeps working.
 * They live there because `onboardingSlice` imports `ONBOARDING_STEP_COUNT`,
 * and anything a slice imports is in the store, which is in `AppProviders`,
 * which is on every route — see that file's header.
 */
export { ONBOARDING_STEP_COUNT, ONBOARDING_STEPS } from './onboardingSteps';

/** FR-3 — the GST registration status, which decides the document kinds (BR-2). */
export const GST_TYPES = ['unregistered', 'composition', 'regular'] as const;
export type GstType = (typeof GST_TYPES)[number];
