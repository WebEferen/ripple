import { RenderRoute } from '@ripple-ts/meta/routing';
// @ts-expect-error: known issue, we're working on it
import { App } from './App.ripple';

export const routes = [new RenderRoute({ path: '/', entry: App })];
