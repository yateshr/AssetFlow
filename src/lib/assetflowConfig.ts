import { kv } from '@/lib/db';
export type ConfigEntity = {
  id: string;
  name: string;
  code?: string;
  active: boolean;
};

export type NumberingComponentType =
  | 'company-prefix'
  | 'category-prefix'
  | 'asset-type-code'
  | 'location-code'
  | 'sequence';

export type AssetNumberingRule = {
  id: string;
  name: string;
  separator: string;
  sequenceDigits: number;
  components: NumberingComponentType[];
  active: boolean;
};

export type AssetFlowConfig = {
  organization: {
    id: string;
    companyName: string;
    legalName: string;
    currency: string;
    timezone: string;
  };
  numbering: {
    rules: AssetNumberingRule[];
    activeRuleId: string | null;
    companyPrefix: string;
    categoryPrefix: string;
    nextNumberByLocation: Record<string, number>;
  };
  locations: ConfigEntity[];
  departments: ConfigEntity[];
  assetTypes: ConfigEntity[];
};

export const CONFIG_STORAGE_KEY = 'assetflow-config-v2';

export function createEmptyConfig(): AssetFlowConfig {
  return {
    organization: {
      id: crypto.randomUUID(),
      companyName: '',
      legalName: '',
      currency: 'INR',
      timezone: '',
    },
    numbering: {
      rules: [],
      activeRuleId: null,
      companyPrefix: '',
      categoryPrefix: '',
      nextNumberByLocation: {},
    },
    locations: [],
    departments: [],
    assetTypes: [],
  };
}

export function loadConfig(): AssetFlowConfig {
  if (typeof window === 'undefined') return createEmptyConfig();

  try {
    const raw = kv.getItem(CONFIG_STORAGE_KEY);
    if (!raw) return createEmptyConfig();

    const parsed = JSON.parse(raw) as Partial<AssetFlowConfig>;
    const empty = createEmptyConfig();

    return {
      organization: { ...empty.organization, ...(parsed.organization || {}) },
      numbering: {
        ...empty.numbering,
        ...(parsed.numbering || {}),
        rules: Array.isArray(parsed.numbering?.rules) ? parsed.numbering!.rules! : [],
        nextNumberByLocation: parsed.numbering?.nextNumberByLocation || {},
      },
      locations: Array.isArray(parsed.locations) ? parsed.locations : [],
      departments: Array.isArray(parsed.departments) ? parsed.departments : [],
      assetTypes: Array.isArray(parsed.assetTypes) ? parsed.assetTypes : [],
    };
  } catch {
    return createEmptyConfig();
  }
}

export function saveConfig(config: AssetFlowConfig) {
  if (typeof window === 'undefined') return;
  kv.setItem(CONFIG_STORAGE_KEY, JSON.stringify(config));
}

export function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

export function normalizeCode(value: string) {
  return value.trim();
}

function valueForComponent(
  component: NumberingComponentType,
  config: AssetFlowConfig,
  location: ConfigEntity,
  assetType: ConfigEntity,
  sequence: number,
) {
  switch (component) {
    case 'company-prefix':
      return config.numbering.companyPrefix;
    case 'category-prefix':
      return config.numbering.categoryPrefix;
    case 'asset-type-code':
      return assetType.code || assetType.name;
    case 'location-code':
      return location.code || location.name;
    case 'sequence':
      return String(sequence).padStart(
        config.numbering.rules.find(r => r.id === config.numbering.activeRuleId)?.sequenceDigits || 1,
        '0',
      );
  }
}

export function getNextSequence(
  config: AssetFlowConfig,
  location: ConfigEntity,
  existingAssetTags: string[],
) {
  const configured = config.numbering.nextNumberByLocation[location.id] || 1;

  // We intentionally do not try to infer a customer's numbering convention
  // from source-code defaults. The configured counter is authoritative.
  // Existing tags may be used by an import/migration process to establish
  // the initial counter before normal creation starts.
  let next = configured;

  for (const tag of existingAssetTags) {
    const match = tag.match(/(\d+)$/);
    if (!match) continue;
    next = Math.max(next, Number(match[1]) + 1);
  }

  return next;
}

export function generateAssetTag(args: {
  config: AssetFlowConfig;
  location: ConfigEntity;
  assetType: ConfigEntity;
  existingAssetTags: string[];
}) {
  const rule = args.config.numbering.rules.find(
    r => r.id === args.config.numbering.activeRuleId && r.active,
  );

  if (!rule) {
    return {
      generated: false,
      assetTag: '',
      reason: 'No active asset-numbering rule has been configured.',
    };
  }

  if (!rule.components.length || !rule.components.includes('sequence')) {
    return {
      generated: false,
      assetTag: '',
      reason: 'The active numbering rule must contain a sequence component.',
    };
  }

  const sequence = getNextSequence(
    args.config,
    args.location,
    args.existingAssetTags,
  );

  const values = rule.components.map(component =>
    valueForComponent(component, args.config, args.location, args.assetType, sequence),
  );

  const assetTag = values.join(rule.separator);

  return {
    generated: true,
    assetTag,
    sequence,
    locationId: args.location.id,
    ruleId: rule.id,
  };
}

export function advanceLocationSequence(
  config: AssetFlowConfig,
  locationId: string,
  usedSequence: number,
) {
  return {
    ...config,
    numbering: {
      ...config.numbering,
      nextNumberByLocation: {
        ...config.numbering.nextNumberByLocation,
        [locationId]: usedSequence + 1,
      },
    },
  };
}
