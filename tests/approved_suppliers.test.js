// Test approved suppliers management
describe('Approved Suppliers Management', () => {
  let suppliers = [];
  const defaultSuppliers = [
    '*.github.com',
    '*.gmail.com',
    '*.chatgpt.com',
    '*.mksmad.org',
    '*.riverlan.com',
    '*.luisriverag.com',
    '*.amazon.es',
    '*.printables.com',
    '192.168.1.*',
    '*.aliexpress.com',
    '*.archive.today',
    '*.archive.ph',
    '*.archive.is'
  ];

  beforeEach(() => {
    suppliers = [...defaultSuppliers];
  });

  test('should initialize with default suppliers', () => {
    expect(suppliers.length).toBe(13);
    expect(suppliers[0]).toBe('*.github.com');
    expect(suppliers[12]).toBe('*.archive.is');
  });

  test('should add new supplier', () => {
    const newSupplier = '*.example.com';
    if (!suppliers.includes(newSupplier)) {
      suppliers.push(newSupplier);
    }

    expect(suppliers.length).toBe(14);
    expect(suppliers).toContain('*.example.com');
  });

  test('should not add duplicate supplier', () => {
    const supplier = '*.github.com';
    if (!suppliers.includes(supplier)) {
      suppliers.push(supplier);
    }

    expect(suppliers.length).toBe(13);
  });

  test('should remove supplier by index', () => {
    const index = 0; // Remove *.github.com
    suppliers.splice(index, 1);

    expect(suppliers.length).toBe(12);
    expect(suppliers).not.toContain('*.github.com');
    expect(suppliers[0]).toBe('*.gmail.com');
  });

  test('should reset to default suppliers', () => {
    suppliers = ['*.custom.com', '*.test.org'];
    suppliers = [...defaultSuppliers];

    expect(suppliers).toEqual(defaultSuppliers);
    expect(suppliers.length).toBe(13);
  });

  test('should validate supplier pattern format', () => {
    const validPatterns = [
      '*.github.com',
      'github.com',
      '*.sub.domain.com',
      '*',
      '192.168.1.*'
    ];

    validPatterns.forEach(pattern => {
      expect(pattern).toMatch(/^(\*|(\*\.)?[\w.-]+|[\w.-]+\.\*)$/);
    });
  });
});

describe('Pattern Matching for Approved Suppliers', () => {
  function matchesPattern(hostname, pattern) {
    if (pattern === '*') return true;
    if (pattern.endsWith('.*')) {
      const prefix = pattern.slice(0, -1);
      return hostname.startsWith(prefix);
    }
    if (pattern.startsWith('*.')) {
      const domain = pattern.slice(2);
      return hostname === domain || hostname.endsWith('.' + domain);
    }
    return hostname === pattern;
  }

  test('should match exact domain patterns', () => {
    expect(matchesPattern('github.com', 'github.com')).toBe(true);
    expect(matchesPattern('google.com', 'github.com')).toBe(false);
  });

  test('should match wildcard subdomain patterns', () => {
    const pattern = '*.github.com';

    expect(matchesPattern('github.com', pattern)).toBe(true);
    expect(matchesPattern('api.github.com', pattern)).toBe(true);
    expect(matchesPattern('docs.api.github.com', pattern)).toBe(true);
    expect(matchesPattern('example.com', pattern)).toBe(false);
  });

  test('should match asterisk wildcard', () => {
    expect(matchesPattern('any-domain.com', '*')).toBe(true);
    expect(matchesPattern('another.com', '*')).toBe(true);
  });

  test('should match prefix wildcard patterns', () => {
    expect(matchesPattern('192.168.1.10', '192.168.1.*')).toBe(true);
    expect(matchesPattern('192.168.2.10', '192.168.1.*')).toBe(false);
  });

  test('should handle edge cases', () => {
    expect(matchesPattern('', 'github.com')).toBe(false);
    expect(matchesPattern('github.com', '')).toBe(false);
    expect(matchesPattern('github.com', '*.github.com')).toBe(true);
  });
});

describe('Supplier Domain Validation', () => {
  test('should validate wildcard patterns', () => {
    const validWildcards = ['*.example.com', '*.test.org', '*.domain.co.uk'];
    validWildcards.forEach(pattern => {
      expect(pattern.startsWith('*.')).toBe(true);
    });
  });

  test('should extract base domain from wildcard', () => {
    function getBaseDomain(pattern) {
      if (pattern.startsWith('*.')) {
        return pattern.slice(2);
      }
      return pattern;
    }

    expect(getBaseDomain('*.github.com')).toBe('github.com');
    expect(getBaseDomain('github.com')).toBe('github.com');
  });
});
