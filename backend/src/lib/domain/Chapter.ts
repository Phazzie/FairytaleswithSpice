export class Chapter {
  private readonly _title: string;
  private readonly _content: string;
  private readonly _chapterNumber: number;

  constructor(title: string, content: string, chapterNumber: number) {
    this._title = title;
    this._content = content;
    this._chapterNumber = chapterNumber;
  }

  get title(): string {
    return this._title;
  }

  get content(): string {
    return this._content;
  }

  get chapterNumber(): number {
    return this._chapterNumber;
  }
}
