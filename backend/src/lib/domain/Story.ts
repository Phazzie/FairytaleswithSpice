import { Chapter } from './Chapter';
import { StoryGenerationSeam } from '@fairytales-with-spice/contracts';

export class Story {
  private readonly _id: string;
  private readonly _title: string;
  private readonly _creature: StoryGenerationSeam['input']['creature'];
  private readonly _themes: StoryGenerationSeam['input']['themes'];
  private readonly _spicyLevel: StoryGenerationSeam['input']['spicyLevel'];
  private readonly _chapters: Chapter[] = [];

  constructor(
    id: string,
    title: string,
    creature: StoryGenerationSeam['input']['creature'],
    themes: StoryGenerationSeam['input']['themes'],
    spicyLevel: StoryGenerationSeam['input']['spicyLevel'],
    initialContent: string
  ) {
    this._id = id;
    this._title = title;
    this._creature = creature;
    this._themes = themes;
    this._spicyLevel = spicyLevel;
    this._chapters.push(new Chapter(title, initialContent, 1));
  }

  get id(): string {
    return this._id;
  }

  get title(): string {
    return this._title;
  }

  get creature(): StoryGenerationSeam['input']['creature'] {
    return this._creature;
  }

  get themes(): StoryGenerationSeam['input']['themes'] {
    return this._themes;
  }

  get spicyLevel(): StoryGenerationSeam['input']['spicyLevel'] {
    return this._spicyLevel;
  }

  get chapters(): Chapter[] {
    return this._chapters;
  }

  get fullContent(): string {
    return this._chapters.map(c => c.content).join('\\n\\n<hr>\\n\\n');
  }

  addChapter(title: string, content: string): Chapter {
    const newChapter = new Chapter(title, content, this._chapters.length + 1);
    this._chapters.push(newChapter);
    return newChapter;
  }
}
