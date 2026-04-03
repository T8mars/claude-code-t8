export type SyntaxTheme = {
  theme: string;
  source: string | null;
};

export class ColorDiff {
  private patch: { lines?: string[] } | null;

  constructor(
    patch: { lines?: string[] } | null,
    _firstLine?: string | null,
    _filePath?: string,
    _fileContent?: string | null,
  ) {
    this.patch = patch;
  }

  render(_theme: string, _width: number, _dim: boolean): string[] {
    const lines = this.patch?.lines;
    return Array.isArray(lines) ? lines : [];
  }
}

export class ColorFile {
  private code: string;

  constructor(code: string, _filePath?: string) {
    this.code = code;
  }

  render(_theme: string, _width: number, _dim: boolean): string[] {
    return this.code.split('\n');
  }
}

export function getSyntaxTheme(themeName: string): SyntaxTheme {
  return { theme: themeName, source: 'stub' };
}
